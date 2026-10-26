import { afterEach, describe, expect, it, vi } from 'vitest';
import { execute } from '../convex/finance';
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
