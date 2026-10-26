import { z } from 'zod';
import {
  commandSchema,
  importRecordSchema,
  isoDate,
  scopeSchema,
  slugSchema,
  stateSchema,
  type State,
} from './index';
import { applyCommand, applyImport, audit } from './engine';

export const operationSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('read') }).strict(),
  z.object({ kind: z.literal('initialize'), state: stateSchema }).strict(),
  z
    .object({
      kind: z.literal('command'),
      actor: slugSchema,
      command: commandSchema,
      now: z.number().int(),
      requestId: z.string(),
      localDate: isoDate.optional(),
    })
    .strict(),
  z
    .object({
      kind: z.literal('import'),
      actor: slugSchema,
      accountId: z.string(),
      records: z.array(importRecordSchema).max(1000),
      source: z.enum(['FILE', 'MOCK', 'PLUGGY']),
      now: z.number().int(),
      requestId: z.string(),
    })
    .strict(),
  z.object({ kind: z.literal('reserveLogin'), key: z.string(), now: z.number().int() }).strict(),
  z
    .object({
      kind: z.literal('startSession'),
      actor: slugSchema,
      key: z.string(),
      sessionId: z.string(),
      tokenHash: z.string(),
      now: z.number().int(),
      expiresAt: z.number().int(),
    })
    .strict(),
  z
    .object({
      kind: z.literal('endSession'),
      actor: slugSchema,
      sessionId: z.string(),
      now: z.number().int(),
    })
    .strict(),
  z
    .object({
      kind: z.literal('credentials'),
      actor: slugSchema,
      encrypted: z.string(),
      itemIds: z.array(z.string()).max(5),
      now: z.number().int(),
    })
    .strict(),
  z
    .object({
      kind: z.literal('syncTime'),
      actor: slugSchema,
      provider: z.enum(['MOCK', 'PLUGGY']),
      now: z.number().int(),
    })
    .strict(),
  z
    .object({ kind: z.literal('removeCredentials'), actor: slugSchema, now: z.number().int() })
    .strict(),
  z
    .object({
      kind: z.literal('auditExport'),
      actor: slugSchema,
      now: z.number().int(),
      requestId: z.string(),
    })
    .strict(),
  z
    .object({
      kind: z.literal('bankImport'),
      actor: slugSchema,
      records: z.array(importRecordSchema).max(1000),
      accounts: z
        .array(
          z.object({
            externalId: z.string(),
            name: z.string(),
            balanceCents: z.number().int().min(-1_000_000_000_000).max(1_000_000_000_000),
          }),
        )
        .max(100)
        .optional(),
      now: z.number().int(),
      requestId: z.string(),
    })
    .strict(),
]);
export type Operation = z.infer<typeof operationSchema>;
export interface OperationResult {
  state: State;
  imported?: number;
  duplicates?: number;
}

