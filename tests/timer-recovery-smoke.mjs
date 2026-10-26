import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { restoreStoppedSession } from '../dist/assets/timer-recovery.js';
import { workingMilliseconds } from '../dist/assets/time.js';
const make = (status, segments, stoppedAt, revision=3) => ({
  id: 'same-id', status, startedAt: 1000, stoppedAt, segments,
  category: null, description: null, createdAt: 1000, updatedAt: 5000, revision,
});
const stoppedRunning = make('pending', [{start:1000,end:5000}],5000);
const resumed = restoreStoppedSession(stoppedRunning,'running',8000);
assert.equal(resumed.id,stoppedRunning.id);
assert.equal(resumed.status,'running');
assert.equal(resumed.stoppedAt,null);
assert.deepEqual(resumed.segments,[{start:1000,end:null}]);
assert.equal(resumed.revision,4);
assert.equal(workingMilliseconds(resumed,9000),8000, 'Cancel resumes continuous work without losing time');
assert.equal(stoppedRunning.segments[0].end,5000,'Restore must not mutate stopped input');
const stoppedPaused=make('pending',[{start:1000,end:4000}],5000);
const paused=restoreStoppedSession(stoppedPaused,'paused',8000);
assert.equal(paused.status,'paused');
assert.equal(paused.stoppedAt,null);
assert.deepEqual(paused.segments,[{start:1000,end:4000}]);
assert.equal(workingMilliseconds(paused,20000),3000,'Stopped while paused stays paused');
assert.throws(()=>restoreStoppedSession(make('completed',[{start:1000,end:5000}],5000),'running'),/zurückgesetzt/);
assert.throws(()=>restoreStoppedSession(make('pending',[{start:1000,end:4000}],5000),'running'),/unerwarteten Endzeitpunkt/);
const script=readFileSync(new URL('../src/main.ts', import.meta.url),'utf8');
assert.match(script,/if \(stoppedId\) editSession\(stoppedId, previousStatus\)/);
assert.match(script,/returnToStoppedTimer\(session\.id, session\.revision, stoppedFrom!\)/);
assert.match(script,/editorDialog\.addEventListener\('close'/);
assert.match(script,/documentationSaved = true;/);
assert.match(script,/documentationDeferred = true;/);
assert.match(script,/Zurück zum Timer/);
assert.match(script,/Später dokumentieren/);
assert.match(script,/if \(button && !busy\) editorDialog\.close\(\)/);
const db=readFileSync(new URL('../src/db.ts',import.meta.url),'utf8');
assert.match(db,/if \(active\?\.value\) throw new Error\('Ein anderer Timer ist bereits aktiv/);
assert.match(db,/session\.revision !== expectedRevision/);
assert.match(db,/const previousStatus: StoppedFrom = session.status/, 'Stop origin must come from atomic database state');
console.log('PASS: undo Stop returns to same running/paused timer, defer keeps stopped, concurrency guards');
