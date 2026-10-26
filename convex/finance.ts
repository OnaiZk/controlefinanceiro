import { mutationGeneric } from 'convex/server';
import { v, type Value } from 'convex/values';
import { stateSchema } from '../packages/shared/src/index';
import { operate, operationSchema } from '../packages/shared/src/operations';

const tables = [
  'users',
  'accounts',
  'cards',
  'categories',
  'categoryRules',
  'transactions',
  'budgets',
  'investments',
  'agentAlerts',
  'auditLogs',
  'goals',
  'recurringBills',
  'settlements',
  'bankConnections',
  'sessions',
  'loginThrottles',
] as const;
function equals(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// Server-to-server BFF boundary. No browser or Expo client receives this secret.
// Domain validation, idempotency checks and record changes share one mutation.
export const execute = mutationGeneric({
  args: { secret: v.string(), operationJson: v.string() },
  returns: v.string(),
  handler: async (ctx, args) => {
    const secret = process.env.BACKEND_BRIDGE_SECRET;
    if (!secret || secret.length < 32 || !equals(secret, args.secret))
      throw new Error('Acesso de backend não autorizado.');
    if (args.operationJson.length > 4_000_000) throw new Error('Operação maior que o limite.');
    const operation = operationSchema.parse(JSON.parse(args.operationJson));
    if (operation.kind === 'command' && !operation.localDate)
      throw new Error('Backend deve fornecer a data local autenticada.');
    const documents = await Promise.all(tables.map((table) => ctx.db.query(table).take(20001)));
    if (documents.some((docs) => docs.length > 20000))
      throw new Error(
        'Limite de registros desta versão atingido. Exporte o histórico antes de continuar.',
      );
    const raw: Record<string, unknown> = { version: 1 };
    for (let i = 0; i < tables.length; i++)
      raw[tables[i]] = documents[i].map((doc) => {
        const { _id: _id, _creationTime: _creationTime, ...value } = doc;
        return value;
      });
    const original = stateSchema.parse(raw);
    const result = operate(original, operation);
    if (operation.kind !== 'read') {
      for (let i = 0; i < tables.length; i++) {
        const table = tables[i];
        const next = result.state[table];
        const old = documents[i];
        const byId = new Map(old.map((doc) => [String(doc.id), doc]));
        for (const record of next) {
          const existing = byId.get(record.id);
          const value = JSON.parse(JSON.stringify(record)) as Record<string, Value>;
          if (existing) {
            const previous = original[table].find((row) => row.id === record.id);
            if (JSON.stringify(previous) !== JSON.stringify(record))
              await ctx.db.replace(existing._id, value);
            byId.delete(record.id);
          } else await ctx.db.insert(table, value);
        }
        for (const removed of byId.values()) await ctx.db.delete(removed._id);
      }
    }
    return JSON.stringify(result);
  },
});