export function operate(original: State, raw: Operation): OperationResult {
  const op = operationSchema.parse(raw);
  let state = stateSchema.parse(original);
  if (op.kind === 'read') return { state };
  if (op.kind === 'initialize') {
    if (state.users.length) return { state };
    if (
      op.state.users.length !== 2 ||
      !op.state.users.some((u) => u.slug === 'CAS') ||
      !op.state.users.some((u) => u.slug === 'KET')
    )
      throw new Error('Bootstrap deve conter os dois perfis.');
    return { state: stateSchema.parse(op.state) };
  }
  if ('actor' in op && !state.users.some((u) => u.slug === op.actor))
    throw new Error('Usuário inválido.');
  switch (op.kind) {
    case 'command':
      state = applyCommand(state, op.actor, op.command, op.now, op.requestId, op.localDate);
      break;
    case 'import': {
      const result = applyImport(
        state,
        op.actor,
        op.accountId,
        op.records,
        op.source,
        op.now,
        op.requestId,
      );
      return result;
    }
    case 'reserveLogin': {
      const entry = state.loginThrottles.find((t) => t.id === op.key);
      if (entry && entry.resetAt > op.now && entry.failures >= 6)
        throw new Error('Muitas tentativas. Aguarde dez minutos.');
      state.loginThrottles = state.loginThrottles.filter((t) => t.resetAt > op.now);
      const current = state.loginThrottles.find((t) => t.id === op.key);
      if (current) current.failures++;
      else {
        if (state.loginThrottles.length >= 100)
          throw new Error('Muitas tentativas. Aguarde dez minutos.');
        state.loginThrottles.push({ id: op.key, failures: 1, resetAt: op.now + 600000 });
      }
      break;
    }
    case 'startSession':
      state.sessions = state.sessions.filter((s) => s.expiresAt > op.now);
      state.sessions.push({
        id: op.sessionId,
        userSlug: op.actor,
        tokenHash: op.tokenHash,
        createdAt: op.now,
        expiresAt: op.expiresAt,
      });
      state.loginThrottles = state.loginThrottles.filter((t) => t.id !== op.key);
      audit(state, op.actor, 'session.start', op.sessionId, op.now);
      break;
    case 'endSession':
      state.sessions = state.sessions.filter(
        (s) => s.id !== op.sessionId || s.userSlug !== op.actor,
      );
      audit(state, op.actor, 'session.end', op.sessionId, op.now);
      break;
    case 'credentials': {
      const user = state.users.find((u) => u.slug === op.actor)!;
      user.encryptedPluggyCredentials = op.encrypted;
      state.bankConnections = state.bankConnections.filter((c) => c.userSlug !== op.actor);
      state.bankConnections.push({
        id: `connection-${op.actor}`,
        userSlug: op.actor,
        itemIds: op.itemIds,
        provider: 'PLUGGY',
      });
      audit(state, op.actor, 'bank.configure', op.actor, op.now);
      break;
    }
    case 'removeCredentials': {
      const user = state.users.find((u) => u.slug === op.actor)!;
      delete user.encryptedPluggyCredentials;
      state.bankConnections = state.bankConnections.filter((c) => c.userSlug !== op.actor);
      audit(state, op.actor, 'bank.disconnect', op.actor, op.now);
      break;
    }
    case 'syncTime': {
      const item = state.bankConnections.find((c) => c.userSlug === op.actor);
      if (item) {
        item.lastSyncAt = op.now;
        item.provider = op.provider;
      } else
        state.bankConnections.push({
          id: `connection-${op.actor}`,
          userSlug: op.actor,
          itemIds: [],
          lastSyncAt: op.now,
          provider: op.provider,
        });
      break;
    }
    case 'auditExport':
      audit(state, op.actor, 'data.export', op.requestId, op.now);
      break;
    case 'bankImport': {
      let imported = 0,
        duplicates = 0;
      for (const reported of op.accounts ?? []) {
        let account = state.accounts.find(
          (a) => a.ownerScope === op.actor && a.externalId === reported.externalId,
        );
        if (!account) {
          account = {
            id: `${op.requestId}-account-${state.accounts.length}`,
            ownerScope: op.actor,
            name: reported.name,
            institution: 'Meu Pluggy',
            type: 'CHECKING',
            balanceCents: 0,
            externalId: reported.externalId,
            archived: false,
          };
          state.accounts.push(account);
        }
        account.bankBalanceCents = reported.balanceCents;
        account.bankBalanceAt = op.now;
      }
      const groups = new Map<string, typeof op.records>();
      for (const record of op.records) {
        if (!record.externalAccountId)
          throw new Error('O provedor não identificou a conta de origem.');
        const group = groups.get(record.externalAccountId) ?? [];
        group.push(record);
        groups.set(record.externalAccountId, group);
      }
      for (const [externalAccountId, records] of groups) {
        let account = state.accounts.find(
          (a) => a.externalId === externalAccountId && a.ownerScope === op.actor,
        );
        if (!account) {
          account = {
            id: `${op.requestId}-account-${groups.size}-${state.accounts.length}`,
            ownerScope: op.actor,
            name: records[0].externalAccountName ?? 'Conta sincronizada',
            institution: 'Meu Pluggy',
            type: 'CHECKING',
            balanceCents: 0,
            externalId: externalAccountId,
            archived: false,
          };
          state.accounts.push(account);
        }
        const result = applyImport(
          state,
          op.actor,
          account.id,
          records,
          'PLUGGY',
          op.now,
          `${op.requestId}-${account.id}`,
        );
        state = result.state;
        imported += result.imported;
        duplicates += result.duplicates;
      }
      return { state: stateSchema.parse(state), imported, duplicates };
    }
  }
  return { state: stateSchema.parse(state) };
}

export const connectionInputSchema = z
  .object({
    clientId: z.string().trim().min(1).max(200),
    clientSecret: z.string().min(1).max(400),
    itemIds: z.array(z.string().trim().min(1).max(160)).min(1).max(5),
  })
  .strict();
export const scopeInputSchema = z.object({ ownerScope: scopeSchema }).strict();
