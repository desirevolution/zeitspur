import assert from 'node:assert/strict';
import { buildEditedSession, cutDayFromSession, cutRangeFromSession, dayBounds, getPauses, intersectsWork } from '../dist/assets/records.js';
import { createBackup, createCsv, parseBackup } from '../dist/assets/transfers.js';
import { groupSessionsByDay, workingMilliseconds, localWeekBounds, presetRange } from '../dist/assets/time.js';
import { useCategory, removeCategory, isCategoryList, categoryKey } from '../dist/assets/categories.js';
const local = (year, month, day, hour, minute = 0) => new Date(year, month - 1, day, hour, minute).getTime();
const sample = (start, end, segments, id='id-a') => ({
  id, status: 'completed', startedAt:start, stoppedAt:end, segments,category:'Entwicklung',
  description:'Neue Komponente getestet',createdAt:start,updatedAt:end,revision:1,
});
const start = local(2026,10,24,23,30), end = local(2026,10,26,1), after = local(2026,10,26,0,30);
const session = sample(start,end,[{start, end:local(2026,10,25,0,15)},{start:after,end}]);
assert.equal(getPauses(session).length,1);
assert.equal(getPauses(session)[0].start,local(2026,10,25,0,15));
assert.equal(workingMilliseconds(session),75*60_000);
const truncated = cutDayFromSession(session,'2026-10-25');
assert.equal(truncated.length,2);
assert.notEqual(truncated[0].id,truncated[1].id);
const remainingDays=groupSessionsByDay(truncated);
assert.equal(remainingDays.length,2);
assert.equal(remainingDays.find(g=>g.key==='2026-10-24')?.durationMs,30*60_000);
assert.equal(remainingDays.find(g=>g.key==='2026-10-26')?.durationMs,30*60_000);
assert.equal(truncated.reduce((a,s)=>a+workingMilliseconds(s),0),60*60_000);
const onlyOtherDay = sample(local(2026,10,24,11),local(2026,10,24,12),[{start:local(2026,10,24,11),end:local(2026,10,24,12)}]);
assert.equal(intersectsWork(onlyOtherDay,...Object.values(dayBounds('2026-10-25'))),false);
assert.throws(()=>cutDayFromSession(session,'2026-02-30'),/Ungültiges/);
const revised = buildEditedSession(session,{
  startedAt:start, stoppedAt:end,pauses:[{start:local(2026,10,25,0,0),end:local(2026,10,25,0,30)}],
  category:'  EntWicklung ',description:' Aktualisierung '
});
assert.equal(revised.status,'completed');
assert.equal(revised.category,'EntWicklung');
assert.equal(workingMilliseconds(revised),26*3600_000); // 25th was 25h, total 26.5h minus pause
assert.throws(()=>buildEditedSession(session,{startedAt:start,stoppedAt:end,pauses:[{start:start,end:after},{start:local(2026,10,25,0),end:end}],category:'A',description:'B'}),/Pausen/);
assert.equal(buildEditedSession(session,{startedAt:start,stoppedAt:end,pauses:[],category:'',description:''}).status,'pending');
const csv=createCsv([session], '2026-10-25','2026-10-25');
assert.equal(csv.match(/id-a/g)?.length,1);
assert.equal(csv.split('\r\n').length,3);
assert(!createCsv([session], '2026-10-27','2026-10-27').includes('id-a'));
assert.throws(()=>createCsv([session],'2026-10-26','2026-10-25'),/Enddatum/);
const formula = sample(start,end,[{start,end}]);formula.description='=SUM(A1:A2)';
assert(createCsv([formula]).includes("'\u003dSUM"));
const state={sessions:[session],activeSessionId:null,theme:'dark', categories: [{ name: 'Entwicklung', lastUsedAt: end }]};
const backup=createBackup(state,end+5000);
assert.deepEqual(parseBackup(JSON.parse(JSON.stringify(backup))).sessions,[session]);
assert.equal(parseBackup(backup).theme,'dark');
assert.throws(()=>parseBackup({format:'zeitspur-backup',version:1,sessions:[]}),/unterstütztes/);
const running = sample(start,null,[{start,end:null}]);running.status='running';running.updatedAt=start;
const frozen=parseBackup(createBackup({sessions:[running],activeSessionId:running.id,theme:'system', categories: []}, end));
assert.equal(frozen.sessions[0].status,'pending');
assert.equal(frozen.sessions[0].segments[0].end,end);
assert.equal(frozen.sessions[0].stoppedAt,end);
const overlapping=[session,{...session,id:'id-a'}];
assert.throws(()=>parseBackup(createBackup({sessions:overlapping,activeSessionId:null,theme:'system', categories: []},end)),/Doppelte/);
console.log('PASS: day deletion, midnight split, pausing/edit, CSV filter/escaping, backup/restore, frozen active timers');

