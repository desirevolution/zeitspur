import assert from 'node:assert/strict';
import { BACKUP_SHARE_FORMATS, CSV_SHARE_FORMATS, chooseShareableFile, isMobileSharePlatform } from '../dist/assets/file-share.js';
import { createBackup, parseBackup } from '../dist/assets/transfers.js';

const snapshot = { sessions: [], activeSessionId: null, theme: 'system', language: 'de', categories: [{ name: 'Entwicklung', lastUsedAt: 123 }] };
const data = JSON.stringify(createBackup(snapshot), null, 2);
const unavailable = { canShare: () => false, share: async () => {} };
assert.equal(chooseShareableFile('zeitspur-backup', data, BACKUP_SHARE_FORMATS, unavailable), null);
assert.equal(chooseShareableFile('zeitspur', 'a;b', CSV_SHARE_FORMATS, unavailable), null);
assert.equal(chooseShareableFile('zeitspur', 'a;b', CSV_SHARE_FORMATS, {}), null);

const calls = [];
const chromiumLike = {
  canShare: ({ files }) => files.length === 1 && ['text/plain', 'text/csv'].includes(files[0].type) && /\.(txt|csv)$/.test(files[0].name),
  share: (payload) => { calls.push(payload); return Promise.resolve(); },
};
const fallback = chooseShareableFile('zeitspur-backup-2026-10-26', data, BACKUP_SHARE_FORMATS, chromiumLike);
assert.equal(fallback?.name, 'zeitspur-backup-2026-10-26.txt');
assert.equal(fallback?.type, 'text/plain');
assert.deepEqual(parseBackup(JSON.parse(await fallback.text())).categories, snapshot.categories);
// Invoked directly, without awaited work between gesture and native share.
const transfer = chromiumLike.share({ files: [fallback], title: 'Zeitspur Backup' });
assert.equal(calls.length, 1);
assert.strictEqual(calls[0].files[0], fallback);
await transfer;

const acceptsJson = {
  canShare: ({ files }) => files[0].name.endsWith('.json') && files[0].type === 'application/json',
  share: async () => {},
};
const direct = chooseShareableFile('zeitspur-backup', data, BACKUP_SHARE_FORMATS, acceptsJson);
assert.equal(direct.name, 'zeitspur-backup.json');
assert.equal(direct.type, 'application/json');
assert.deepEqual(parseBackup(JSON.parse(await direct.text())).categories, snapshot.categories);
const bothSupported = {
  canShare: ({files}) => files.length === 1 && ['text/plain', 'application/json'].includes(files[0].type),
  share: async () => {},
};
assert.equal(chooseShareableFile('backup', data, BACKUP_SHARE_FORMATS, bothSupported).name, 'backup.txt', 'prefer text/plain even when browser claims .json support');
let examinedSize = -1;
const sizeSensitive = {
  canShare: ({ files }) => { examinedSize = files[0].size; return files[0].size < 10; },
  share: async () => {},
};
assert.notEqual(chooseShareableFile('backup', '{}', BACKUP_SHARE_FORMATS, sizeSensitive), null);
assert.equal(chooseShareableFile('backup', data, BACKUP_SHARE_FORMATS, sizeSensitive), null);
assert.ok(examinedSize > 10, 'canShare checks the real full backup, not a tiny probe');
const csv = chooseShareableFile('zeitspur-2026-10-26', 'a;b', CSV_SHARE_FORMATS, chromiumLike);
assert.equal(csv.name, 'zeitspur-2026-10-26.csv');
assert.equal(csv.type, 'text/csv');
const throwing = { canShare: ({files}) => { if (files[0].type === 'application/json') throw new Error('rejected'); return true; }, share: async () => {} };
assert.equal(chooseShareableFile('backup', data, BACKUP_SHARE_FORMATS, throwing).name, 'backup.txt');
console.log('PASS: CSV/file sharing, txt first, full-size canShare, import validation, missing support');

// UI shares files only on phones/tablets, even when desktop browsers expose share().
for (const desktop of [
  { userAgent: 'Mozilla/5.0 (X11; Linux x86_64; rv:158.0) Gecko/20100101 Firefox/158.0', platform: 'Linux x86_64' },
  { userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/140.0.0.0 Safari/537.36', platform: 'Linux x86_64' },
  { userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140.0.0.0 Safari/537.36', platform: 'Win32' },
  { userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 15_0) AppleWebKit/605.1.15 Safari/605.1.15', platform: 'MacIntel', maxTouchPoints: 0 },
]) assert.equal(isMobileSharePlatform(desktop), false, desktop.userAgent);
for (const mobile of [
  { userAgent: 'Mozilla/5.0 (Linux; Android 16; Pixel 8a) AppleWebKit/537.36 Chrome/140.0.0.0 Mobile Safari/537.36' },
  { userAgent: 'Mozilla/5.0 (Android 15; Mobile; rv:143.0) Gecko/143.0 Firefox/143.0' },
  { userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15' },
  { userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 15_0)', platform: 'MacIntel', maxTouchPoints: 5 },
  { userAgent: '', userAgentData: { mobile: true } },
]) assert.equal(isMobileSharePlatform(mobile), true, mobile.userAgent);
assert.equal(isMobileSharePlatform({ userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X)', platform: 'MacIntel', maxTouchPoints: 0, userAgentData: { mobile: false } }), false);
console.log('PASS: mobile only sharing (Android/iOS/iPadOS); Firefox/Chrome desktop hidden');
