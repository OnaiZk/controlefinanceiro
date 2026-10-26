import { z } from 'zod';
z.config({ jitless: true });

export const cents = z.number().int().min(0).max(1_000_000_000_000);
export const signedCents = z.number().int().min(-1_000_000_000_000).max(1_000_000_000_000);
export const slugSchema = z.enum(['CAS', 'KET']);
export const scopeSchema = z.enum(['CAS', 'KET', 'COUPLE']);
export const viewSchema = z.enum(['INDIVIDUAL', 'COUPLE', 'CONSOLIDATED']);
export type Slug = z.infer<typeof slugSchema>;
export type Scope = z.infer<typeof scopeSchema>;
export type View = z.infer<typeof viewSchema>;
const id = z.string().min(1).max(160);
export const text = z
  .string()
  .trim()
  .min(1)
  .max(160)
  .refine((value) => !/\p{Extended_Pictographic}/u.test(value), 'Use texto sem emojis.');
export const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const d = new Date(value + 'T12:00:00Z');
    return !Number.isNaN(d.valueOf()) && d.toISOString().slice(0, 10) === value;
  }, 'Data inválida.');
export const monthSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/);
export const splitSchema = z.object({
  casShareBps: z.number().int().min(0).max(10000),
  ketShareBps: z.number().int().min(0).max(10000),
  casAmountCents: cents,
  ketAmountCents: cents,
  settled: z.boolean(),
});
export const userSchema = z.object({
  id,
  slug: slugSchema,
  name: text,
  email: z.email(),
  passwordHash: z.string(),
  encryptedPluggyCredentials: z.string().optional(),
});
export const accountSchema = z.object({
  id,
  ownerScope: scopeSchema,
  name: text,
  institution: text,
  type: z.enum(['CHECKING', 'SAVINGS', 'WALLET']),
  balanceCents: signedCents,
  externalId: z.string().optional(),
  archived: z.boolean().default(false),
  bankBalanceCents: signedCents.optional(),
  bankBalanceAt: z.number().int().optional(),
});
export const cardSchema = z.object({
  id,
  ownerScope: scopeSchema,
  name: text,
  last4: z.string().regex(/^\d{4}$/),
  limitCents: cents,
  closingDay: z.number().int().min(1).max(31),
  dueDay: z.number().int().min(1).max(31),
  cashbackBps: z.number().int().min(0).max(10000),
  archived: z.boolean().default(false),
});
export const categorySchema = z.object({
  id,
  code: z.string().regex(/^[A-Z]{3}$/),
  name: text,
  iconName: text,
  type: z.enum(['INCOME', 'EXPENSE']),
  isEssential: z.boolean(),
});
export const ruleSchema = z.object({
  id,
  ownerScope: scopeSchema,
  merchantPattern: text,
  categoryId: id,
  defaultOwnerScope: scopeSchema,
  matchCount: z.number().int().min(0),
});
export const transactionSchema = z.object({
  id,
  ownerScope: scopeSchema,
  paidByUserId: slugSchema,
  accountId: id.optional(),
  cardId: id.optional(),
  destinationAccountId: id.optional(),
  categoryId: id,
  type: z.enum(['INCOME', 'EXPENSE', 'TRANSFER']),
  status: z.enum(['PAID', 'PENDING', 'NEEDS_REVIEW', 'REJECTED']),
  amountCents: cents.refine((v) => v > 0),
  cashbackEarnedCents: cents,
  description: text,
  merchantNormalized: z.string(),
  occurredAt: isoDate,
  dueDate: isoDate.optional(),
  coupleSplit: splitSchema.optional(),
  externalId: z.string().max(200).optional(),
  source: z.enum(['MANUAL', 'MOCK', 'FILE', 'PLUGGY']),
  sourceAccountKey: z.string().optional(),
  installmentGroup: id.optional(),
  installmentNumber: z.number().int().optional(),
  installmentTotal: z.number().int().optional(),
  entryKind: z.enum(['STANDARD', 'INVOICE_PAYMENT', 'REFUND', 'SETTLEMENT']).default('STANDARD'),
  relatedId: id.optional(),
  invoiceMonth: monthSchema.optional(),
  createdBy: slugSchema,
  createdAt: z.number().int(),
});
export const budgetSchema = z.object({
  id,
  ownerScope: scopeSchema,
  categoryId: id,
  monthKey: monthSchema,
  limitCents: cents.refine((v) => v > 0),
});
export const investmentSchema = z.object({
  id,
  ownerScope: scopeSchema,
  name: text,
  type: z.enum(['CDB_CDI', 'TESOURO', 'FII_ACOES', 'GLOBAL', 'RESERVA_CASAL']),
  principalCents: cents,
  currentBalanceCents: cents,
  cdiPercentageBps: z.number().int().min(0).max(50000),
  hasFgcProtection: z.boolean(),
  valuationDate: isoDate,
});
export const alertSchema = z.object({
  id,
  agentId: z.enum(['ALBERT', 'SHERLOCK', 'MARIE', 'MEGAMEN', 'JULIUS', 'RITA']),
  targetScope: scopeSchema,
  severity: z.enum(['INFO', 'WARNING', 'CRITICAL']),
  title: text,
  message: z.string().max(600),
  relatedTransactionId: id.optional(),
  dismissed: z.boolean(),
  period: monthSchema,
});
export const auditSchema = z.object({
  id,
  actorSlug: slugSchema,
  action: z.string(),
  metadataSanitized: z.object({
    entityId: z.string().optional(),
    result: z.enum(['SUCCESS', 'DENIED', 'FAILURE']),
  }),
  createdAt: z.number().int(),
});
export const goalSchema = z.object({
  id,
  ownerScope: scopeSchema,
  name: text,
  targetCents: cents.refine((v) => v > 0),
  savedCents: cents,
  targetDate: isoDate,
});
export const recurringSchema = z.object({
  id,
  ownerScope: scopeSchema,
  name: text,
  amountCents: cents.refine((v) => v > 0),
  dueDay: z.number().int().min(1).max(31),
  categoryId: id,
  active: z.boolean(),
});
export const settlementSchema = z.object({
  id,
  monthKey: monthSchema,
  from: slugSchema,
  to: slugSchema,
  amountCents: cents.refine((v) => v > 0),
  paidAt: isoDate,
  createdBy: slugSchema,
});
export const connectionSchema = z.object({
  id,
  userSlug: slugSchema,
  itemIds: z.array(z.string().min(1).max(160)).max(5),
  lastSyncAt: z.number().int().optional(),
  provider: z.enum(['MOCK', 'PLUGGY']),
});
export const sessionSchema = z.object({
  id,
  userSlug: slugSchema,
  tokenHash: z.string(),
  expiresAt: z.number().int(),
  createdAt: z.number().int(),
});
export const throttleSchema = z.object({
  id,
  failures: z.number().int(),
  resetAt: z.number().int(),
});
export const stateSchema = z.object({
  version: z.literal(1),
  users: z.array(userSchema),
  accounts: z.array(accountSchema),
  cards: z.array(cardSchema),
  categories: z.array(categorySchema),
  categoryRules: z.array(ruleSchema),
  transactions: z.array(transactionSchema),
  budgets: z.array(budgetSchema),
  investments: z.array(investmentSchema),
  agentAlerts: z.array(alertSchema),
  auditLogs: z.array(auditSchema),
  goals: z.array(goalSchema),
  recurringBills: z.array(recurringSchema),
  settlements: z.array(settlementSchema),
  bankConnections: z.array(connectionSchema),
  sessions: z.array(sessionSchema),
  loginThrottles: z.array(throttleSchema),
});
export type State = z.infer<typeof stateSchema>;
export type Transaction = z.infer<typeof transactionSchema>;
export type Account = z.infer<typeof accountSchema>;
export type Card = z.infer<typeof cardSchema>;
export type Category = z.infer<typeof categorySchema>;
export type Investment = z.infer<typeof investmentSchema>;
export type AgentAlert = z.infer<typeof alertSchema>;
export type PublicUser = Pick<State['users'][number], 'id' | 'name' | 'slug' | 'email'>;

