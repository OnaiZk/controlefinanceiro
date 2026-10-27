import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { copyFile, readFile, rename, writeFile } from 'node:fs/promises';

const context = Buffer.from('entre-contas:database:v1');
function keyBytes(key) {
  if (!/^[a-f0-9]{64}$/i.test(key ?? '')) throw new Error('Chave de criptografia inválida.');
  return Buffer.from(key, 'hex');
}
export function decodeState(envelope, key) {
  const parts = envelope.split('.');
  if (parts.length !== 4 || parts[0] !== 'v1') throw new Error('Backup cifrado inválido.');
  const cipher = createDecipheriv('aes-256-gcm', keyBytes(key), Buffer.from(parts[1], 'base64url'));
  cipher.setAAD(context);
  cipher.setAuthTag(Buffer.from(parts[2], 'base64url'));
  return JSON.parse(
    Buffer.concat([cipher.update(Buffer.from(parts[3], 'base64url')), cipher.final()]).toString(
      'utf8',
    ),
  );
}
export function encodeState(state, key) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', keyBytes(key), iv);
  cipher.setAAD(context);
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(state), 'utf8'), cipher.final()]);
  return [
    'v1',
    iv.toString('base64url'),
    cipher.getAuthTag().toString('base64url'),
    encrypted.toString('base64url'),
  ].join('.');
}
export async function verifiedBackup(path, backupPath, key) {
  const original = await readFile(path, 'utf8');
  decodeState(original, key);
  await copyFile(path, backupPath, 1); // COPYFILE_EXCL: nunca sobrescrever um backup.
  const restored = decodeState(await readFile(backupPath, 'utf8'), key);
  if (JSON.stringify(restored) !== JSON.stringify(decodeState(original, key)))
    throw new Error('A verificação do backup falhou. A base original foi preservada.');
  return restored;
}
export async function writeState(path, state, key) {
  const temp = `${path}.${randomBytes(8).toString('hex')}.tmp`;
  await writeFile(temp, encodeState(state, key), { mode: 0o600, flag: 'wx' });
  const reopened = decodeState(await readFile(temp, 'utf8'), key);
  if (JSON.stringify(reopened) !== JSON.stringify(state))
    throw new Error('Verificação da gravação falhou.');
  await rename(temp, path);
}
