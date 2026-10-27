import { argon2Sync, randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createInterface } from 'node:readline/promises';
const root = resolve(import.meta.dirname, '..');
if (existsSync(resolve(root, '.env.local'))) {
  console.error(
    'A configuração local já existe. Preserve a chave de criptografia e o arquivo de dados.',
  );
  process.exit(1);
}
let input;
if (process.argv.includes('--stdin')) {
  process.stdin.setRawMode?.(true);
  process.stdout.write('Aguardando configuração JSON pelo stdin oculto.\n');
  const raw = await new Promise((resolve) => {
    let value = '';
    const onData = (chunk) => {
      value += String(chunk);
      if (value.includes('\n')) {
        process.stdin.off('data', onData);
        process.stdin.pause();
        resolve(value.slice(0, value.indexOf('\n')));
      }
    };
    process.stdin.on('data', onData);
    process.stdin.resume();
  });
  process.stdin.setRawMode?.(false);
  input = JSON.parse(raw);
} else {
  const line = createInterface({ input: process.stdin, output: process.stdout });
  const hidden = async (label) => {
    process.stdout.write(label);
    let answer = '';
    const stdin = process.stdin;
    line.pause();
    stdin.setRawMode?.(true);
    stdin.resume();
    await new Promise((resolve) => {
      const onData = (chunk) => {
        const c = String(chunk);
        if (c === '\r' || c === '\n') {
          stdin.off('data', onData);
          resolve();
        } else if (c === '\u0003') process.exit(1);
        else if (c === '\u007f') answer = answer.slice(0, -1);
        else answer += c;
      };
      stdin.on('data', onData);
    });
    stdin.setRawMode?.(false);
    process.stdout.write('\n');
    line.resume();
    return answer;
  };
  input = {};
  for (const slug of ['CAS', 'KET']) {
    const email = await line.question(`Email ${slug}: `);
    const password = await hidden(`Senha ${slug} (oculta): `);
    input[slug] = { email, password };
  }
  line.close();
}
const vars = {
  DATABASE_MODE: 'local',
  SEED_DEMO_DATA: 'false',
  APP_ORIGIN: 'http://localhost:3000',
  JWT_SECRET: randomBytes(32).toString('hex'),
  ENCRYPTION_KEY: randomBytes(32).toString('hex'),
  BACKEND_BRIDGE_SECRET: randomBytes(32).toString('hex'),
  PLUGGY_API_URL: 'https://api.pluggy.ai',
  PRIVACY_MODE: 'local',
};
for (const slug of ['CAS', 'KET']) {
  const entry = input[slug];
  if (
    !entry ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(entry.email) ||
    entry.password.length < 8 ||
    entry.password.length > 256
  )
    throw new Error('Email ou senha inválidos.');
  const salt = randomBytes(16);
  const result = argon2Sync('argon2id', {
    message: entry.password,
    nonce: salt,
    parallelism: 1,
    memory: 65536,
    passes: 3,
    tagLength: 32,
  });
  vars[`${slug}_EMAIL`] = entry.email;
  vars[`${slug}_PASSWORD_HASH`] =
    `$argon2id$v=19$m=65536,t=3,p=1$${salt.toString('base64').replace(/=+$/, '')}$${result.toString('base64').replace(/=+$/, '')}`;
  delete entry.password;
}
mkdirSync(resolve(root, '.local'), { recursive: true });
writeFileSync(
  resolve(root, '.env.local'),
  Object.entries(vars)
    .map(([key, value]) => `${key}=${JSON.stringify(value)}`)
    .join('\n') + '\n',
  { mode: 0o600, flag: 'wx' },
);
console.log(
  'Configuração criada em .env.local (ignorado). Senhas substituídas por hashes Argon2id; chaves aleatórias geradas. Nenhum segredo foi impresso.',
);
