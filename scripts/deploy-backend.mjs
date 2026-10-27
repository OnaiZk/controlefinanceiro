import { existsSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
const root = resolve(import.meta.dirname, '..');
if (existsSync(resolve(root, '.env.local'))) process.loadEnvFile(resolve(root, '.env.local'));
if (!process.env.CONVEX_DEPLOY_KEY) {
  console.error(
    'Configure CONVEX_DEPLOY_KEY em .env.local, sem enviar a chave pelo chat. O script configurará o BACKEND_BRIDGE_SECRET do servidor pelo CLI oficial.',
  );
  process.exit(1);
}
if (process.env.NODE_TLS_REJECT_UNAUTHORIZED === '0')
  delete process.env.NODE_TLS_REJECT_UNAUTHORIZED;
const bridge = process.env.BACKEND_BRIDGE_SECRET;
if (!bridge || bridge.length < 32) {
  console.error('Configure BACKEND_BRIDGE_SECRET com uma chave aleatória.');
  process.exit(1);
}
async function run(args, input) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(
      process.execPath,
      ['--use-system-ca', resolve(root, 'node_modules/convex/bin/main.js'), ...args],
      { cwd: root, stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true, env: process.env },
    );
    let output = '';
    const capture = (data) => {
      output += String(data);
    };
    child.stdout.on('data', capture);
    child.stderr.on('data', capture);
    child.on('error', () =>
      reject(
        new Error(
          'Não foi possível iniciar o CLI. Confira as dependências e permissões do ambiente.',
        ),
      ),
    );
    child.on('close', (code) => {
      for (const key of [
        'BACKEND_BRIDGE_SECRET',
        'CONVEX_DEPLOY_KEY',
        'JWT_SECRET',
        'ENCRYPTION_KEY',
        'CAS_PASSWORD_HASH',
        'KET_PASSWORD_HASH',
      ])
        if (process.env[key]) output = output.replaceAll(process.env[key], '[segredo removido]');
      process.stdout.write(output);
      if (code !== 0 && /self.signed certificate|certificate chain|UNABLE_TO_VERIFY_LEAF_SIGNATURE|UNABLE_TO_GET_ISSUER_CERT_LOCALLY/i.test(output))
        console.error(
          'Falha de confiança TLS. Os certificados do sistema já estão habilitados. Se sua rede usa inspeção HTTPS, obtenha a CA oficial com a equipe de TI e configure NODE_EXTRA_CA_CERTS com o caminho do arquivo PEM em .env.local. Não desative a validação TLS. Consulte docs/DEPLOYMENT.md.',
        );
      if (code === 0) resolvePromise();
      else
        reject(
          new Error(
            'O CLI não concluiu a configuração. Confira o deployment e a mensagem de rede acima.',
          ),
        );
    });
    child.stdin.end(input ?? '');
  });
}
try {
  await run(['env', 'set', 'BACKEND_BRIDGE_SECRET'], bridge + '\n');
  await run(['deploy']);
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Implantação não concluída.');
  process.exit(1);
}
