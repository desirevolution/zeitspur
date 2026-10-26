import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';

const root = new URL('../dist/', import.meta.url);
async function paths(folder = '', result = []) {
  const entries = await readdir(new URL(folder, root), { withFileTypes: true });
  for (const entry of entries) {
    const child = path.posix.join(folder, entry.name);
    if (entry.isDirectory()) await paths(child + '/', result);
    else if (!child.endsWith('.map') && !child.endsWith('sw.js') && !child.endsWith('sw.template.js')) result.push(child);
  }
  return result;
}
const entries = (await paths()).sort();
const digest = createHash('sha256');
for (const entry of entries) {
  digest.update(entry);
  digest.update(await readFile(new URL(entry, root)));
}
const hash = digest.digest('hex').slice(0, 12);
const template = await readFile(new URL('./sw.template.js', import.meta.url), 'utf8');
const files = ['index.html', ...entries.filter((name) => name !== 'index.html')].map((name) => './' + name);
await writeFile(new URL('sw.js', root), template.replace('__CACHE_NAME__', `zeitspur-poc-${hash}`).replace('__PRECACHE_ENTRIES__', JSON.stringify(files)));
console.log(`Offline worker generated with ${files.length} cached files`);