const transactionInput = z
  .object({
    ownerScope: scopeSchema,
    paidByUserId: slugSchema.optional(),
    accountId: id.optional(),
    cardId: id.optional(),
    destinationAccountId: id.optional(),
    categoryId: id,
    type: z.enum(['INCOME', 'EXPENSE', 'TRANSFER']),
    amountCents: cents.refine((v) => v > 0),
    description: text,
    occurredAt: isoDate,
    dueDate: isoDate.optional(),
    status: z.enum(['PAID', 'PENDING']).default('PAID'),
    casShareBps: z.number().int().min(0).max(10000).default(5000),
    installments: z.number().int().min(1).max(48).default(1),
  })
  .strict();
export type TransactionInput = z.infer<typeof transactionInput>;
export const commandSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('createTransaction'), data: transactionInput }).strict(),
  z.object({ kind: z.literal('updateTransaction'), id, data: transactionInput }).strict(),
  z.object({ kind: z.literal('review'), id, approve: z.boolean() }).strict(),
  z.object({ kind: z.literal('reopenReview'), id }).strict(),
  z.object({ kind: z.literal('markPaid'), id }).strict(),
  z.object({ kind: z.literal('deleteTransaction'), id }).strict(),
  z
    .object({
      kind: z.literal('categorize'),
      id,
      categoryId: id,
      learn: z.boolean(),
      ownerScope: scopeSchema.optional(),
    })
    .strict(),
  z
    .object({
      kind: z.literal('createAccount'),
      data: accountSchema
        .omit({
          id: true,
          archived: true,
          externalId: true,
          bankBalanceCents: true,
          bankBalanceAt: true,
        })
        .strict(),
    })
    .strict(),
  z
    .object({
      kind: z.literal('updateAccount'),
      id,
      data: accountSchema
        .omit({
          id: true,
          archived: true,
          externalId: true,
          bankBalanceCents: true,
          bankBalanceAt: true,
        })
        .strict(),
    })
    .strict(),
  z
    .object({
      kind: z.literal('createCard'),
      data: cardSchema.omit({ id: true, archived: true }).strict(),
    })
    .strict(),
  z
    .object({ kind: z.literal('saveBudget'), data: budgetSchema.omit({ id: true }).strict() })
    .strict(),
  z
    .object({
      kind: z.literal('createInvestment'),
      data: investmentSchema.omit({ id: true }).strict(),
    })
    .strict(),
  z
    .object({
      kind: z.literal('valueInvestment'),
      id,
      currentBalanceCents: cents,
      valuationDate: isoDate,
    })
    .strict(),
  z
    .object({ kind: z.literal('createGoal'), data: goalSchema.omit({ id: true }).strict() })
    .strict(),
  z
    .object({ kind: z.literal('contributeGoal'), id, amountCents: cents.refine((v) => v > 0) })
    .strict(),
  z
    .object({
      kind: z.literal('createRecurring'),
      data: recurringSchema.omit({ id: true, active: true }).strict(),
    })
    .strict(),
  z.object({ kind: z.literal('toggleRecurring'), id }).strict(),
  z.object({ kind: z.literal('payRecurring'), id, accountId: id, monthKey: monthSchema }).strict(),
  z
    .object({
      kind: z.literal('settle'),
      monthKey: monthSchema,
      amountCents: cents.refine((v) => v > 0),
    })
    .strict(),
  z
    .object({ kind: z.literal('payInvoice'), cardId: id, accountId: id, monthKey: monthSchema })
    .strict(),
  z.object({ kind: z.literal('refund'), id }).strict(),
  z.object({ kind: z.literal('dismissAlert'), id }).strict(),
]);
export type Command = z.infer<typeof commandSchema>;
export const importRecordSchema = z.object({
  externalId: z.string().min(1).max(200),
  description: text,
  amountCents: cents.refine((v) => v > 0),
  type: z.enum(['INCOME', 'EXPENSE']),
  occurredAt: isoDate,
  possibleDuplicate: z.boolean().optional(),
  externalAccountId: z.string().max(160).optional(),
  externalAccountName: text.optional(),
});
export type ImportRecord = z.infer<typeof importRecordSchema>;

