import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildDeferredSession, getPauses } from '../dist/assets/records.js';
const main = readFileSync(new URL('../src/main.ts', import.meta.url), 'utf8');
const db = readFileSync(new URL('../src/db.ts', import.meta.url), 'utf8');
const start = new Date(2026, 9, 27, 9, 0).getTime();
const end = new Date(2026, 9, 27, 11, 0).getTime();
const current = {
  id: 'test-record', status: 'pending', startedAt: start, stoppedAt: end,
  segments: [{start, end}], category: null, description: null,
  createdAt: start, updatedAt: end, revision: 2,
};
const pause = {start: start + 40*60_000, end: start + 55*60_000};
const values = (category, description) => ({
  startedAt: start+5*60_000, stoppedAt: end-5*60_000, pauses: [pause], category, description,
});
for (const [category, description, expectedCategory, expectedDescription] of [
  ['Entwicklung', '', 'Entwicklung', null],
  ['', 'API optimiert', null, 'API optimiert'],
  ['Entwicklung', 'API optimiert', 'Entwicklung', 'API optimiert'],
  ['', '', null, null],
]) {
  const saved = buildDeferredSession(current, values(category, description), end+1000);
  assert.equal(saved.status, 'pending', 'Später must never finish, even with two filled fields');
  assert.equal(saved.category, expectedCategory);
  assert.equal(saved.description, expectedDescription);
  assert.equal(saved.startedAt, start+5*60_000);
  assert.equal(saved.stoppedAt, end-5*60_000);
  assert.deepEqual(getPauses(saved), [pause]);
  assert.equal(saved.revision, 3);
  assert.equal(current.revision, 2, 'Original snapshot must not be modified');
}
assert.throws(() => buildDeferredSession(current, {...values('A',''), startedAt: end+1}), /Ende muss nach/);
assert.throws(() => buildDeferredSession(current, {...values('A',''), pauses:[{start,end:end+1}]}), /Pausen/);
assert.throws(() => buildDeferredSession({...current,status:'completed'}, values('A','B')), /Nur offene Einträge/);
// Ensure both the stop dialog and the history editor use the same persistent save path.
assert.match(main, /session\.status === 'pending' && !isManual \? '<button type="button" class="button secondary" data-action="defer-editor"/);
assert.match(main, /await saveDeferredSession\(editingSession\.id, editingSession\.revision, editedValuesFromForm\(\)\)/);
assert.match(main, /void deferEditor\(\);/, 'mouse click and Ctrl+Enter must call the save operation');
assert.match(main, /if \(action === 'later'\) \{[\s\S]*?void deferEditor\(\)/);
assert.match(db, /const edited = defer \? buildDeferredSession\(current, values\) : buildEditedSession\(current, values\)/);
assert.match(db, /await request\(sessions\.put\(edited\)\)/);
assert.match(db, /current\.revision !== expectedRevision/);
console.log('PASS: Später persists any partially filled draft, dates and pauses; keeps it pending; protects revisions');
