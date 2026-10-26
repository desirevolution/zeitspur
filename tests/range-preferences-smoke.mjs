import assert from 'node:assert/strict';
import { loadRangePreference, saveRangePreference } from '../dist/assets/range-preferences.js';
import { selectedRange } from '../dist/assets/ranges.js';

function memoryStorage() {
  const items = new Map();
  return {
    getItem: key => items.get(key) ?? null,
    setItem: (key, value) => items.set(key, value),
    items,
  };
}

const storage = memoryStorage();
const all = { preset: 'all', from: '', to: '' };
assert.deepEqual(loadRangePreference('export', storage), all);
assert.deepEqual(loadRangePreference('delete', storage), all);

// Choices are independent; changing a preset must preserve the previously entered dates.
saveRangePreference('export', { preset: 'custom', from: '2026-10-05', to: '2026-10-25' }, storage);
saveRangePreference('delete', { preset: 'last-week', from: '', to: '' }, storage);
assert.deepEqual(loadRangePreference('export', storage), { preset: 'custom', from: '2026-10-05', to: '2026-10-25' });
assert.deepEqual(loadRangePreference('delete', storage), { preset: 'last-week', from: '', to: '' });
saveRangePreference('export', { preset: 'week', from: '2026-10-05', to: '2026-10-25' }, storage);
assert.equal(loadRangePreference('export', storage).from, '2026-10-05');
assert.equal(loadRangePreference('export', storage).to, '2026-10-25');
assert.equal(loadRangePreference('delete', storage).preset, 'last-week');

// Relative preset meaning depends on the current date, not the date when it was saved.
const monday = selectedRange(loadRangePreference('export', storage).preset, '', '', new Date(2026, 9, 26, 11).getTime());
assert.equal(monday.from, '2026-10-26');
assert.equal(monday.to, '2026-11-01');

// Corrupted or stale storage must not prevent use of the settings dialog.
storage.setItem('zeitspur-range-choice-v1-export', '{bad-json');
assert.deepEqual(loadRangePreference('export', storage), all);
storage.setItem('zeitspur-range-choice-v1-export', JSON.stringify({ preset: 'wrong', from: '<script>', to: '2026-02-31' }));
assert.deepEqual(loadRangePreference('export', storage), all);
const denied = { getItem() { throw new Error('Denied'); }, setItem() { throw new Error('Denied'); } };
assert.deepEqual(loadRangePreference('delete', denied), all);
assert.doesNotThrow(() => saveRangePreference('delete', { preset: 'custom', from: '2026-10-03', to: '2026-10-04' }, denied));

// A custom range remains selected even when the user has not completed both dates.
saveRangePreference('delete', { preset: 'custom', from: '2026-10-03', to: '' }, storage);
assert.deepEqual(loadRangePreference('delete', storage), { preset: 'custom', from: '2026-10-03', to: '' });
assert.throws(() => selectedRange('custom', loadRangePreference('delete', storage).from, loadRangePreference('delete', storage).to), /Beginn und Ende/);

// Preferences belong to the local browser and are not added to the JSON backup.
const { createBackup } = await import('../dist/assets/transfers.js');
const backup = createBackup({ sessions: [], activeSessionId: null, theme: 'system', language: 'auto', categories: [], categoryListExpanded: false });
assert(!('rangePreferences' in backup));
assert(!('exportRange' in backup));
assert(!('deleteRange' in backup));
console.log('PASS: independent local ranges, remembered custom dates, rolling presets, invalid/unavailable storage, backup exclusion');
