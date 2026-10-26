import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import sharp from 'sharp';
const root = resolve(import.meta.dirname, '../apps/web/public');
const svg = await readFile(resolve(root, 'icon.svg'));
for (const size of [192, 512])
  await sharp(svg)
    .resize(size, size)
    .png()
    .toFile(resolve(root, `icon-${size}.png`));
console.log('Ícones PWA gerados a partir do SVG do projeto.');
