import assert from 'node:assert/strict';
import { dateKey, formatClock, groupSessionsByDay, workingMilliseconds } from '../dist/assets/time.js';

const local = (year, month, day, hour, minute = 0) => new Date(year, month - 1, day, hour, minute).getTime();
function record(start, end, segments) {
  return {
    id: 'test-' + start,
    status: 'completed', startedAt: start, stoppedAt: end,
    segments, category: 'Test', description: 'Zeit',
    createdAt: start, updatedAt: end, revision: 1,
  };
}
assert.equal(formatClock(3661000), '01:01:01');
const start = local(2026, 10, 25, 23, 30);
const end = local(2026, 10, 26, 1, 0);
const crossing = record(start, end, [{ start, end }]);
const dayGroups = groupSessionsByDay([crossing]);
assert.equal(dayGroups.length, 2);
assert.equal(dayGroups.find((group) => group.key === '2026-10-25')?.durationMs, 30 * 60_000);
assert.equal(dayGroups.find((group) => group.key === '2026-10-26')?.durationMs, 60 * 60_000);
const withPause = record(start, end, [
  { start, end: local(2026, 10, 25, 23, 45) },
  { start: local(2026, 10, 26, 0, 30), end },
]);
assert.equal(workingMilliseconds(withPause), 45 * 60_000);
const pausedSplit = groupSessionsByDay([withPause]);
assert.equal(pausedSplit.find((group) => group.key === '2026-10-25')?.durationMs, 15 * 60_000);
assert.equal(pausedSplit.find((group) => group.key === '2026-10-26')?.durationMs, 30 * 60_000);
// 2026-03-29 has 23 clock hours and 2026-10-25 has 25 (Europe/Berlin).
const dstStart = record(local(2026, 3, 29, 0), local(2026, 3, 30, 0), [{ start: local(2026, 3, 29, 0), end: local(2026, 3, 30, 0) }]);
assert.equal(workingMilliseconds(dstStart), 23 * 3600_000);
assert.equal(groupSessionsByDay([dstStart])[0].durationMs, 23 * 3600_000);
const dstEnd = record(local(2026, 10, 25, 0), local(2026, 10, 26, 0), [{ start: local(2026, 10, 25, 0), end: local(2026, 10, 26, 0) }]);
assert.equal(workingMilliseconds(dstEnd), 25 * 3600_000);
assert.equal(groupSessionsByDay([dstEnd])[0].durationMs, 25 * 3600_000);
const running = record(1000, null, [{ start: 1000, end: null }]);
assert.equal(workingMilliseconds(running, 4000), 3000);
console.log('PASS: format, running elapsed, paused intervals, midnight split, Berlin 23h/25h DST');
