import { afterEach, describe, expect, it, vi } from 'vitest';
import { execute } from '../convex/finance';
import schema from '../convex/schema';
const handler = (
  execute as unknown as {
    _handler: (
      context: unknown,
      args: { secret: string; operationJson: string },
    ) => Promise<string>;
  }
)._handler;
afterEach(() => vi.unstubAllEnvs());
describe('fronteira privada do backend Convex', () => {
  it('exporta índices válidos para publicação, sem nomes reservados pelo Convex', () => {
    const exported = JSON.parse((schema as unknown as { export(): string }).export()) as {
      tables: { tableName: string; indexes: { indexDescriptor: string; fields: string[] }[] }[];
    };
    for (const table of exported.tables)
      for (const index of table.indexes) {
        expect(index.indexDescriptor, table.tableName).not.toMatch(/^_|^(by_id|by_creation_time)$/);
        expect(index.fields.some(field => field.startsWith('_')), table.tableName).toBe(false);
        expect(new Set(index.fields).size, table.tableName).toBe(index.fields.length);
      }
    expect(exported.tables.find(table => table.tableName === 'sessions')?.indexes).toContainEqual({
      indexDescriptor: 'by_session_id', fields: ['id'],
    });
  });
  it('recusa cliente sem segredo antes de acessar qualquer tabela', async () => {
    vi.stubEnv('BACKEND_BRIDGE_SECRET', 'a'.repeat(64));
    await expect(
      handler({}, { secret: 'invalid', operationJson: '{"kind":"read"}' }),
    ).rejects.toThrow('não autorizado');
  });
  it('recusa configuração ausente e comandos sem data autenticada do servidor', async () => {
    vi.stubEnv('BACKEND_BRIDGE_SECRET', '');
    await expect(
      handler({}, { secret: 'a'.repeat(64), operationJson: '{"kind":"read"}' }),
    ).rejects.toThrow('não autorizado');
    vi.stubEnv('BACKEND_BRIDGE_SECRET', 'a'.repeat(64));
    const operation = {
      kind: 'command',
      actor: 'CAS',
      now: Date.now(),
      requestId: 'id',
      command: { kind: 'dismissAlert', id: 'test' },
    };
    await expect(
      handler({}, { secret: 'a'.repeat(64), operationJson: JSON.stringify(operation) }),
    ).rejects.toThrow('data local');
  });
});
