// Dependency-free fallback for this delivered archive. The normal build uses Vite.
import { execFileSync } from 'node:child_process';
import { cp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
const root = new URL('../', import.meta.url);
const dist = new URL('../dist/', import.meta.url);
await rm(dist, { recursive: true, force: true });
await mkdir(new URL('assets/', dist), { recursive: true });
execFileSync('tsc', [
  '--strict', '--target', 'ES2022', '--module', 'ES2022', '--moduleResolution', 'Bundler',
  '--lib', 'ES2022,DOM,DOM.Iterable', '--skipLibCheck', '--outDir', 'dist/assets',
  'src/main.ts', 'src/pwa-updates.ts', 'src/types.ts', 'src/time.ts', 'src/db.ts', 'src/records.ts', 'src/transfers.ts', 'src/ranges.ts', 'src/range-preferences.ts', 'src/categories.ts', 'src/editor-validation.ts'
], { cwd: new URL('..', import.meta.url), stdio: 'inherit' });
await cp(new URL('public/', root), dist, { recursive: true });
await cp(new URL('src/styles.css', root), new URL('assets/styles.css', dist));
const html = (await readFile(new URL('index.html', root), 'utf8'))
  .replace('./src/styles.css', './assets/styles.css')
  .replace('./src/main.ts', './assets/main.js')
  .replace('./src/pwa-updates.ts', './assets/pwa-updates.js');
await writeFile(new URL('index.html', dist), html);
await import('./write-sw.mjs');
console.log('Standalone package ready: dist/ (serve over HTTPS or localhost)');
