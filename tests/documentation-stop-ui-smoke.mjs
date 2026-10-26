import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { workingMilliseconds, formatClock } from '../dist/assets/time.js';

const main = readFileSync(new URL('../src/main.ts', import.meta.url), 'utf8');
const style = readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8');
const i18n = readFileSync(new URL('../src/i18n.ts', import.meta.url), 'utf8');
const stopped = {
  status: 'pending',
  segments: [{ start: 10_000, end: 73_000 }],
  stoppedAt: 73_000,
};
assert.equal(formatClock(workingMilliseconds(stopped, 2_000_000)), '00:01:03', 'Stopped timer never advances after Stop');
assert.match(main, /stoppedPreviewSessionId = stopped\.id/,
  'Stop must activate the local preview from persisted data before refresh');
assert.match(main, /const displayed = session \?\? preview/,
  'Timer must prefer active session and otherwise show pending Stop preview');
assert.match(main, /displayed \? formatClock\(workingMilliseconds\(displayed\)\) : '00:00:00'/,
  'Background timer must retain elapsed time rather than resetting to zero');
assert.match(main, /stoppedPreviewSession\(\) \? formatClock\(workingMilliseconds\(stoppedPreviewSession\(\)!\)\)/,
  'Periodic clock updater must not clear the preview');
assert.match(main, /data-action="close-editor">\$\{canReturnToTimer \? 'Zurück' : 'Später'\}/,
  'Stop editor exposes Zurück button');
assert.match(main, /canReturnToTimer \? '<button type="button" class="button secondary" data-action="defer-editor">Später<\/button>'/,
  'Stop editor exposes Später as a button rather than a text link');
assert.match(main, /<button type="submit" class="button primary">Abschließen<\/button>/,
  'Stop editor exposes Abschließen as primary button');
assert.doesNotMatch(main, /class="editor-defer"/, 'No text-link deferral in the dialog');
assert.match(main, /if \(stoppedPreviewSessionId === session\.id\) stoppedPreviewSessionId = null/g,
  'Preview state must be removed when the editor exits');
assert.match(main, /if \(documentationDeferred\) void refresh\(\)/,
  'Deferral must update the background timer back to idle');
assert.match(main, /returnToStoppedTimer\(session\.id, session\.revision, stoppedFrom!\)/,
  'Back/Close/Escape continue to undo Stop');
assert.match(style, /#editor-dialog \.modal-actions \.button \{ padding: 10px 6px;/,
  'All three buttons fit in mobile action bar');
assert.match(i18n, /'Gestoppt': 'Stopped'/);
assert.match(i18n, /'Zurück': 'Back'/);
console.log('PASS: frozen stopped timer behind dialog, three action buttons, proper close semantics');
