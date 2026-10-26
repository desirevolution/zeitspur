import assert from 'node:assert/strict';
import { csvFileName, createCsv } from '../dist/assets/transfers.js';
import { chooseShareableFile, CSV_SHARE_FORMATS } from '../dist/assets/file-share.js';

const at = (y, m, d, h = 9) => new Date(y, m - 1, d, h).getTime();
const entry = (id, startedAt, stoppedAt, status = 'completed') => ({
  id, status, startedAt, stoppedAt, segments: [{ start: startedAt, end: stoppedAt }],
  category: 'Arbeit', description: 'Text', createdAt: startedAt, updatedAt: stoppedAt, revision: 1,
});
const early = entry('early', at(2026,9,12), at(2026,9,13));
const late = entry('late', at(2026,10,26), at(2026,10,27));
const pending = entry('pending', at(2026,9,11), at(2026,9,12), 'pending');
const running = entry('running', at(2026,1,1), null, 'running');
const paused = entry('paused', at(2026,1,2), null, 'paused');
const inputs = [late, early, running, pending, paused];
// The whole-history filename describes exactly those entries exported into CSV.
const name = csvFileName(inputs);
assert.equal(name, 'zeitspur-all-2026-09-11-to-2026-10-27.csv');
const csv = createCsv(inputs);
assert(csv.includes('"pending"') && csv.includes('"late"') && csv.includes('"early"'));
assert(!csv.includes('"running";') && !csv.includes('"paused";'));
assert.equal(csvFileName([running, paused], undefined, undefined, at(2026,10,26)), 'zeitspur-all-empty-2026-10-26.csv');
assert.equal(csvFileName([] ,undefined, undefined, at(2026,10,26)), 'zeitspur-all-empty-2026-10-26.csv');
assert.equal(csvFileName(inputs, '2026-10-01', '2026-10-31'), 'zeitspur-2026-10-01-to-2026-10-31.csv');
assert.equal(csvFileName([], '2026-11-01', '2026-11-30'), 'zeitspur-2026-11-01-to-2026-11-30.csv');
assert.equal(csvFileName(inputs, undefined, '2026-10-31'), 'zeitspur-start-to-2026-10-31.csv');
assert.equal(csvFileName(inputs, '2026-10-01'), 'zeitspur-2026-10-01-to-today.csv');
assert.throws(() => csvFileName(inputs,'2026-10-31','2026-10-01'), /Enddatum/);
// Whole entries can extend beyond a filtered range; filename signifies selection.
const crossing = entry('crossing', at(2026,9,30), at(2026,10,2));
assert(createCsv([crossing], '2026-10-01', '2026-10-01').includes('"crossing"'));
assert.equal(csvFileName([crossing], '2026-10-01', '2026-10-01'), 'zeitspur-2026-10-01-to-2026-10-01.csv');
// File names are always English, even when the UI language is German.
// Sharing receives exactly the same basename as downloading.
const shareHost = { canShare: ({files}) => files[0].name.endsWith('.csv'), share: async () => {} };
const shared = chooseShareableFile(name.replace(/\.csv$/, ''), csv, CSV_SHARE_FORMATS, shareHost);
assert.equal(shared.name, name);
for (const exportedName of [
  name,
  csvFileName([], undefined, undefined, at(2026,10,26)),
  csvFileName(inputs, '2026-10-01', '2026-10-31'),
  csvFileName(inputs, undefined, '2026-10-31'),
  csvFileName(inputs, '2026-10-01'),
]) {
  assert(!/(?:gesamt|bis|anfang|heute|leer)/.test(exportedName), `German token in CSV filename: ${exportedName}`);
}
console.log('PASS: CSV filenames use English tokens for all ranges, complete/empty history, and sharing');
