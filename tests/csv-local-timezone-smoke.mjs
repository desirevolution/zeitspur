import assert from 'node:assert/strict';
import { formatLocalCsvTimestamp } from '../dist/assets/transfers.js';
// TZ=Asia/Kathmandu: local clock preserves the 45-minute difference without an offset suffix.
assert.equal(formatLocalCsvTimestamp(Date.parse('2026-10-26T08:00:00Z')), '2026-10-26 13:45:00');
console.log('PASS: 45-minute time-zone local clock, no offset in CSV');
