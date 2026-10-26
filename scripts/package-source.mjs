import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { deflateRawSync } from 'node:zlib';
const root = resolve(import.meta.dirname, '..');
const excluded = new Set([
  '.git',
  '.local',
  '.cache',
  '.tools',
  'node_modules',
  'artifacts',
  '.next',
  '.expo',
  '.netlify',
  'coverage',
  'dist',
  'test-results',
  'playwright-report',
]);
const files = [];
async function walk(directory, relative = '') {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (
      excluded.has(entry.name) ||
      (entry.name.startsWith('.env') && entry.name !== '.env.example') ||
      entry.name.endsWith('.log') ||
      entry.name.endsWith('.tsbuildinfo')
    )
      continue;
    if (entry.isSymbolicLink()) continue;
    const name = relative ? `${relative}/${entry.name}` : entry.name;
    if (entry.isDirectory()) await walk(resolve(directory, entry.name), name);
    else files.push(name);
  }
}
await walk(root);
await mkdir(resolve(root, 'artifacts'), { recursive: true });
function crc32(data) {
  let value = 0xffffffff;
  for (const byte of data) {
    value ^= byte;
    for (let i = 0; i < 8; i++) value = (value >>> 1) ^ (value & 1 ? 0xedb88320 : 0);
  }
  return (value ^ 0xffffffff) >>> 0;
}
const chunks = [],
  central = [];
let offset = 0,
  centralSize = 0;
for (const file of files.sort()) {
  const raw = await readFile(resolve(root, file)),
    packed = deflateRawSync(raw),
    name = Buffer.from(file);
  const checksum = crc32(raw);
  const header = Buffer.alloc(30);
  header.writeUInt32LE(0x04034b50, 0);
  header.writeUInt16LE(20, 4);
  header.writeUInt16LE(0x800, 6);
  header.writeUInt16LE(8, 8);
  header.writeUInt16LE(33, 12);
  header.writeUInt32LE(checksum, 14);
  header.writeUInt32LE(packed.length, 18);
  header.writeUInt32LE(raw.length, 22);
  header.writeUInt16LE(name.length, 26);
  const directory = Buffer.alloc(46);
  directory.writeUInt32LE(0x02014b50, 0);
  directory.writeUInt16LE(20, 4);
  directory.writeUInt16LE(20, 6);
  directory.writeUInt16LE(0x800, 8);
  directory.writeUInt16LE(8, 10);
  directory.writeUInt16LE(33, 14);
  directory.writeUInt32LE(checksum, 16);
  directory.writeUInt32LE(packed.length, 20);
  directory.writeUInt32LE(raw.length, 24);
  directory.writeUInt16LE(name.length, 28);
  directory.writeUInt32LE(offset, 42);
  chunks.push(header, name, packed);
  central.push(directory, name);
  offset += header.length + name.length + packed.length;
  centralSize += directory.length + name.length;
}
const end = Buffer.alloc(22);
end.writeUInt32LE(0x06054b50, 0);
end.writeUInt16LE(files.length, 8);
end.writeUInt16LE(files.length, 10);
end.writeUInt32LE(centralSize, 12);
end.writeUInt32LE(offset, 16);
await writeFile(
  resolve(root, 'artifacts/entre-contas-source.zip'),
  Buffer.concat([...chunks, ...central, end]),
);
console.log(
  `Pacote de fontes criado: ${files.length} arquivos, sem segredos, dependências ou dados locais.`,
);
