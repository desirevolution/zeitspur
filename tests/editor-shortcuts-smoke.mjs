import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { editorShortcutAction } from '../dist/assets/editor-shortcuts.js';
const main = readFileSync(new URL('../src/main.ts', import.meta.url), 'utf8');
const i18n = readFileSync(new URL('../src/i18n.ts', import.meta.url), 'utf8');
const outcomes = [
  ['pending', true, true, 'finish'],
  ['pending', false, true, 'later'],
  ['pending', true, false, 'invalid-time'],
  ['pending', false, false, 'invalid-time'],
  ['manual', false, true, 'incomplete'],
  ['completed', false, true, 'incomplete'],
  ['manual', true, true, 'finish'],
  ['completed', true, true, 'finish'],
];
for (const [mode, complete, timeValid, expected] of outcomes) {
  assert.equal(editorShortcutAction(mode, complete, timeValid), expected, `${mode}/${complete}/${timeValid}`);
}
assert.match(main, /void deferEditor\(\)/);
assert.match(main, /await saveDeferredSession\(editingSession\.id, editingSession\.revision, editedValuesFromForm\(\)\)/);
assert.match(main, /data-shortcut-later hidden/);
assert.match(main, /finishHint\.hidden = action !== 'finish' \|\| finishButton\.disabled/);
assert.match(main, /laterHint\.hidden = action !== 'later'/);
assert.match(main, /syncPauseEditor\(\);\s+const action = currentShortcutAction\(\);/);
assert.doesNotMatch(main, /Nicht verfügbar/);
assert.match(i18n, /otherwise Later \(unfinished entries\)/);
console.log('PASS: adaptive Ctrl+Enter, disabled button hint and safety against invalid time');