const lastSunday = local(2026, 10, 25, 12);
const currentWeek = localWeekBounds(lastSunday);
assert.equal(currentWeek.startKey, '2026-10-19');
assert.equal(currentWeek.endKey, '2026-10-25');
assert.equal(currentWeek.end - currentWeek.start, (7 * 24 + 1) * 3600_000); // Berlin DST fall-back
assert.deepEqual(presetRange('week', lastSunday), { from: '2026-10-19', to: '2026-10-25' });
assert.deepEqual(presetRange('last-week', lastSunday), { from: '2026-10-12', to: '2026-10-18' });
assert.deepEqual(presetRange('month', lastSunday), { from: '2026-10-01', to: '2026-10-31' });
assert.deepEqual(presetRange('last-month', lastSunday), { from: '2026-09-01', to: '2026-09-30' });
assert.deepEqual(presetRange('all', lastSunday), {});
const fromWeek = local(2026,10,19,0);
const tillWeek = local(2026,10,26,0);
const aroundWeek = sample(local(2026,10,18,23,30), local(2026,10,26,1,0), [{
  start:local(2026,10,18,23,30), end:local(2026,10,26,1,0)
}]);
const keepWeekEdges = cutRangeFromSession(aroundWeek,fromWeek,tillWeek);
assert.equal(keepWeekEdges.length,2);
assert.equal(workingMilliseconds(keepWeekEdges[0]),30*60_000);
assert.equal(workingMilliseconds(keepWeekEdges[1]),60*60_000);
assert.deepEqual(groupSessionsByDay(keepWeekEdges).map(g=>g.key),['2026-10-26','2026-10-18']);
// Categories are independent of recorded work and survive a cleared history.
const first = useCategory([], '  Entwicklung  ', end);
assert.equal(first.name, 'Entwicklung');
const second = useCategory(first.items, 'entwicklung', end + 1000);
assert.equal(second.name, 'Entwicklung');
assert.equal(second.items.length, 1);
const third = useCategory(second.items, 'Meeting', end + 2000);
assert.deepEqual(third.items.map(x => x.name), ['Meeting', 'Entwicklung']);
const noSessionsBackup = createBackup({...state, sessions: [], categories: third.items}, end + 3000);
assert.deepEqual(parseBackup(noSessionsBackup).categories.map(x => x.name), ['Meeting', 'Entwicklung']);
const removed = removeCategory(third.items, '  MEETING  ');
assert.deepEqual(removed.map(x => x.name), ['Entwicklung']);
assert.equal(categoryKey('  ENTWICKLUNG  '), 'entwicklung');
assert.equal(isCategoryList(third.items), true);
assert.equal(isCategoryList([{name:'Test',lastUsedAt:123},{name:'test',lastUsedAt:124}]), false);
assert.throws(()=>parseBackup({...noSessionsBackup, categories:[{ name:'Test', lastUsedAt:'now' }]}), /Kategorien/);
assert.throws(()=>parseBackup({...noSessionsBackup, categories:undefined}), /Kategorien/);
assert.deepEqual(parseBackup({...noSessionsBackup, sessions:[]}).categories,third.items);
console.log('PASS: ISO weeks, 25h DST week, presets, week deletion, permanent category suggestions, backup v2');
