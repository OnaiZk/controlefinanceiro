import { describe, expect, it } from 'vitest';
import {
  accountBalance,
  brl,
  coupleBalance,
  distributeCents,
  invoiceBalance,
  parseMoney,
  percentageCents,
  splitCents,
  type Command,
  type State,
} from '../packages/shared/src/index';
import {
  applyCommand,
  applyImport,
  generateAlerts,
  seedState,
  snapshot,
} from '../packages/shared/src/engine';
import { operate } from '../packages/shared/src/operations';

const now = Date.parse('2026-10-25T15:00:00Z');
export function fixture(): State {
  const state = seedState(
    [
      {
        id: 'CAS',
        slug: 'CAS',
        name: 'Cassiano',
        email: 'cas@example.com',
        passwordHash: 'fixture-only',
      },
      {
        id: 'KET',
        slug: 'KET',
        name: 'Kethellen',
        email: 'ket@example.com',
        passwordHash: 'fixture-only',
      },
    ],
    now,
    true,
  );
  state.transactions = [];
  state.auditLogs = [];
  return state;
}
function command(state: State, value: Command, actor: 'CAS' | 'KET' = 'CAS', id = 'request-1') {
  return applyCommand(state, actor, value, now, id);
}
function expense(extra = {}) {
  return {
    kind: 'createTransaction' as const,
    data: {
      ownerScope: 'CAS' as const,
      accountId: 'acc-cas',
      categoryId: 'cat-ALM',
      type: 'EXPENSE' as const,
      amountCents: 10001,
      description: 'Mercado',
      occurredAt: '2026-10-20',
      status: 'PAID' as const,
      casShareBps: 5000,
      installments: 1,
      ...extra,
    },
  };
}
describe('dinheiro em centavos', () => {
  it.each([
    ['1.234,56', 123456],
    ['0,01', 1],
    ['10', 1000],
    ['R$ 42,9', 4290],
  ])('interpreta %s', (text, cents) => expect(parseMoney(text)).toBe(cents));
  it.each(['1.2.3,456', 'NaN', '-1', '1e3', '4,123'])('rejeita formato %s', (text) =>
    expect(() => parseMoney(text)).toThrow(),
  );
  it('formata BRL', () => expect(brl(10001)).toContain('100,01'));
  it('preserva resto do rateio com qualquer pagador', () => {
    expect(splitCents(10001, 5000, 'CAS').casAmountCents).toBe(5001);
    expect(splitCents(10001, 5000, 'KET').casAmountCents).toBe(5000);
    for (let amount = 1; amount < 300; amount++)
      for (const bps of [0, 1234, 5000, 9999, 10000]) {
        const s = splitCents(amount, bps, 'CAS');
        expect(s.casAmountCents + s.ketAmountCents).toBe(amount);
      }
  });
  it('calcula cashback sem arredondamentos de float', () => {
    expect(percentageCents(42000, 300)).toBe(1260);
    expect(percentageCents(1, 5000)).toBe(1);
  });
  it('preserva todos os centavos das parcelas', () => {
    expect(distributeCents(10001, 3)).toEqual([3334, 3334, 3333]);
    expect(distributeCents(99999, 48).reduce((a, b) => a + b)).toBe(99999);
  });
});
describe('integridade financeira e permissões', () => {
  it('despesa reduz o saldo uma única vez', () => {
    const state = command(fixture(), expense());
    expect(accountBalance(state, 'acc-cas')).toBe(485000 - 10001);
    expect(snapshot(state, 'CAS', 'INDIVIDUAL', '2026-10', 'local', now).summary.expenseCents).toBe(
      10001,
    );
  });
  it('pendência não afeta saldo e só pode ser realizada uma vez', () => {
    const state = command(fixture(), expense({ status: 'PENDING' }));
    expect(accountBalance(state, 'acc-cas')).toBe(485000);
    const next = command(state, { kind: 'markPaid', id: 'request-1-0' });
    expect(accountBalance(next, 'acc-cas')).toBe(474999);
    expect(() => command(next, { kind: 'markPaid', id: 'request-1-0' })).toThrow();
  });
  it('bloqueia criação e alteração de dados pessoais do outro', () => {
    expect(() =>
      command(fixture(), expense({ ownerScope: 'KET', accountId: 'acc-ket' })),
    ).toThrow();
    const state = command(fixture(), expense(), 'CAS');
    expect(() => command(state, { kind: 'deleteTransaction', id: 'request-1-0' }, 'KET')).toThrow();
  });
  it('não aceita userId/ator injetado pelo cliente', () =>
    expect(() => command(fixture(), { ...expense(), userId: 'KET' } as Command)).toThrow());
  it('isola a visão individual e permite a consolidada definida', () => {
    const state = fixture();
    const a = snapshot(state, 'CAS', 'INDIVIDUAL', '2026-10', 'local', now);
    expect(a.accounts.map((x) => x.ownerScope)).toEqual(['CAS']);
    expect(snapshot(state, 'CAS', 'CONSOLIDATED', '2026-10', 'local', now).accounts).toHaveLength(
      3,
    );
    expect(
      snapshot(state, 'KET', 'COUPLE', '2026-10', 'local', now).accounts.map((a) => a.ownerScope),
    ).toEqual(['COUPLE']);
  });
  it('a resposta pública nunca inclui hash, segredos, sessões ou chaves', () => {
    const state = fixture();
    state.users[0].encryptedPluggyCredentials = 'ENCRYPTED_SECRET';
    const raw = JSON.stringify(snapshot(state, 'CAS', 'CONSOLIDATED', '2026-10', 'local', now));
    expect(raw).not.toContain('fixture-only');
    expect(raw).not.toContain('ENCRYPTED_SECRET');
    expect(raw).not.toContain('tokenHash');
  });
  it('transferência mantém patrimônio e não cria consumo', () => {
    const state = command(
      fixture(),
      expense({ type: 'TRANSFER', destinationAccountId: 'acc-couple' }),
    );
    expect(accountBalance(state, 'acc-cas') + accountBalance(state, 'acc-couple')).toBe(665000);
    const view = snapshot(state, 'CAS', 'CONSOLIDATED', '2026-10', 'local', now);
    expect(view.summary.expenseCents).toBe(0);
    expect(view.summary.incomeCents).toBe(0);
  });
  it('bloqueia transferência para a mesma conta e conta do outro', () => {
    expect(() =>
      command(fixture(), expense({ type: 'TRANSFER', destinationAccountId: 'acc-cas' })),
    ).toThrow();
    expect(() =>
      command(fixture(), expense({ type: 'TRANSFER', destinationAccountId: 'acc-ket' })),
    ).toThrow();
  });
  it('cartão e pagamento de fatura não duplicam despesa', () => {
    const state = command(
      fixture(),
      expense({ accountId: undefined, cardId: 'card-cas', occurredAt: '2026-10-15' }),
    );
    expect(accountBalance(state, 'acc-cas')).toBe(485000);
    expect(invoiceBalance(state, 'card-cas', '2026-10')).toBe(10001);
    const next = command(state, {
      kind: 'payInvoice',
      cardId: 'card-cas',
      accountId: 'acc-cas',
      monthKey: '2026-10',
    });
    expect(invoiceBalance(next, 'card-cas', '2026-10')).toBe(0);
    expect(accountBalance(next, 'acc-cas')).toBe(474999);
    expect(snapshot(next, 'CAS', 'INDIVIDUAL', '2026-10', 'local', now).summary.expenseCents).toBe(
      10001,
    );
    expect(() =>
      command(next, {
        kind: 'payInvoice',
        cardId: 'card-cas',
        accountId: 'acc-cas',
        monthKey: '2026-10',
      }),
    ).toThrow();
  });
  it('parcela o cartão em meses e preserva o principal', () => {
    const state = command(
      fixture(),
      expense({
        accountId: undefined,
        cardId: 'card-cas',
        installments: 3,
        occurredAt: '2026-10-15',
      }),
    );
    expect(state.transactions.map((t) => t.amountCents)).toEqual([3334, 3334, 3333]);
    expect(state.transactions.map((t) => t.occurredAt)).toEqual([
      '2026-10-15',
      '2026-11-15',
      '2026-12-15',
    ]);
  });
  it('estorno recompõe saldo e não é receita nova', () => {
    const state = command(command(fixture(), expense()), { kind: 'refund', id: 'request-1-0' });
    const view = snapshot(state, 'CAS', 'INDIVIDUAL', '2026-10', 'local', now);
    expect(view.summary.expenseCents).toBe(0);
    expect(view.summary.incomeCents).toBe(0);
    expect(accountBalance(state, 'acc-cas')).toBe(485000);
    expect(() => command(state, { kind: 'refund', id: 'request-1-0' })).toThrow();
  });
  it('rateio e quitação parcial não aumentam consumo', () => {
    const state = command(fixture(), expense({ ownerScope: 'COUPLE' }));
    expect(coupleBalance(state, '2026-10')).toBe(5000);
    const next = command(state, { kind: 'settle', monthKey: '2026-10', amountCents: 3000 }, 'KET');
    expect(coupleBalance(next, '2026-10')).toBe(2000);
    expect(
      snapshot(next, 'CAS', 'CONSOLIDATED', '2026-10', 'local', now).summary.expenseCents,
    ).toBe(10001);
    expect(() =>
      command(next, { kind: 'settle', monthKey: '2026-10', amountCents: 2001 }),
    ).toThrow();
  });
  it('objetivos não são somados novamente ao patrimônio', () => {
    const state = fixture();
    const before = snapshot(state, 'CAS', 'CONSOLIDATED', '2026-10', 'local', now).summary
      .netWorthCents;
    const next = command(state, { kind: 'contributeGoal', id: 'goal-1', amountCents: 10000 });
    expect(
      snapshot(next, 'CAS', 'CONSOLIDATED', '2026-10', 'local', now).summary.netWorthCents,
    ).toBe(before);
  });
  it('não marca Tesouro como FGC', () =>
    expect(() =>
      command(fixture(), {
        kind: 'createInvestment',
        data: {
          ownerScope: 'CAS',
          name: 'Tesouro',
          type: 'TESOURO',
          principalCents: 100,
          currentBalanceCents: 100,
          cdiPercentageBps: 0,
          hasFgcProtection: true,
          valuationDate: '2026-10-25',
        },
      }),
    ).toThrow());
  it('auditoria não registra valores, descrições ou tokens', () => {
    const result = command(fixture(), expense());
    const log = JSON.stringify(result.auditLogs);
    expect(log).not.toContain('10001');
    expect(log).not.toContain('Mercado');
    expect(log).not.toContain('token');
  });
});
describe('conciliação e motores financeiros', () => {
  const records = [
    {
      externalId: 'bank-id-1',
      description: 'Mercado teste',
      amountCents: 12345,
      type: 'EXPENSE' as const,
      occurredAt: '2026-10-20',
    },
  ];
  it('importação não altera saldo antes de revisão', () => {
    const result = applyImport(fixture(), 'CAS', 'acc-cas', records, 'FILE', now, 'batch');
    expect(result.imported).toBe(1);
    expect(accountBalance(result.state, 'acc-cas')).toBe(485000);
    const next = command(result.state, { kind: 'review', id: 'batch-0', approve: true });
    expect(accountBalance(next, 'acc-cas')).toBe(472655);
    expect(() => command(next, { kind: 'review', id: 'batch-0', approve: true })).toThrow();
  });
  it('reimportação e item rejeitado não reaparecem', () => {
    const first = applyImport(fixture(), 'CAS', 'acc-cas', records, 'FILE', now, 'batch');
    const state = command(first.state, { kind: 'review', id: 'batch-0', approve: false });
    const next = applyImport(state, 'CAS', 'acc-cas', records, 'FILE', now, 'batch2');
    expect(next.imported).toBe(0);
    expect(next.duplicates).toBe(1);
  });
  it('identificador externo é contextualizado pela conta', () => {
    const first = applyImport(fixture(), 'CAS', 'acc-cas', records, 'FILE', now, 'batch');
    const next = applyImport(first.state, 'KET', 'acc-ket', records, 'FILE', now, 'batch2');
    expect(next.imported).toBe(1);
  });
  it('não remove duas cobranças reais parecidas', () => {
    const first = command(fixture(), expense(), 'CAS', 'a');
    const state = command(first, expense(), 'CAS', 'b');
    expect(state.transactions).toHaveLength(2);
    expect(generateAlerts(state, now).some((a) => a.agentId === 'ALBERT')).toBe(true);
  });
  it('Sherlock aprende sem alterar transações anteriores', () => {
    const result = applyImport(fixture(), 'CAS', 'acc-cas', records, 'FILE', now, 'batch');
    const learned = command(result.state, {
      kind: 'categorize',
      id: 'batch-0',
      categoryId: 'cat-ALM',
      learn: true,
    });
    const next = applyImport(
      learned,
      'CAS',
      'acc-cas',
      [{ ...records[0], externalId: 'new' }],
      'FILE',
      now,
      'newbatch',
    );
    expect(next.state.transactions.find((t) => t.id === 'newbatch-0')?.categoryId).toBe('cat-ALM');
  });
  it('Megamen alerta com orçamento atingido e respeita dispensa', () => {
    const state = command(fixture(), expense({ amountCents: 45000 }));
    const alert = generateAlerts(state, now).find((a) => a.agentId === 'MEGAMEN');
    expect(alert).toBeDefined();
    const next = command(state, { kind: 'dismissAlert', id: alert!.id });
    expect(generateAlerts(next, now).some((a) => a.id === alert!.id)).toBe(false);
  });
  it('throttle persiste limite e libera após expiração', () => {
    let state = fixture();
    for (let i = 0; i < 6; i++)
      state = operate(state, { kind: 'reserveLogin', key: 'test', now }).state;
    expect(() => operate(state, { kind: 'reserveLogin', key: 'test', now })).toThrow();
    expect(
      operate(state, { kind: 'reserveLogin', key: 'test', now: now + 600001 }).state
        .loginThrottles[0].failures,
    ).toBe(1);
  });
});
