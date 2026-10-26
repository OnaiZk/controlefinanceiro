import { describe, expect, it } from 'vitest';
import { projectCdi } from '../packages/shared/src/index';
import { operate } from '../packages/shared/src/operations';
import { seedState } from '../packages/shared/src/engine';
describe('projeção CDI de ponto fixo', () => {
  it('reproduz uma taxa anual constante em 252 dias úteis', () =>
    expect(projectCdi(100000, 1000, 10000, 252)).toBe(110000));
  it('prazo zero e CDI zero preservam principal', () => {
    expect(projectCdi(123456, 1000, 10000, 0)).toBe(123456);
    expect(projectCdi(123456, 0, 10000, 252)).toBe(123456);
  });
  it('participação maior aumenta projeção sem produzir float monetário', () => {
    const a = projectCdi(123456, 1050, 10000, 126);
    const b = projectCdi(123456, 1050, 11111, 126);
    expect(Number.isInteger(a)).toBe(true);
    expect(Number.isInteger(b)).toBe(true);
    expect(b).toBeGreaterThan(a);
  });
  it('recusa percentual ou prazo fora do contrato', () => {
    expect(() => projectCdi(10000, 1000.5, 10000, 252)).toThrow();
    expect(() => projectCdi(10000, 1000, 10000, -1)).toThrow();
  });
});
describe('contas bancárias de origem separadas', () => {
  it('saldo observado do banco é referência e não aprova lançamentos', () => {
    const state = seedState(
      [
        {
          id: 'CAS',
          slug: 'CAS',
          name: 'Cassiano',
          email: 'cas@example.com',
          passwordHash: 'test',
        },
        {
          id: 'KET',
          slug: 'KET',
          name: 'Kethellen',
          email: 'ket@example.com',
          passwordHash: 'test',
        },
      ],
      Date.now(),
      false,
    );
    const result = operate(state, {
      kind: 'bankImport',
      actor: 'CAS',
      records: [],
      accounts: [{ externalId: 'zero-history', name: 'Conta do banco', balanceCents: 12345 }],
      now: Date.now(),
      requestId: 'observed',
    });
    expect(result.state.accounts[0].bankBalanceCents).toBe(12345);
    expect(result.state.accounts[0].balanceCents).toBe(0);
    expect(result.state.transactions).toHaveLength(0);
  });
  it('não mistura transações de contas ou titulares diferentes', () => {
    const state = seedState(
      [
        {
          id: 'CAS',
          slug: 'CAS',
          name: 'Cassiano',
          email: 'cas@example.com',
          passwordHash: 'test',
        },
        {
          id: 'KET',
          slug: 'KET',
          name: 'Kethellen',
          email: 'ket@example.com',
          passwordHash: 'test',
        },
      ],
      Date.now(),
      false,
    );
    const records = ['bank-a', 'bank-b'].map((externalAccountId) => ({
      externalId: externalAccountId + ':t1',
      externalAccountId,
      description: 'Mercado',
      amountCents: 100,
      type: 'EXPENSE' as const,
      occurredAt: '2026-10-20',
    }));
    const result = operate(state, {
      kind: 'bankImport',
      actor: 'CAS',
      records,
      now: Date.now(),
      requestId: 'first',
    });
    expect(result.state.accounts).toHaveLength(2);
    expect(new Set(result.state.transactions.map((t) => t.accountId)).size).toBe(2);
    const repeat = operate(result.state, {
      kind: 'bankImport',
      actor: 'CAS',
      records,
      now: Date.now(),
      requestId: 'repeat',
    });
    expect(repeat.imported).toBe(0);
    expect(repeat.duplicates).toBe(2);
    const other = operate(result.state, {
      kind: 'bankImport',
      actor: 'KET',
      records,
      now: Date.now(),
      requestId: 'other',
    });
    expect(other.state.accounts).toHaveLength(4);
    expect(other.state.accounts.filter((a) => a.ownerScope === 'KET')).toHaveLength(2);
  });
});