export function brl(value: number): string {
  if (!Number.isSafeInteger(value)) throw new Error('Valor monetário fora dos limites seguros.');
  const amount = BigInt(value < 0 ? -value : value);
  const whole = (amount / 100n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${value < 0 ? '-' : ''}R$\u00a0${whole},${(amount % 100n).toString().padStart(2, '0')}`;
}
export function parseMoney(value: string): number {
  const normalized = value.replace(/R\$|\s/g, '').replace(/\./g, '');
  if (!/^\d+(,\d{1,2})?$/.test(normalized)) throw new Error('Informe um valor como 1.234,56.');
  const [whole, decimal = ''] = normalized.split(',');
  return cents.parse(Number(BigInt(whole) * 100n + BigInt(decimal.padEnd(2, '0'))));
}
export function parseSignedMoney(value: string): number {
  const text = value.trim();
  return text.startsWith('-') ? -parseMoney(text.slice(1)) : parseMoney(text);
}
export function dateInMonth(month: string, day: number): string {
  monthSchema.parse(month);
  z.number().int().min(1).max(31).parse(day);
  const end = new Date(`${month}-01T12:00:00Z`);
  end.setUTCMonth(end.getUTCMonth() + 1);
  end.setUTCDate(0);
  return `${month}-${String(Math.min(day, end.getUTCDate())).padStart(2, '0')}`;
}
export function percentageCents(value: number, bps: number): number {
  return Number(
    (BigInt(cents.parse(value)) * BigInt(z.number().int().min(0).max(100000).parse(bps)) + 5000n) /
      10000n,
  );
}
export function splitCents(value: number, casBps: number, payer: Slug) {
  cents.parse(value);
  z.number().int().min(0).max(10000).parse(casBps);
  const numerator = BigInt(value) * BigInt(casBps);
  const base = Number(numerator / 10000n);
  const cas = base + (payer === 'CAS' && numerator % 10000n !== 0n ? 1 : 0);
  return {
    casShareBps: casBps,
    ketShareBps: 10000 - casBps,
    casAmountCents: cas,
    ketAmountCents: value - cas,
    settled: false,
  };
}
export function distributeCents(value: number, count: number): number[] {
  cents.parse(value);
  z.number().int().min(1).max(48).parse(count);
  const base = Number(BigInt(value) / BigInt(count));
  return Array.from({ length: count }, (_, i) => base + (i < value % count ? 1 : 0));
}
export function normalizeMerchant(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toUpperCase()
    .replace(/[^A-Z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
export function today(now = Date.now()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date(now));
}
export function addMonths(date: string, months: number): string {
  const d = new Date(date + 'T12:00:00Z');
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + months);
  const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, last));
  return d.toISOString().slice(0, 10);
}
export function canRead(scope: Scope, actor: Slug, view: View): boolean {
  return view === 'CONSOLIDATED' || (view === 'COUPLE' ? scope === 'COUPLE' : scope === actor);
}
export function assertWrite(scope: Scope, actor: Slug) {
  if (scope !== actor && scope !== 'COUPLE')
    throw new Error('Você não pode alterar registros pessoais do outro perfil.');
}
export function invoiceMonth(
  tx: Pick<Transaction, 'occurredAt' | 'invoiceMonth'>,
  card: Card,
): string {
  return (
    tx.invoiceMonth ??
    (tx.occurredAt >= dateInMonth(tx.occurredAt.slice(0, 7), card.closingDay)
      ? addMonths(tx.occurredAt, 1)
      : tx.occurredAt
    ).slice(0, 7)
  );
}
export function accountBalance(state: State, accountId: string): number {
  const account = state.accounts.find((a) => a.id === accountId);
  if (!account) return 0;
  return state.transactions
    .filter((t) => t.status === 'PAID')
    .reduce(
      (balance, t) =>
        balance +
        (t.destinationAccountId === accountId ? t.amountCents : 0) +
        (t.accountId !== accountId ? 0 : t.type === 'INCOME' ? t.amountCents : -t.amountCents),
      account.balanceCents,
    );
}
export function invoiceBalance(state: State, cardId: string, month: string): number {
  const card = state.cards.find((c) => c.id === cardId);
  if (!card) return 0;
  return state.transactions
    .filter((t) => t.cardId === cardId && t.status === 'PAID' && invoiceMonth(t, card) === month)
    .reduce(
      (sum, t) =>
        sum +
        (t.entryKind === 'INVOICE_PAYMENT' || t.entryKind === 'REFUND'
          ? -t.amountCents
          : t.type === 'EXPENSE'
            ? t.amountCents
            : 0),
      0,
    );
}
export function coupleBalance(state: State, month: string): number {
  const debt = state.transactions
    .filter(
      (t) =>
        t.ownerScope === 'COUPLE' &&
        t.status === 'PAID' &&
        t.occurredAt.startsWith(month) &&
        t.coupleSplit &&
        t.entryKind !== 'SETTLEMENT',
    )
    .reduce((sum, t) => {
      const part =
        t.paidByUserId === 'CAS' ? t.coupleSplit!.ketAmountCents : -t.coupleSplit!.casAmountCents;
      return sum + (t.entryKind === 'REFUND' ? -part : part);
    }, 0);
  return state.settlements
    .filter((s) => s.monthKey === month)
    .reduce((sum, s) => sum + (s.from === 'KET' ? -s.amountCents : s.amountCents), debt);
}
export function publicUser(user: State['users'][number]): PublicUser {
  return { id: user.id, slug: user.slug, name: user.name, email: user.email };
}

// Fixed-point compound projection. No floating-point monetary arithmetic.
export function projectCdi(
  principalCents: number,
  annualCdiBps: number,
  participationBps: number,
  businessDays: number,
): number {
  cents.parse(principalCents);
  z.number().int().min(0).max(10000).parse(annualCdiBps);
  z.number().int().min(0).max(50000).parse(participationBps);
  z.number().int().min(0).max(2520).parse(businessDays);
  const scale = 1_000_000_000_000n;
  const power = (base: bigint, exponent: number) => {
    let result = scale;
    for (let n = exponent; n > 0; n = Math.floor(n / 2)) {
      if (n % 2) result = (result * base) / scale;
      base = (base * base) / scale;
    }
    return result;
  };
  const annualFactor = scale + (scale * BigInt(annualCdiBps)) / 10000n;
  let low = scale,
    high = 2n * scale;
  while (low + 1n < high) {
    const middle = (low + high) / 2n;
    if (power(middle, 252) <= annualFactor) low = middle;
    else high = middle;
  }
  const dailyFactor = scale + ((low - scale) * BigInt(participationBps)) / 10000n;
  return cents.parse(
    Number((BigInt(principalCents) * power(dailyFactor, businessDays) + scale / 2n) / scale),
  );
}

export interface Snapshot {
  user: PublicUser;
  view: View;
  month: string;
  mode: 'local' | 'convex';
  accounts: (Account & { currentBalanceCents: number })[];
  cards: (Card & {
    usedCents: number;
    availableCents: number;
    invoiceCents: number;
    cashbackCents: number;
  })[];
  fundingAccounts: Account[];
  fundingCards: Card[];
  categories: State['categories'];
  transactions: Transaction[];
  budgets: (State['budgets'][number] & { spentCents: number; projectedCents: number })[];
  investments: State['investments'];
  goals: State['goals'];
  recurringBills: (State['recurringBills'][number] & { paidMonths: string[] })[];
  categoryRules: State['categoryRules'];
  upcomingTransactions: Transaction[];
  alerts: AgentAlert[];
  auditLogs: State['auditLogs'];
  settlements: State['settlements'];
  bankConnections: {
    configured: boolean;
    itemCount: number;
    lastSyncAt?: number;
    provider?: string;
  };
  summary: {
    balanceCents: number;
    incomeCents: number;
    expenseCents: number;
    pendingCents: number;
    investmentCents: number;
    netWorthCents: number;
    cashbackCents: number;
    coupleDebtCents: number;
    previousExpenseCents: number;
  };
  trend: { month: string; incomeCents: number; expenseCents: number }[];
  distribution: { categoryId: string; amountCents: number }[];
}
