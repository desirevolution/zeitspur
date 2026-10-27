import assert from 'node:assert/strict';
import { normalizeClock, shiftClock, addCalendarDay, dayChoice, durationValue, durationMinutes } from '../dist/assets/clock-input.js';
for (const [entry, expected] of [['9','09:00'],['930','09:30'],['1545','15:45'],['9:15','09:15'],['09:15','09:15'],['0','00:00'],['2359','23:59'],['9:3','09:03']]) {
  assert.equal(normalizeClock(entry),expected,`shortcut ${entry}`);
}
for (const invalid of ['24:00','2360','2500','9:999','-5','abc','12345','']) assert.equal(normalizeClock(invalid), null);
assert.equal(shiftClock('09:00',5),'09:05');
assert.equal(shiftClock('9',-5),'08:55');
assert.equal(shiftClock('23:59',5),null);
assert.equal(shiftClock('00:00',-15),null);
assert.equal(addCalendarDay('2026-10-25'),'2026-10-26');
assert.equal(addCalendarDay('2024-02-28'),'2024-02-29');
assert.equal(addCalendarDay('2026-12-31'),'2027-01-01');
assert.equal(dayChoice('2026-10-25','2026-10-25'),'same');
assert.equal(dayChoice('2026-10-25','2026-10-26'),'next');
assert.equal(dayChoice('2026-10-25','2026-10-27'),'other');
assert.equal(durationValue('90'),90);
assert.equal(durationValue('0'),0);
assert.equal(durationValue('-5'),null);
assert.equal(durationValue('1.5'),null);
const start = new Date(2026, 9, 25, 1, 30).getTime();
const end = start + 120 * 60000;
assert.equal(durationMinutes(start,end),120,'DST fallback duration is elapsed time');
const script = (await import('node:fs')).readFileSync(new URL('../dist/assets/main.js', import.meta.url),'utf8');
for (const pattern of ['id="entry-start-date"', 'id="entry-end-day"', 'id="entry-duration"', 'id="period-gross"', 'id="period-break-total"', 'id="period-net"', 'data-action="pick-time"']) {
  assert.ok(script.includes(pattern),`Editor is missing ${pattern}`);
}
console.log('PASS: clock shortcuts, minute steps, date rollover, DST elapsed duration, and editor features');
