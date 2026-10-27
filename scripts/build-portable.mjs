/**
 * Compile Zeitspur to a single, offline, file://-compatible HTML document.
 * This artifact deliberately has no service worker, manifest, CDN, or update
 * mechanism. It is separate from the regular Vite/PWA build.
 *
 * Usage: npm run build:portable
 */
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { readFile, readdir, mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

const require = createRequire(import.meta.url);
let ts;
try {
  ts = require('typescript');
} catch {
  // Useful when running locally with a global TypeScript installation.
  const globalRoot = execFileSync('npm', ['root', '-g'], { encoding: 'utf8' }).trim();
  ts = require(join(globalRoot, 'typescript'));
}

const root = resolve(import.meta.dirname, '..');
const outputDir = join(root, 'portable');
const packageJSON = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));
const replaceRequired = (source, search, replacement, label) => {
  if (!source.includes(search)) throw new Error(`Portable build: cannot locate ${label}; check source markup.`);
  return source.replace(search, replacement);
};

// Prefer a fixed DB name independent of the app version so future versions
// can read existing portable data when opened at the same path/origin.
// Deliberately separate from both the hosted PWA and the original file PoC.
const dbNames = {
  "const DATABASE = 'zeitspur-v1';": "const DATABASE = 'zeitspur-file-v1';",
  "const PREFIX = 'zeitspur-range-choice-v1-';": "const PREFIX = 'zeitspur-file-range-choice-v1-';",
  "new BroadcastChannel('zeitspur-events-v1')": "new BroadcastChannel('zeitspur-file-events-v1')",
};

const entries = (await readdir(join(root, 'src')))
  .filter(name => name.endsWith('.ts') && name !== 'pwa-updates.ts')
  .sort();
const modules = {};
for (const name of entries) {
  let code = await readFile(join(root, 'src', name), 'utf8');
  if (name === 'db.ts') code = replaceRequired(code, "const DATABASE = 'zeitspur-v1';", dbNames["const DATABASE = 'zeitspur-v1';"], 'IndexedDB name');
  if (name === 'range-preferences.ts') code = replaceRequired(code, "const PREFIX = 'zeitspur-range-choice-v1-';", dbNames["const PREFIX = 'zeitspur-range-choice-v1-';"], 'range preference prefix');
  if (name === 'main.ts') {
    code = replaceRequired(code, "new BroadcastChannel('zeitspur-events-v1')", dbNames["new BroadcastChannel('zeitspur-events-v1')"], 'BroadcastChannel name');
    code = code.replace(/<span>Version (\d+\.\d+(?:\.\d+)?)<\/span>/, '<span>Version $1 · Portable</span>');
  }
  const built = ts.transpileModule(code, {
    fileName: name,
    reportDiagnostics: true,
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, esModuleInterop: true },
  });
  if (built.diagnostics?.length) {
    const details = ts.formatDiagnosticsWithColorAndContext(built.diagnostics, {
      getCurrentDirectory: () => root, getCanonicalFileName: p => p, getNewLine: () => '\n',
    });
    throw new Error(`Failed to compile ${name}:\n${details}`);
  }
  // All script content must be safe to embed in a literal HTML script element.
  modules[`src/${name.replace(/\.ts$/, '.js')}`] = built.outputText.replace(/<\/script/gi, '<\\/script');
}

const wrappers = Object.entries(modules)
  .map(([id, js]) => `${JSON.stringify(id)}: function(require, module, exports) {\n${js}\n}`)
  .join(',\n');
const bundledScript = `(() => {
  'use strict';
  // Static module factory bundle: no eval(), Function(), or network imports.
  const factories = {${wrappers}};
  const cache = Object.create(null);
  function resolveRelative(base, request) {
    if (!request.startsWith('./') && !request.startsWith('../')) {
      throw new Error('Unexpected external import: ' + request);
    }
    const parts = base.split('/');
    parts.pop();
    for (const part of request.split('/')) {
      if (!part || part === '.') continue;
      if (part === '..') parts.pop(); else parts.push(part);
    }
    return parts.join('/');
  }
  function load(id) {
    if (cache[id]) return cache[id].exports;
    if (!Object.prototype.hasOwnProperty.call(factories, id)) {
      throw new Error('Missing embedded module: ' + id);
    }
    const module = {exports: {}};
    cache[id] = module;
    factories[id](dependency => load(resolveRelative(id, dependency)), module, module.exports);
    return module.exports;
  }
  load('src/main.js');
})();`;

let html = await readFile(join(root, 'index.html'), 'utf8');
const css = await readFile(join(root, 'src/styles.css'), 'utf8');
html = replaceRequired(html, '<link rel="stylesheet" href="./src/styles.css" />', `<style>\n${css.replace(/<\/style/gi, '<\\/style')}\n</style>`, 'stylesheet');
html = replaceRequired(html, '<script type="module" src="./src/main.ts"></script>', '', 'main entry');
html = replaceRequired(html, '<script type="module" src="./src/pwa-updates.ts"></script>', '', 'PWA entry');
html = html.replace(/\s*<link rel="manifest"[^>]*\/>/, '');
html = html.replace(/\s*<link rel="icon"[^>]*\/>/, '');
html = html.replace(/\s*<div id="update-banner"[\s\S]*?<\/div>\s*<\/div>/, '');
html = html.replace('<title>Zeitspur – Lokaler Time Tracker</title>', '<title>Zeitspur – Portable</title>');
html = replaceRequired(html, '</body>', `  <script>\n${bundledScript.replace(/<\/script/gi, '<\\/script')}\n  </script>\n</body>`, 'body end');

if (html.includes('src="./src/') || html.includes('href="./src/') || html.includes('manifest.webmanifest') || html.includes('sw.js')) {
  throw new Error('Portable output still references a PWA asset');
}

await mkdir(outputDir, { recursive: true });
await writeFile(join(outputDir, 'zeitspur.html'), html);
await writeFile(join(outputDir, 'README.txt'), `Zeitspur ${packageJSON.version} – Portable-Version\n\n` +
`1. ZIP entpacken.\n2. zeitspur.html im Browser öffnen (kein Webserver nötig).\n` +
`3. Timer, Historie, CSV und JSON-Backup wie gewohnt verwenden.\n\n` +
`Die Portable-Version lädt keine automatischen App-Updates und benötigt kein Internet.\n` +
`Zeiterfassungen werden im lokalen Browserprofil gespeichert, NICHT in der HTML-Datei.\n` +
`Wichtig: Vor Updates, Umbenennen oder Verschieben der Datei immer ein JSON-Backup erstellen.\n` +
`Je nach Browser können Datei-URLs unterschiedliche Speicherbereiche verwenden; ggf. Backup importieren.\n` +
`Das Dateiformat bleibt kompatibel zur regulären Zeitspur-PWA (JSON-Export/Import).\n` +
`Sensible Daten: HTML-Datei nur aus vertrauenswürdiger Quelle öffnen.\n\n` +
`Projekt: https://github.com/desirevolution/zeitspur\n`);
console.log(`Portable: ${join(outputDir, 'zeitspur.html')} (${Math.ceil(Buffer.byteLength(html)/1024)} KiB, ${entries.length} modules)`);
