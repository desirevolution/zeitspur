import assert from 'node:assert/strict';
import { selectedRange, deletionImpact } from '../dist/assets/ranges.js';
import { cutRangeFromSession, intersectsRecordedSession } from '../dist/assets/records.js';
import { createCsv } from '../dist/assets/transfers.js';
import { workingMilliseconds, groupSessionsByDay } from '../dist/assets/time.js';
const local = (year, month, day, hour = 0, minute = 0) => new Date(year, month - 1, day, hour, minute).getTime();
const session = (start, end, id = 'work') => ({
  id, status:'completed', startedAt: start, stoppedAt: end,
  segments: [{ start, end }], category: 'Arbeit', description: 'Erfassung',
  createdAt: start, updatedAt: end, revision: 1,
});
const until = selectedRange('custom', '2026-10-25', '2026-10-25');
assert.equal(until.start, local(2026, 10, 25));
assert.equal(until.end, local(2026, 10, 26));
assert.equal(until.end - until.start, 25 * 3600_000); // Berlin fall DST
assert.throws(() => selectedRange('custom', '', '2026-10-25'), /Beginn und Ende/);
assert.throws(() => selectedRange('custom', '2026-10-26', '2026-10-25'), /Enddatum/);
assert.throws(() => selectedRange('custom', '2026-02-31', '2026-03-01'), /Tagesdatum/);
const whole = selectedRange('all');
assert.equal(whole.start, -Infinity);
assert.equal(whole.end, Infinity);
const crossing = session(local(2026,10,24,23,0), local(2026,10,26,1,0));
const impact = deletionImpact([crossing], until);
assert.equal(impact.count,1);
assert.equal(impact.durationMs,25 * 3600_000);
const kept = cutRangeFromSession(crossing,until.start,until.end);
assert.equal(kept.length,2);
assert.equal(workingMilliseconds(kept[0]),60 * 60_000);
assert.equal(workingMilliseconds(kept[1]),60 * 60_000);
assert.deepEqual(groupSessionsByDay(kept).map(d=>d.key),['2026-10-26','2026-10-24']);
const zero = session(local(2026,10,25,13),local(2026,10,25,13),'zero');
assert.equal(intersectsRecordedSession(zero,until.start,until.end),true);
assert.equal(deletionImpact([zero],until).count,1);
assert(createCsv([zero],'2026-10-25','2026-10-25').includes('zero'));
const week = selectedRange('week','', '', local(2026,10,25,12));
assert.equal(week.from,'2026-10-19');
assert.equal(week.to,'2026-10-25');
assert.equal(week.end-week.start,169*3600_000);
const empty = deletionImpact([crossing],selectedRange('custom','2026-10-27','2026-10-28'));
assert.equal(empty.count,0);
console.log('PASS: arbitrary delete ranges, empty/custom validation, DST, partial work preservation, zero-length sessions');
