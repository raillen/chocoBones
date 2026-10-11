import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));

export function buildPreview() {
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));
  const sources = Object.fromEntries(manifest.parts.map(part => [part.id, fs.readFileSync(path.join(root, part.svg), 'utf8')]));
  const payload = JSON.stringify({ manifest, sources }).replaceAll('<', '\\u003c');
  const template = fs.readFileSync(path.join(root, 'preview-template.html'), 'utf8');
  fs.writeFileSync(path.join(root, 'rig-preview.html'), template.replace('<!-- EMBEDDED_ASSETS -->', payload));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) buildPreview();
