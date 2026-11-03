// Copies the Fusion Pixel webfont (split into small WOFF2 files with exact
// unicode-ranges) from node_modules into public/ so Vite / Vercel serve it
// from the same origin. Runs automatically before `dev` and `build`.
import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const pkg = join(root, 'node_modules', '@vp-tw', 'cjk-web-fonts-fusion-pixel-font');
const out = join(root, 'public', 'fonts', 'fusion-pixel');

if (!existsSync(pkg)) {
  console.error('[fonts] @vp-tw/cjk-web-fonts-fusion-pixel-font is missing — run `npm install` first.');
  process.exit(1);
}

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
for (const size of ['8px', '10px', '12px']) {
  cpSync(join(pkg, 'dist', size, 'proportional'), join(out, size), { recursive: true });
}
cpSync(join(pkg, 'LICENSE.font.txt'), join(out, 'LICENSE.font.txt'));
cpSync(join(pkg, 'LICENSES'), join(out, 'LICENSES'), { recursive: true });
console.log('[fonts] Fusion Pixel Font copied to public/fonts/fusion-pixel');
