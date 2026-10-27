import { existsSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve, relative, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
import { decodeState, verifiedBackup, writeState } from './local-store.mjs';

// Somente os identificadores fixos do seed são descartáveis. Dados manuais são preservados.
export function prepareRealState(state) {
  const demoIds = {
    accounts: ['acc-cas', 'acc-ket', 'acc-couple'],
    cards: ['card-cas', 'card-ket'],
    budgets: ['budget-1', 'budget-2', 'budget-3', 'budget-4'],
    investments: ['invest-cas', 'invest-ket'],
    goals: ['goal-1'],
    recurringBills: ['bill-1', 'bill-2'],
  };
  if (
    state.version !== 1 ||
    state.users?.length !== 2 ||
    !['CAS', 'KET'].every((slug) =>
      state.users.some((u) => u.slug === slug && u.passwordHash?.startsWith('$argon2id$')),
    )
  )
    throw new Error('A base não contém os dois acessos esperados. Nenhum dado foi alterado.');
  if (
    state.transactions?.some((t) => t.source !== 'MOCK') ||
    Object.entries(demoIds).some(([table, ids]) =>
      state[table]?.some((row) => !ids.includes(row.id)),
    ) ||
    state.bankConnections?.length ||
    state.settlements?.length ||
    state.users.some((u) => u.encryptedPluggyCredentials)
  )
    throw new Error(
      'Há registros fora da demonstração. A limpeza automática foi recusada para preservar dados reais.',
    );
  const clean = structuredClone(state);
  for (const [table, rows] of Object.entries(clean))
    if (Array.isArray(rows) && table !== 'users' && table !== 'categories') clean[table] = [];
  clean.users = state.users.map(({ id, slug, name, email, passwordHash }) => ({
    id,
    slug,
    name,
    email,
    passwordHash,
  }));
  return clean;
}

async function main() {
  if (!process.argv.includes('--confirm-clear-demo'))
    throw new Error('Use --confirm-clear-demo para remover exclusivamente a demonstração local.');
  const root = resolve(import.meta.dirname, '..');
  const envPath = resolve(root, '.env.local');
  process.loadEnvFile(envPath);
  if (process.env.DATABASE_MODE !== 'local')
    throw new Error('Este comando só altera o adapter local; não acessa Convex.');
  const path = resolve(root, process.env.LOCAL_DATA_PATH ?? '.local/finance.enc');
  const inside = relative(resolve(root, '.local'), path);
  if (!inside || inside.startsWith('..') || isAbsolute(inside))
    throw new Error('A base deve estar dentro de .local/.');
  const key = process.env.ENCRYPTION_KEY;
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  if (existsSync(path)) {
    const state = decodeState(await readFile(path, 'utf8'), key);
    const clean = prepareRealState(state);
    const backup = `${path}.before-real-${stamp}.enc`;
    await verifiedBackup(path, backup, key);
    await writeState(path, clean, key);
    console.log(
      'Base local limpa. Dois acessos e categorias preservados. Backup cifrado verificado em .local/.',
    );
  } else console.log('Base ainda não criada. O primeiro acesso começará sem demonstração.');
  const env = await readFile(envPath, 'utf8');
  const updated = /^SEED_DEMO_DATA=/m.test(env)
    ? env.replace(/^SEED_DEMO_DATA=.*$/m, 'SEED_DEMO_DATA="false"')
    : `${env.trimEnd()}\nSEED_DEMO_DATA="false"\n`;
  await writeFile(envPath, updated, { mode: 0o600 });
  console.log('Demonstração desativada. Reinicie o servidor antes de usar.');
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  main().catch(() => {
    console.error(
      'Preparação interrompida. Confira se a base contém somente o seed, a chave está correta e o servidor está parado. A cópia anterior, quando criada, permanece em .local/.',
    );
    process.exitCode = 1;
  });
