// คัดลอก dist/index.html -> lessons/ระยะร่น.html
import { copyFileSync, mkdirSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
mkdirSync(resolve(root, 'lessons'), { recursive: true });
const out = resolve(root, 'lessons', 'ระยะร่น.html');
copyFileSync(resolve(root, 'dist', 'index.html'), out);
console.log(`lessons/ระยะร่น.html  ${(statSync(out).size / 1048576).toFixed(2)} MB`);
