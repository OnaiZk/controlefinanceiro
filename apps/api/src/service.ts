import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import {
  commandSchema,
  monthSchema,
  publicUser,
  today,
  viewSchema,
  type Slug,
} from '../../../packages/shared/src/index';
import { snapshot } from '../../../packages/shared/src/engine';
import { connectionInputSchema } from '../../../packages/shared/src/operations';
import { initializedDatabase } from './database';
import { digest, readSession, seal, signSession, unseal, verifyPassword } from './security';
import { FileBankSyncAdapter, MockBankSyncAdapter, PluggyBankSyncAdapter } from './banks';

export class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}
const loginSchema = z
  .object({ email: z.email().max(200), password: z.string().min(1).max(256) })
  .strict();
export const COOKIE = 'entre_contas_session';
const SESSION_TTL = 8 * 60 * 60 * 1000;
function secret(name: string): string {
  const value = process.env[name];
  if (!value) throw new HttpError(503, `Configuração de segurança ausente: ${name}.`);
  return value;
}
export async function login(raw: unknown) {
  const { email, password } = loginSchema.parse(raw);
  const { db, state } = await initializedDatabase();
  const key = digest(email.trim().toLowerCase());
  const now = Date.now();
  try {
    await db.execute({ kind: 'reserveLogin', key, now });
  } catch {
    throw new HttpError(429, 'Muitas tentativas. Aguarde dez minutos.');
  }
  const user = state.users.find((u) => u.email.toLowerCase() === email.trim().toLowerCase());
  // The same Argon2 work for unknown emails prevents a fast account oracle.
  const fallback = state.users[0]?.passwordHash ?? '';
  const correct = await verifyPassword(password, user?.passwordHash ?? fallback);
  if (!user || !correct) throw new HttpError(401, 'Email ou senha incorretos.');
  const sessionId = randomUUID(),
    expiresAt = now + SESSION_TTL;
  const token = await signSession(user.slug, sessionId, secret('JWT_SECRET'), expiresAt);
  await db.execute({
    kind: 'startSession',
    actor: user.slug,
    key,
    sessionId,
    tokenHash: digest(token),
    now,
    expiresAt,
  });
  return { token, user: publicUser(user), expiresAt };
}
export async function authenticate(token: string | undefined) {
  if (!token) throw new HttpError(401, 'Entre para acessar suas finanças.');
  let identity: { slug: Slug; sessionId: string };
  try {
    identity = await readSession(token, secret('JWT_SECRET'));
  } catch {
    throw new HttpError(401, 'Sua sessão expirou. Entre novamente.');
  }
  const { db, state } = await initializedDatabase();
  const session = state.sessions.find(
    (s) =>
      s.id === identity.sessionId &&
      s.userSlug === identity.slug &&
      s.tokenHash === digest(token) &&
      s.expiresAt > Date.now(),
  );
  if (!session) throw new HttpError(401, 'Sessão encerrada. Entre novamente.');
  return { db, state, actor: identity.slug, sessionId: identity.sessionId };
}
export async function getSnapshot(token: string | undefined, view: unknown, month: unknown) {
  const { db, state, actor } = await authenticate(token);
  return snapshot(
    state,
    actor,
    viewSchema.parse(view ?? 'INDIVIDUAL'),
    monthSchema.parse(month ?? today().slice(0, 7)),
    db.mode,
    Date.now(),
  );
}
export async function mutate(token: string | undefined, raw: unknown) {
  const { db, actor } = await authenticate(token);
  const command = commandSchema.parse(raw);
  await db.execute({ kind: 'command', actor, command, now: Date.now(), requestId: randomUUID() });
  return { ok: true };
}
export async function logout(token: string | undefined) {
  const { db, actor, sessionId } = await authenticate(token);
  await db.execute({ kind: 'endSession', actor, sessionId, now: Date.now() });
  return { ok: true };
}
export async function importFile(token: string | undefined, raw: unknown) {
  const input = z
    .object({
      filename: z.string().max(200),
      content: z.string().max(2_000_000),
      accountId: z.string(),
      options: z
        .object({
          dateColumn: z.string().optional(),
          descriptionColumn: z.string().optional(),
          amountColumn: z.string().optional(),
          idColumn: z.string().optional(),
          decimalFormat: z.enum(['br', 'decimal']).optional(),
        })
        .optional(),
    })
    .strict()
    .parse(raw);
  const { db, actor } = await authenticate(token);
  const records = await new FileBankSyncAdapter(
    input.content,
    input.filename,
    input.options,
  ).read();
  const result = await db.execute({
    kind: 'import',
    actor,
    accountId: input.accountId,
    records,
    source: 'FILE',
    now: Date.now(),
    requestId: randomUUID(),
  });
  return { ok: true, imported: result.imported, duplicates: result.duplicates };
}
export async function configureBank(token: string | undefined, raw: unknown) {
  const input = connectionInputSchema.parse(raw);
  const { db, actor } = await authenticate(token);
  await db.execute({
    kind: 'credentials',
    actor,
    encrypted: seal(
      JSON.stringify({ clientId: input.clientId, clientSecret: input.clientSecret }),
      secret('ENCRYPTION_KEY'),
      `pluggy:${actor}`,
    ),
    itemIds: input.itemIds,
    now: Date.now(),
  });
  return { ok: true };
}
export async function disconnectBank(token: string | undefined) {
  const { db, actor } = await authenticate(token);
  await db.execute({ kind: 'removeCredentials', actor, now: Date.now() });
  return { ok: true };
}
export async function auditExport(token: string | undefined) {
  const { db, actor } = await authenticate(token);
  await db.execute({ kind: 'auditExport', actor, now: Date.now(), requestId: randomUUID() });
  return { ok: true };
}
export async function syncBank(token: string | undefined, raw: unknown) {
  const input = z
    .object({ accountId: z.string().optional(), provider: z.enum(['MOCK', 'PLUGGY']) })
    .strict()
    .parse(raw);
  const { db, state, actor } = await authenticate(token);
  const account = state.accounts.find((a) => a.id === input.accountId);
  if (input.provider === 'MOCK' && (!account || account.ownerScope !== actor))
    throw new HttpError(403, 'Selecione uma conta pessoal para a simulação.');
  let adapter: MockBankSyncAdapter | PluggyBankSyncAdapter;
  if (input.provider === 'MOCK') {
    if (db.mode !== 'local' && process.env.SEED_DEMO_DATA !== 'true')
      throw new HttpError(400, 'Sincronização simulada desativada nesta base real.');
    adapter = new MockBankSyncAdapter();
  } else {
    const encrypted = state.users.find((u) => u.slug === actor)?.encryptedPluggyCredentials;
    const connection = state.bankConnections.find((c) => c.userSlug === actor);
    if (!encrypted || !connection)
      throw new HttpError(400, 'Configure suas credenciais e os itemIds do Meu Pluggy.');
    const credentials = z
      .object({ clientId: z.string(), clientSecret: z.string() })
      .parse(JSON.parse(unseal(encrypted, secret('ENCRYPTION_KEY'), `pluggy:${actor}`)));
    adapter = new PluggyBankSyncAdapter(
      { ...credentials, itemIds: connection.itemIds },
      secret('PLUGGY_API_URL'),
    );
  }
  const records = await adapter.read();
  const result =
    input.provider === 'MOCK'
      ? await db.execute({
          kind: 'import',
          actor,
          accountId: account!.id,
          records,
          source: 'MOCK',
          now: Date.now(),
          requestId: randomUUID(),
        })
      : await db.execute({
          kind: 'bankImport',
          actor,
          records,
          accounts: (adapter as PluggyBankSyncAdapter).reportedAccounts,
          now: Date.now(),
          requestId: randomUUID(),
        });
  await db.execute({ kind: 'syncTime', actor, provider: input.provider, now: Date.now() });
  return {
    ok: true,
    imported: result.imported,
    duplicates: result.duplicates,
    ...(adapter instanceof PluggyBankSyncAdapter && adapter.skippedCreditAccounts
      ? {
          notice:
            'Contas de cartão foram separadas desta coleta. Cadastre o cartão e importe suas compras ou registre-as manualmente; não misturamos fatura com saldo bancário.',
        }
      : {}),
  };
}
