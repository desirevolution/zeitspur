import assert from 'node:assert/strict';
import { buildHistorySections, historyWeekMonthKey } from '../dist/assets/history-groups.js';

function ts(year, month, day) { return new Date(year, month - 1, day, 12).getTime(); }
function d(key, durationMs = 3_600_000) { return { key, durationMs, entries: [] }; }

// A week crossing Sep/Oct is assigned to October (Thursday = October 1).
const monday = ts(2026, 9, 28);
assert.equal(historyWeekMonthKey(monday), '2026-10');
// New Year crossing week is assigned to the Thursday's month (December 31).
assert.equal(historyWeekMonthKey(ts(2026, 12, 28)), '2026-12');

const now = ts(2026, 10, 26); // Monday
const sections = buildHistorySections([
  d('2026-10-26'), d('2026-10-25'), d('2026-10-19'),
  d('2026-10-12'), d('2026-10-01'), d('2026-09-30'),
  d('2026-09-10'), d('2026-08-30'), d('2025-12-31'),
], now);
assert.equal(sections.currentWeekKey, '2026-10-26');
assert.equal(sections.lastWeekKey, '2026-10-19');
assert.deepEqual(sections.recentWeeks.map(x => x.key), ['2026-10-26', '2026-10-19']);
assert.deepEqual(sections.currentMonthWeeks.map(x => x.key), ['2026-10-12', '2026-09-28']);
assert.deepEqual(sections.archivedMonths.map(x => x.key), ['2026-09', '2026-08', '2026-01']);
assert.equal(sections.archivedMonths[0].durationMs, 3_600_000);

// Every day belongs to one and only one week, and week days are never split over month groups.
const allWeeks = [
  ...sections.recentWeeks,
  ...sections.currentMonthWeeks,
  ...sections.archivedMonths.flatMap(x => x.weeks),
];
assert.equal(new Set(allWeeks.map(w => w.key)).size, allWeeks.length);
const allDays = allWeeks.flatMap(w => w.days.map(x => x.key));
assert.equal(new Set(allDays).size, 9);
assert.equal(allDays.length, 9);
assert.equal(sections.currentMonthWeeks[1].days.length, 2); // Sep 30 + Oct 1 in one week
assert.equal(allWeeks.reduce((sum, w) => sum + w.durationMs, 0), 9 * 3_600_000);

// Current week in a previous calendar month stays visible even at beginning of a new month.
const nov1 = buildHistorySections([d('2026-11-01'), d('2026-10-30')], ts(2026, 11, 1));
assert.equal(nov1.recentWeeks.length, 1);
assert.equal(nov1.recentWeeks[0].key, '2026-10-26');
assert.equal(nov1.archivedMonths.length, 0);

// Week boundaries are local calendar boundaries, even across a DST change.
const march = buildHistorySections([d('2026-03-29'), d('2026-03-30')], ts(2026, 3, 30));
assert.deepEqual(march.recentWeeks.map(w => w.key), ['2026-03-30', '2026-03-23']);
assert.equal(march.recentWeeks[1].days[0].key, '2026-03-29');
console.log('PASS: open/recent week selection, archive months, cross-month ownership, DST, no duplicate days');
