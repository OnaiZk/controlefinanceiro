import { describe, expect, it } from 'vitest';
import {
  applyCommand,
  applyImport,
  generateAlerts,
  seedState,
} from '../packages/shared/src/engine';
import { accountBalance, dateInMonth, parseSignedMoney } from '../packages/shared/src/index';
const now = Date.parse('2026-10-25T15:00:00Z');
const state = () => {
  const s = seedState(
    [
      {
        id: 'CAS',
        slug: 'CAS',
        name: 'Cassiano',
        email: 'cas@example.com',
        passwordHash: 'fixture',
      },
      {
        id: 'KET',
        slug: 'KET',
        name: 'Kethellen',
        email: 'ket@example.com',
        passwordHash: 'fixture',
      },
    ],
    now,
    true,
  );
  s.transactions = [];
  return s;
};
const data = {
  ownerScope: 'CAS' as const,
  accountId: 'acc-cas',
  categoryId: 'cat-ALM',
  type: 'EXPENSE' as const,
  amountCents: 10000,
  description: 'Mercado',
  occurredAt: '2026-10-20',
  status: 'PAID' as const,
  casShareBps: 5000,
  installments: 1,
};
describe('edição, recorrência e aprendizado de escopo', () => {
  it('reabre um item rejeitado sem incorporá-lo ao saldo', () => {
    const imported = applyImport(
      state(),
      'CAS',
      'acc-cas',
      [
        {
          externalId: 'reopen',
          description: 'Mercado',
          amountCents: 5000,
          type: 'EXPENSE',
          occurredAt: '2026-10-20',
        },
      ],
      'FILE',
      now,
      'reopen',
    );
    const rejected = applyCommand(
      imported.state,
      'CAS',
      { kind: 'review', id: 'reopen-0', approve: false },
      now,
      'reject',
    );
    const reopened = applyCommand(
      rejected,
      'CAS',
      { kind: 'reopenReview', id: 'reopen-0' },
      now,
      'open',
    );
    expect(reopened.transactions[0].status).toBe('NEEDS_REVIEW');
    expect(accountBalance(reopened, 'acc-cas')).toBe(485000);
  });
  it('não transforma importação de data futura em saldo realizado', () => {
    const imported = applyImport(
      state(),
      'CAS',
      'acc-cas',
      [
        {
          externalId: 'future',
          description: 'Previsão',
          amountCents: 5000,
          type: 'INCOME',
          occurredAt: '2026-12-20',
        },
      ],
      'FILE',
      now,
      'future',
    );
    expect(() =>
      applyCommand(
        imported.state,
        'CAS',
        { kind: 'review', id: 'future-0', approve: true },
        now,
        'approve',
      ),
    ).toThrow('futura');
    expect(accountBalance(imported.state, 'acc-cas')).toBe(485000);
  });
  it('aceita saldo inicial negativo e ajusta dias curtos do mês', () => {
    expect(parseSignedMoney('-1.234,56')).toBe(-123456);
    expect(dateInMonth('2026-02', 31)).toBe('2026-02-28');
    expect(dateInMonth('2028-02', 31)).toBe('2028-02-29');
  });
  it('não realiza uma previsão futura como se fosse dinheiro disponível hoje', () => {
    expect(() =>
      applyCommand(
        state(),
        'CAS',
        { kind: 'createTransaction', data: { ...data, occurredAt: '2026-12-20' } },
        now,
        'future',
      ),
    ).toThrow('futura');
  });
  it('editar valor preserva o id e substitui, sem repetir o consumo', () => {
    const first = applyCommand(state(), 'CAS', { kind: 'createTransaction', data }, now, 'first');
    const next = applyCommand(
      first,
      'CAS',
      { kind: 'updateTransaction', id: 'first-0', data: { ...data, amountCents: 15000 } },
      now,
      'second',
    );
    expect(next.transactions).toHaveLength(1);
    expect(next.transactions[0].id).toBe('first-0');
    expect(accountBalance(next, 'acc-cas')).toBe(470000);
  });
  it('edição também valida autorização sobre o novo escopo', () => {
    const first = applyCommand(state(), 'CAS', { kind: 'createTransaction', data }, now, 'first');
    expect(() =>
      applyCommand(
        first,
        'CAS',
        { kind: 'updateTransaction', id: 'first-0', data: { ...data, ownerScope: 'KET' } },
        now,
        'second',
      ),
    ).toThrow();
  });
  it('saldo inicial pode ser corrigido, sem trocar o titular', () => {
    const first = state();
    const next = applyCommand(
      first,
      'CAS',
      {
        kind: 'updateAccount',
        id: 'acc-cas',
        data: {
          ownerScope: 'CAS',
          name: 'Conta corrigida',
          institution: 'Banco',
          type: 'CHECKING',
          balanceCents: 100,
        },
      },
      now,
      'account',
    );
    expect(accountBalance(next, 'acc-cas')).toBe(100);
    expect(() =>
      applyCommand(
        first,
        'CAS',
        {
          kind: 'updateAccount',
          id: 'acc-cas',
          data: {
            ownerScope: 'KET',
            name: 'Conta',
            institution: 'Banco',
            type: 'CHECKING',
            balanceCents: 100,
          },
        },
        now,
        'account',
      ),
    ).toThrow();
  });
  it('recorrência registra uma despesa por competência', () => {
    const next = applyCommand(
      state(),
      'CAS',
      { kind: 'payRecurring', id: 'bill-2', accountId: 'acc-cas', monthKey: '2026-10' },
      now,
      'pay',
    );
    expect(next.transactions).toHaveLength(1);
    expect(next.transactions[0].amountCents).toBe(5990);
    expect(() =>
      applyCommand(
        next,
        'CAS',
        { kind: 'payRecurring', id: 'bill-2', accountId: 'acc-cas', monthKey: '2026-10' },
        now,
        'pay2',
      ),
    ).toThrow();
  });
  it('Sherlock aprende a categoria e o escopo compartilhado na conta correta', () => {
    const records = [
      {
        externalId: 'file-1',
        description: 'Mercado da casa',
        amountCents: 9999,
        occurredAt: '2026-10-20',
        type: 'EXPENSE' as const,
      },
    ];
    const imported = applyImport(state(), 'CAS', 'acc-cas', records, 'FILE', now, 'batch').state;
    const learned = applyCommand(
      imported,
      'CAS',
      {
        kind: 'categorize',
        id: 'batch-0',
        categoryId: 'cat-ALM',
        ownerScope: 'COUPLE',
        learn: true,
      },
      now,
      'learn',
    );
    const next = applyImport(
      learned,
      'CAS',
      'acc-cas',
      [{ ...records[0], externalId: 'file-2' }],
      'FILE',
      now,
      'next',
    ).state.transactions.find((t) => t.id === 'next-0');
    expect(next?.ownerScope).toBe('COUPLE');
    expect(next?.categoryId).toBe('cat-ALM');
    expect(next?.coupleSplit?.casAmountCents).toBe(5000);
  });
  it('Albert sinaliza quando os dois pagam valores iguais ao mesmo estabelecimento', () => {
    const first = applyCommand(state(), 'CAS', { kind: 'createTransaction', data }, now, 'a');
    const next = applyCommand(
      first,
      'KET',
      { kind: 'createTransaction', data: { ...data, ownerScope: 'KET', accountId: 'acc-ket' } },
      now,
      'b',
    );
    expect(
      generateAlerts(next, now).some((a) => a.agentId === 'ALBERT' && a.targetScope === 'COUPLE'),
    ).toBe(true);
  });
});
