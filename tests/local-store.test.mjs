import { describe, expect, it } from 'vitest';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { decodeState, encodeState, verifiedBackup, writeState } from '../scripts/local-store.mjs';
import { prepareRealState } from '../scripts/prepare-real.mjs';
import { seedState } from '../packages/shared/src/engine';
const key = 'a'.repeat(64);
function fixture() {
  return seedState(
    ['CAS', 'KET'].map((slug) => ({
      id: slug,
      slug,
      name: slug,
      email: `${slug}@example.com`,
      passwordHash: '$argon2id$fixture',
    })),
    Date.now(),
    true,
  );
}
describe('preparação da base real e recuperação local', () => {
  it('remove demonstração, sessões e resíduos, preservando acessos e categorias', () => {
    const original = fixture();
    const clean = prepareRealState(original);
    expect(clean.users).toEqual(original.users);
    expect(clean.categories).toEqual(original.categories);
    for (const [name, rows] of Object.entries(clean))
      if (Array.isArray(rows) && !['users', 'categories'].includes(name)) expect(rows).toEqual([]);
    expect(original.transactions.length).toBeGreaterThan(0);
    expect(prepareRealState(clean)).toEqual(clean);
  });
  it('recusa apagar registros manuais ou conexões reais', () => {
    const manual = fixture();
    manual.transactions[0].source = 'MANUAL';
    expect(() => prepareRealState(manual)).toThrow('preservar dados reais');
    const account = fixture();
    account.accounts[0].id = 'conta-criada-pelo-usuario';
    expect(() => prepareRealState(account)).toThrow('preservar dados reais');
  });
  it('verifica o backup antes de substituir a base e recupera o conteúdo com a mesma chave', async () => {
    const folder = await mkdtemp(resolve('.local/backup-test-'));
    try {
      const path = resolve(folder, 'finance.enc'),
        backup = resolve(folder, 'backup.enc');
      const original = fixture();
      await writeFile(path, encodeState(original, key));
      expect(await verifiedBackup(path, backup, key)).toEqual(original);
      await writeState(path, prepareRealState(original), key);
      expect(decodeState(await readFile(path, 'utf8'), key).transactions).toEqual([]);
      await writeState(path, decodeState(await readFile(backup, 'utf8'), key), key);
      expect(decodeState(await readFile(path, 'utf8'), key)).toEqual(original);
      await expect(verifiedBackup(path, backup, key)).rejects.toThrow();
      expect(() => decodeState(encodeState(original, key), 'b'.repeat(64))).toThrow();
    } finally {
      await rm(folder, { recursive: true, force: true });
    }
  });
});
