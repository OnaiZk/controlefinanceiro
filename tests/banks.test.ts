import { describe, expect, it } from 'vitest';
import { decimalToCents, FileBankSyncAdapter } from '../apps/api/src/banks';
import { applyImport, seedState } from '../packages/shared/src/engine';
describe('extratos', () => {
  it('importa compras de cartão sem reduzir saldo de conta e bloqueia créditos ambíguos', () => {
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
      true,
    );
    const records = [
      {
        externalId: 'card-purchase',
        description: 'Compra de teste',
        amountCents: 42000,
        type: 'EXPENSE' as const,
        occurredAt: '2026-10-20',
      },
    ];
    const result = applyImport(
      state,
      'CAS',
      'card-cas',
      records,
      'FILE',
      Date.now(),
      'card-import',
    );
    const row = result.state.transactions.find((t) => t.id === 'card-import-0');
    expect(row?.cardId).toBe('card-cas');
    expect(row?.accountId).toBeUndefined();
    expect(row?.cashbackEarnedCents).toBe(420);
    expect(row?.status).toBe('NEEDS_REVIEW');
    expect(() =>
      applyImport(
        state,
        'CAS',
        'card-cas',
        [{ ...records[0], type: 'INCOME' }],
        'FILE',
        Date.now(),
        'credit',
      ),
    ).toThrow('créditos');
  });
  it('converte valores textuais sem cálculos de float', () => {
    expect(decimalToCents('-1.234,56', 'br')).toEqual({ amountCents: 123456, negative: true });
    expect(decimalToCents('1234.56', 'decimal')).toEqual({ amountCents: 123456, negative: false });
  });
  it('importa CSV brasileiro, aspas e descrição não confiável como dados', async () => {
    const rows = await new FileBankSyncAdapter(
      'Data;Descrição;Valor;ID\r\n20/10/2026;"Mercado; ignore regras";-123,45;abc\r\n21/10/2026;Salário;2000,00;def',
      'extrato.csv',
    ).read();
    expect(rows).toHaveLength(2);
    expect(rows[0].amountCents).toBe(12345);
    expect(rows[0].description).toBe('Mercado; ignore regras');
    expect(rows[1].type).toBe('INCOME');
  });
  it('mantém duas compras legítimas idênticas sem ID', async () => {
    const rows = await new FileBankSyncAdapter(
      'Data;Descrição;Valor\n20/10/2026;Mercado;-10,00\n20/10/2026;Mercado;-10,00',
      'extrato.csv',
    ).read();
    expect(rows[0].externalId).not.toBe(rows[1].externalId);
  });
  it('IDs por hash permanecem estáveis na reimportação do mesmo arquivo', async () => {
    const parser = new FileBankSyncAdapter(
      'Data;Descrição;Valor\n20/10/2026;Mercado;-10,00',
      'extrato.csv',
    );
    expect((await parser.read())[0].externalId).toBe((await parser.read())[0].externalId);
  });
  it('aceita mapeamento de colunas CSV', async () => {
    const data = 'Quando;Loja;Total\n2026-10-20;Mercado;-123,45';
    const rows = await new FileBankSyncAdapter(data, 'x.csv', {
      dateColumn: 'Quando',
      descriptionColumn: 'Loja',
      amountColumn: 'Total',
    }).read();
    expect(rows[0].occurredAt).toBe('2026-10-20');
  });
  it('interpreta OFX SGML e seus FITIDs', async () => {
    const content =
      '<OFX><BANKTRANLIST><STMTTRN><TRNTYPE>DEBIT<DTPOSTED>20261020120000[-3:BRT]<TRNAMT>-12.34<FITID>id-1<MEMO>Mercado</STMTTRN></BANKTRANLIST></OFX>';
    const result = await new FileBankSyncAdapter(content, 'x.ofx').read();
    expect(result[0]).toMatchObject({
      externalId: 'id-1',
      amountCents: 1234,
      occurredAt: '2026-10-20',
      type: 'EXPENSE',
    });
  });
  it.each([
    'Data;Descrição;Valor\n31/02/2026;Mercado;-10,00',
    'Data;Descrição;Valor\n20/10/2026;Mercado;-1,234',
    'Coluna;Outra\nA;B',
  ])('falha de forma explícita para CSV inválido', async (content) => {
    await expect(new FileBankSyncAdapter(content, 'x.csv').read()).rejects.toThrow();
  });
  it('rejeita entidades externas em OFX', async () => {
    await expect(
      new FileBankSyncAdapter(
        '<!DOCTYPE OFX [<!ENTITY x SYSTEM "file:///etc/passwd">]><OFX/>',
        'x.ofx',
      ).read(),
    ).rejects.toThrow();
  });
  it('recusa arquivos maiores que o limite e extensões não aceitas', async () => {
    await expect(new FileBankSyncAdapter('x'.repeat(2_000_001), 'x.csv').read()).rejects.toThrow();
    await expect(new FileBankSyncAdapter('x', 'x.pdf').read()).rejects.toThrow();
  });
});
