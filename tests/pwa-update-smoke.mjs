import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';
const html = await readFile(new URL('../dist/index.html', import.meta.url), 'utf8');
const sw = await readFile(new URL('../dist/sw.js', import.meta.url), 'utf8');
assert.match(html, /<script type="module" src="\.\/assets\/pwa-updates\.js"><\/script>/);
assert.match(html, /id="update-banner"/);
assert.match(sw, /SKIP_WAITING/);
assert.match(sw, /cache: 'reload'/);
assert.doesNotMatch(sw, /await caches\.match\(req\)/);
await access(new URL('../dist/assets/pwa-updates.js', import.meta.url));

const banner = { hidden: true };
const reloadButton = new EventTarget();
reloadButton.disabled = false;
reloadButton.textContent = '';
const laterButton = new EventTarget();
const nodes = {
  '#update-banner': banner,
  '#update-apply': reloadButton,
  '#update-later': laterButton,
};
const events = [];
const waiting = { postMessage: message => events.push(message) };
const registration = new EventTarget();
registration.waiting = waiting;
registration.installing = null;
registration.update = async () => {};
const serviceWorker = new EventTarget();
serviceWorker.controller = {};
serviceWorker.register = async (url, options) => {
  assert.equal(url, './sw.js');
  assert.equal(options.updateViaCache, 'none');
  return registration;
};
let reloads = 0;
const fakeWindow = new EventTarget();
fakeWindow.location = { reload: () => reloads++ };
const fakeDocument = new EventTarget();
fakeDocument.querySelector = selector => nodes[selector] ?? null;
fakeDocument.hidden = false;
globalThis.window = fakeWindow;
globalThis.document = fakeDocument;
Object.defineProperty(globalThis, 'navigator', { value: { onLine: true, serviceWorker }, configurable: true });
await import('../dist/assets/pwa-updates.js');
fakeWindow.dispatchEvent(new Event('load'));
await new Promise(resolve => setTimeout(resolve, 0));
assert.equal(banner.hidden, false, 'new worker should show notice');
assert.equal(reloads, 0, 'no unrequested reload');
reloadButton.dispatchEvent(new Event('click'));
assert.deepEqual(events, [{ type: 'SKIP_WAITING' }]);
assert.equal(reloads, 0, 'reload must wait for activation');
serviceWorker.dispatchEvent(new Event('controllerchange'));
assert.equal(reloads, 1, 'reload occurs after activation');
console.log('PASS: separate bootstrap, update detection, explicit activation, single reload');
