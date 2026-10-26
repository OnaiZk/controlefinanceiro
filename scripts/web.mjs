import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
const root = resolve(import.meta.dirname, '..');
if (process.env.NODE_TLS_REJECT_UNAUTHORIZED === '0')
  delete process.env.NODE_TLS_REJECT_UNAUTHORIZED;
process.env.NEXT_TELEMETRY_DISABLED = '1';
if (existsSync(resolve(root, '.env.local'))) process.loadEnvFile(resolve(root, '.env.local'));
const command = process.argv[2] ?? 'dev';
if (command === 'dev') {
  await import('./dev-server.mjs');
} else {
  const args = [
    resolve(root, 'node_modules/next/dist/bin/next'),
    command,
    ...(command === 'start' ? [] : ['--webpack']),
  ];
  const child = spawn(process.execPath, args, {
    cwd: resolve(root, 'apps/web'),
    stdio: 'inherit',
    env: process.env,
    windowsHide: true,
  });
  child.on('exit', (code) => process.exit(code ?? 1));
  child.on('error', () => {
    console.error('Não foi possível iniciar o Next.js. Instale as dependências.');
    process.exit(1);
  });
}
