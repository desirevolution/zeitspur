import assert from 'node:assert/strict';
import { createBackup, createCsv, formatLocalCsvTimestamp, roundDurationMinutes } from '../dist/assets/transfers.js';

// TZ=Europe/Berlin: late October 2026 changes from UTC+02 to UTC+01.
const local = (year, month, day, hour, minute = 0) => new Date(year, month - 1, day, hour, minute).getTime();
const sample = (start, end, segments, overrides={}) => ({
  id: 'entry-123', status: 'completed', startedAt: start, stoppedAt: end, segments,
  category: 'Entwicklung', description: 'API geprüft', createdAt: start, updatedAt: end,
  revision: 1, ...overrides,
});
const header = '"id";"started_at";"stopped_at";"category";"description";"status";"paused_minutes";"worked_minutes"';

// Local clock values are exported without offsets; the repeated hour at DST end is intentionally indistinguishable in CSV.
assert.equal(formatLocalCsvTimestamp(Date.parse('2026-10-24T07:00:00Z')), '2026-10-24 09:00:00');
assert.equal(formatLocalCsvTimestamp(Date.parse('2026-10-26T08:00:00Z')), '2026-10-26 09:00:00');
assert.equal(formatLocalCsvTimestamp(Date.parse('2026-10-25T00:30:00Z')), '2026-10-25 02:30:00');
assert.equal(formatLocalCsvTimestamp(Date.parse('2026-10-25T01:30:00Z')), '2026-10-25 02:30:00');
assert.equal(formatLocalCsvTimestamp(Date.parse('2026-03-29T00:30:00Z')), '2026-03-29 01:30:00');
assert.equal(formatLocalCsvTimestamp(Date.parse('2026-03-29T01:30:00Z')), '2026-03-29 03:30:00');

// Positive durations are rounded half-up to full minutes, never exported as decimals.
for (const [milliseconds, expected] of [[0,0], [29_999,0], [30_000,1], [30_001,1], [89_999,1], [90_000,2], [90_001,2], [59 * 60_000 + 29_999,59], [59 * 60_000 + 30_000,60]]) {
  assert.equal(roundDurationMinutes(milliseconds), expected);
}

const start = local(2026,10,26,9,0);
const end = start + 61 * 60_000;
const a = sample(start, end, [{ start, end: start + 30 * 60_000 + 15_000 }, { start: start + 30 * 60_000 + 45_000, end }], {
  description: 'Besprechung; mit "Notizen"\nzweite Zeile',
});
const csv = createCsv([a]);
assert(csv.startsWith('\uFEFF' + header + '\r\n'));
assert(csv.endsWith('\r\n'));
assert(csv.includes('"2026-10-26 09:00:00";"2026-10-26 10:01:00"'));
assert(csv.includes('"completed";"1";"61"')); // 30 s break => 1 min, 60m30s work => 61 min
assert(csv.includes('"Besprechung; mit ""Notizen""\nzweite Zeile"'));
assert(!csv.includes('61000.000'));
assert(!csv.includes('Start_ISO'));
// Backups intentionally keep their precise UTC export timestamp and numeric epoch instants.
const backup = createBackup({ sessions: [a], theme:'system', categories:[], language:'de' }, Date.parse('2026-10-26T08:15:00Z'));
assert.equal(backup.exportedAt, '2026-10-26T08:15:00.000Z');
assert.equal(backup.sessions[0].startedAt, start);
assert(!/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(csv));
assert(!/[+-]0[12]:00"/.test(csv));

const pending = sample(start, end, [{start,end}], { id:'pending', status:'pending',category:null,description:null });
const live = sample(start, null, [{ start, end:null }], { id:'live',status:'running' });
const combined = createCsv([live,pending,a]);
assert(!combined.includes('"live"'));
assert(combined.includes('"pending"'));
assert(combined.includes('"";"";"pending"'));
assert.equal(combined.match(/"entry-123"/g)?.length,1);
assert.equal(createCsv([a], '2026-10-26','2026-10-26').match(/entry-123/g)?.length,1);
assert(!createCsv([a], '2026-10-25','2026-10-25').includes('entry-123'));
assert.throws(()=>createCsv([a],'2026-10-27','2026-10-26'),/Enddatum/);

console.log('PASS: English CSV header, BOM/semicolon, local clock without offsets incl. DST, half-up whole minutes, filters, escaping');
