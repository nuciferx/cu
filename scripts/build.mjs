// build ทุกบท → lessons/<ชื่อ>.html (ไฟล์เดียวต่อบท) + lessons/index.html (หน้าสารบัญ)
import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, statSync } from 'node:fs';
import { dirname, resolve, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PAGES } from './pages.mjs';
import { makeIndex } from './make-index.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const vite = resolve(root, 'node_modules', 'vite', 'bin', 'vite.js');
mkdirSync(resolve(root, 'lessons'), { recursive: true });

for (const { entry, out } of PAGES) {
  const outDir = `dist/${basename(entry, '.html')}`;
  const r = spawnSync(process.execPath, [vite, 'build'], { cwd: root, stdio: 'inherit', env: { ...process.env, CU_ENTRY: entry, CU_OUT: outDir } });
  if (r.status !== 0) { console.error(`build ${entry} ล้มเหลว`); process.exit(r.status || 1); }
  const dest = resolve(root, 'lessons', out);
  copyFileSync(resolve(root, outDir, basename(entry)), dest);
  console.log(`lessons/${out}  ${(statSync(dest).size / 1048576).toFixed(2)} MB`);
}
await makeIndex(root);
