import { createHash } from 'node:crypto';
import { z } from 'zod';
import {
  importRecordSchema,
  isoDate,
  today,
  type ImportRecord,
} from '../../../packages/shared/src/index';

export interface BankSyncAdapter {
  read(): Promise<ImportRecord[]>;
}
function clean(value: string): string {
  return (
    value
      .replace(/\p{Extended_Pictographic}|[\u0000-\u001F]/gu, '')
      .trim()
      .slice(0, 150) || 'Lançamento bancário'
  );
}
export function decimalToCents(
  value: string,
  format: 'br' | 'decimal',
  allowZero = false,
): { amountCents: number; negative: boolean } {
  let text = value.replace(/R\$|\s/g, '');
  const negative = text.startsWith('-') || /^\(.*\)$/.test(text);
  text = text.replace(/^[-+]|[()]/g, '');
  if (format === 'br') text = text.replace(/\./g, '').replace(',', '.');
  if (!/^\d+(\.\d{1,2})?$/.test(text))
    throw new Error('Valor inválido no extrato. Use até duas casas decimais.');
  const [integer, fraction = ''] = text.split('.');
  const amountCents = Number(BigInt(integer) * 100n + BigInt(fraction.padEnd(2, '0')));
  if (
    !Number.isSafeInteger(amountCents) ||
    amountCents < 0 ||
    (!allowZero && amountCents === 0) ||
    amountCents > 1_000_000_000_000
  )
    throw new Error('Valor fora dos limites permitidos.');
  return { amountCents, negative };
}
function dateFrom(value: string): string {
  const text = value.trim();
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(text)) {
    const [d, m, y] = text.split('/');
    return isoDate.parse(`${y}-${m}-${d}`);
  }
  if (/^\d{8}/.test(text))
    return isoDate.parse(`${text.slice(0, 4)}-${text.slice(4, 6)}-${text.slice(6, 8)}`);
  return isoDate.parse(text.slice(0, 10));
}
function rows(content: string, delimiter: string): string[][] {
  const result: string[][] = [];
  let row: string[] = [],
    field = '',
    quoted = false;
  for (let i = 0; i < content.length; i++) {
    const c = content[i];
    if (c === '"') {
      if (quoted && content[i + 1] === '"') {
        field += '"';
        i++;
      } else quoted = !quoted;
    } else if (!quoted && c === delimiter) {
      row.push(field);
      field = '';
    } else if (!quoted && (c === '\n' || c === '\r')) {
      if (c === '\r' && content[i + 1] === '\n') i++;
      row.push(field);
      if (row.some((x) => x.trim())) result.push(row);
      row = [];
      field = '';
    } else field += c;
  }
  if (quoted) throw new Error('CSV contém aspas sem fechamento.');
  row.push(field);
  if (row.some((x) => x.trim())) result.push(row);
  return result;
}
export interface FileOptions {
  dateColumn?: string;
  descriptionColumn?: string;
  amountColumn?: string;
  idColumn?: string;
  decimalFormat?: 'br' | 'decimal';
}
export class FileBankSyncAdapter implements BankSyncAdapter {
  constructor(
    private readonly content: string,
    private readonly filename: string,
    private readonly options: FileOptions = {},
  ) {}
  async read(): Promise<ImportRecord[]> {
    if (Buffer.byteLength(this.content) > 2_000_000) throw new Error('Limite de 2 MB por arquivo.');
    const content = this.content.replace(/^\uFEFF/, '');
    let result: ImportRecord[];
    if (/\.ofx$/i.test(this.filename)) {
      if (/<!DOCTYPE|<!ENTITY/i.test(content))
        throw new Error('OFX com declaração de entidade não é aceito.');
      const transactions = [...content.matchAll(/<STMTTRN>([\s\S]*?)<\/STMTTRN>/gi)];
      if (!transactions.length) throw new Error('Não encontramos transações STMTTRN nesse OFX.');
      result = transactions.map((match, i) => {
        const field = (name: string) =>
          new RegExp(`<${name}>([^<\r\n]+)`, 'i').exec(match[1])?.[1].trim() ?? '';
        const date = dateFrom(field('DTPOSTED'));
        const amount = decimalToCents(field('TRNAMT'), 'decimal');
        const description = clean(field('MEMO') || field('NAME'));
        const external =
          field('FITID') ||
          createHash('sha256')
            .update(`${date}|${field('TRNAMT')}|${description}|${i}`)
            .digest('hex');
        return {
          externalId: external,
          description,
          occurredAt: date,
          amountCents: amount.amountCents,
          type: amount.negative ? 'EXPENSE' : 'INCOME',
        };
      });
    } else if (/\.csv$/i.test(this.filename)) {
      const first = content.split(/\r?\n/, 1)[0];
      const delimiter = first.includes(';') ? ';' : first.includes('\t') ? '\t' : ',';
      const data = rows(content, delimiter);
      const header = data.shift()?.map((x) => x.trim()) ?? [];
      const norm = (value: string) =>
        value
          .normalize('NFD')
          .replace(/\p{Diacritic}/gu, '')
          .toLowerCase()
          .trim();
      const pick = (custom: string | undefined, names: string[]) =>
        custom ? header.indexOf(custom) : header.findIndex((h) => names.includes(norm(h)));
      const di = pick(this.options.dateColumn, ['data', 'date', 'dtposted']),
        mi = pick(this.options.descriptionColumn, [
          'descricao',
          'description',
          'historico',
          'lancamento',
          'memo',
        ]),
        ai = pick(this.options.amountColumn, ['valor', 'amount', 'trnamt']),
        ii = pick(this.options.idColumn, ['id', 'fitid', 'identificador']);
      if ([di, mi, ai].some((i) => i < 0))
        throw new Error(
          `CSV precisa de colunas Data, Descrição e Valor. Colunas encontradas: ${header.slice(0, 15).join(', ')}.`,
        );
      const occurrences = new Map<string, number>();
      result = data.map((row, index) => {
        try {
          const date = dateFrom(row[di] ?? '');
          const raw = row[ai] ?? '';
          const amount = decimalToCents(
            raw,
            this.options.decimalFormat ??
              (delimiter === ',' && !raw.includes(',') ? 'decimal' : 'br'),
          );
          const description = clean(row[mi] ?? '');
          const hash = createHash('sha256')
            .update(`${date}|${amount.negative ? '-' : '+'}${amount.amountCents}|${description}`)
            .digest('hex');
          const occurrence = occurrences.get(hash) ?? 0;
          occurrences.set(hash, occurrence + 1);
          return {
            externalId: ii >= 0 && row[ii]?.trim() ? row[ii].trim() : `${hash}-${occurrence}`,
            description,
            occurredAt: date,
            amountCents: amount.amountCents,
            type: amount.negative ? ('EXPENSE' as const) : ('INCOME' as const),
          };
        } catch {
          throw new Error(
            `Linha ${index + 2}: data ou valor inválido. Nenhum lançamento foi importado.`,
          );
        }
      });
    } else throw new Error('Envie um arquivo .csv ou .ofx.');
    if (result.length > 1000)
      throw new Error('Limite de 1.000 lançamentos por importação. Divida o arquivo por período.');
    return z.array(importRecordSchema).parse(result);
  }
}
export class MockBankSyncAdapter implements BankSyncAdapter {
  async read() {
    const date = today();
    return [
      {
        externalId: `mock-market-${date}`,
        description: 'Mercado de teste',
        amountCents: 24790,
        type: 'EXPENSE' as const,
        occurredAt: date,
      },
      {
        externalId: `mock-energy-${date}`,
        description: 'Energia de teste',
        amountCents: 16845,
        type: 'EXPENSE' as const,
        occurredAt: date,
      },
    ];
  }
}
const resultsSchema = z.object({
  results: z.array(z.unknown()),
  totalPages: z.number().optional(),
});
export class PluggyBankSyncAdapter implements BankSyncAdapter {
  readonly reportedAccounts: { externalId: string; name: string; balanceCents: number }[] = [];
  skippedCreditAccounts = 0;
  constructor(
    private readonly credentials: { clientId: string; clientSecret: string; itemIds: string[] },
    private readonly apiUrl: string,
  ) {
    const url = new URL(apiUrl);
    if (url.protocol !== 'https:') throw new Error('A API bancária precisa usar HTTPS.');
  }
  private async request(path: string, token?: string, body?: unknown): Promise<unknown> {
    const response = await fetch(this.apiUrl.replace(/\/$/, '') + path, {
      method: body ? 'POST' : 'GET',
      headers: { 'Content-Type': 'application/json', ...(token ? { 'X-API-KEY': token } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}),
      signal: AbortSignal.timeout(15000),
      cache: 'no-store',
    });
    if (!response.ok)
      throw new Error(
        response.status === 401 || response.status === 403
          ? 'A autorização bancária precisa ser revisada. Confira as credenciais e os consentimentos.'
          : response.status === 429
            ? 'Limite de consultas do banco atingido. Tente mais tarde.'
            : 'O provedor bancário está indisponível. Seus dados anteriores foram preservados.',
      );
    const raw = await response.text();
    if (raw.length > 4_000_000)
      throw new Error('Resposta bancária maior que o limite de segurança.');
    return JSON.parse(
      raw.replace(/("(?:amount|balance)"\s*:\s*)(-?\d+(?:\.\d+)?)(?=[,}\s])/g, '$1"$2"'),
    ) as unknown;
  }
  async read(): Promise<ImportRecord[]> {
    const auth = z.object({ apiKey: z.string() }).parse(
      await this.request('/auth', undefined, {
        clientId: this.credentials.clientId,
        clientSecret: this.credentials.clientSecret,
      }),
    );
    const records: ImportRecord[] = [];
    for (const itemId of this.credentials.itemIds) {
      const item = z
        .object({
          consentExpiresAt: z.string().nullable().optional(),
          status: z.string().optional(),
        })
        .parse(await this.request(`/items/${encodeURIComponent(itemId)}`, auth.apiKey));
      if (item.consentExpiresAt && Date.parse(item.consentExpiresAt) < Date.now())
        throw new Error(
          'Consentimento expirado. Renove no Meu Pluggy; seu histórico local foi preservado.',
        );
      const accounts = resultsSchema.parse(
        await this.request(`/accounts?itemId=${encodeURIComponent(itemId)}`, auth.apiKey),
      );
      for (const rawAccount of accounts.results) {
        const account = z
          .object({
            id: z.string(),
            name: z.string().optional(),
            type: z.enum(['BANK', 'CREDIT']),
            balance: z.string(),
            currencyCode: z.string().optional(),
          })
          .parse(rawAccount);
        if (account.currencyCode && account.currencyCode !== 'BRL') continue;
        if (account.type === 'CREDIT') {
          this.skippedCreditAccounts++;
          continue;
        }
        const balance = decimalToCents(account.balance, 'decimal', true);
        this.reportedAccounts.push({
          externalId: account.id,
          name: clean(account.name ?? 'Conta sincronizada'),
          balanceCents: balance.negative ? -balance.amountCents : balance.amountCents,
        });
        for (let page = 1; page <= 20; page++) {
          const list = resultsSchema.parse(
            await this.request(
              `/transactions?accountId=${encodeURIComponent(account.id)}&page=${page}&pageSize=100`,
              auth.apiKey,
            ),
          );
          for (const value of list.results) {
            const t = z
              .object({
                id: z.string(),
                description: z.string(),
                amount: z.string(),
                date: z.string(),
                type: z.string().optional(),
                status: z.string().optional(),
              })
              .parse(value);
            if (t.status === 'PENDING') continue;
            const amount = decimalToCents(t.amount, 'decimal');
            records.push({
              externalId: `${account.id}:${t.id}`,
              description: clean(t.description),
              amountCents: amount.amountCents,
              type: t.type === 'DEBIT' || amount.negative ? 'EXPENSE' : 'INCOME',
              occurredAt: dateFrom(t.date),
              externalAccountId: account.id,
              externalAccountName: clean(account.name ?? 'Conta sincronizada'),
            });
          }
          if (list.totalPages ? page >= list.totalPages : list.results.length < 100) break;
          if (page === 20)
            throw new Error(
              'Histórico maior que o limite desta sincronização. Use extrato por período.',
            );
        }
      }
    }
    if (records.length > 1000)
      throw new Error(
        'Mais de 1.000 transações disponíveis. Importe o histórico por período antes de sincronizar.',
      );
    return records;
  }
}
