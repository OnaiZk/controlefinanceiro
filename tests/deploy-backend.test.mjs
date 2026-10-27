import { afterEach, expect, it, vi } from 'vitest';
import { EventEmitter } from 'node:events';

vi.mock('node:fs', () => ({ existsSync: () => false }));
vi.mock('node:child_process', () => ({ spawn: vi.fn() }));
import { spawn } from 'node:child_process';

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.resetModules();
  spawn.mockReset();
});

async function execute(code = 0) {
  vi.stubEnv('CONVEX_DEPLOY_KEY', 'test-deploy-secret');
  vi.stubEnv('BACKEND_BRIDGE_SECRET', 'b'.repeat(32));
  vi.stubEnv('NODE_TLS_REJECT_UNAUTHORIZED', '0');
  vi.stubEnv('NODE_EXTRA_CA_CERTS', 'C:/certificates/company.pem');
  const write = vi.spyOn(process.stdout, 'write').mockReturnValue(true);
  const error = vi.spyOn(console, 'error').mockImplementation(() => {});
  const exit = vi.spyOn(process, 'exit').mockImplementation(() => {});
  const calls = [];
  spawn.mockImplementation((executable, args, options) => {
    const child = new EventEmitter();
    child.stdout = new EventEmitter();
    child.stderr = new EventEmitter();
    child.stdin = { end: vi.fn(() => queueMicrotask(() => {
      child.emit('exit', code);
      child.stderr.emit('data', code ? 'self-signed certificate in certificate chain test-deploy-secret' : 'ok');
      child.emit('close', code);
    })) };
    calls.push({ executable, args, env: { ...options.env }, child });
    return child;
  });
  await import('../scripts/deploy-backend.mjs');
  return { calls, write, error, exit };
}

it('usa certificados do sistema nas duas etapas e preserva a CA adicional com TLS validado', async () => {
  const { calls, exit } = await execute();
  expect(calls).toHaveLength(2);
  for (const call of calls) {
    expect(call.executable).toBe(process.execPath);
    expect(call.args[0]).toBe('--use-system-ca');
    expect(call.env.NODE_TLS_REJECT_UNAUTHORIZED).toBeUndefined();
    expect(call.env.NODE_EXTRA_CA_CERTS).toBe('C:/certificates/company.pem');
    expect(call.args.join(' ')).not.toContain('b'.repeat(32));
  }
  expect(calls[0].args.slice(2)).toEqual(['env', 'set', 'BACKEND_BRIDGE_SECRET']);
  expect(calls[0].child.stdin.end).toHaveBeenCalledWith('b'.repeat(32) + '\n');
  expect(calls[1].args.slice(2)).toEqual(['deploy']);
  expect(exit).not.toHaveBeenCalled();
});

it('interrompe antes do deploy e orienta sobre a CA sem expor a chave mesmo com saída tardia', async () => {
  const { calls, write, error, exit } = await execute(1);
  expect(calls).toHaveLength(1);
  expect(write.mock.calls.flat().join('')).not.toContain('test-deploy-secret');
  expect(write.mock.calls.flat().join('')).toContain('[segredo removido]');
  expect(error.mock.calls.flat().join('')).toContain('NODE_EXTRA_CA_CERTS');
  expect(exit).toHaveBeenCalledWith(1);
});
