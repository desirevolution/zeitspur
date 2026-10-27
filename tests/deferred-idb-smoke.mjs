/** Tiny IndexedDB request/transaction shim for the real db.ts persistence path.
 * This is not a browser implementation; it checks atomic writes, status and revisions. */
import assert from 'node:assert/strict';
const stores = new Map();
function clone(value) { return value === undefined ? undefined : structuredClone(value); }
function request(tx, fn) {
  const req = {onsuccess: null, onerror: null, result: undefined, error: null};
  tx.queued++;
  queueMicrotask(() => {
    try { req.result = fn(); req.onsuccess?.(); }
    catch (error) { req.error = error; req.onerror?.(); tx.onerror?.(); }
    finally { tx.queued--; tx.scheduleFinish(); }
  });
  return req;
}
function transaction() {
  const tx = {
    queued: 0, completion: null, oncomplete: null, onabort: null, onerror: null,
    abort() { clearTimeout(this.completion); this.onabort?.(); },
    scheduleFinish() {
      clearTimeout(this.completion);
      if (!this.queued) this.completion = setTimeout(() => this.oncomplete?.(), 0);
    },
    objectStore(name) {
      const store = stores.get(name);
      assert(store, 'missing IDB store ' + name);
      const keyOf = value => name === 'sessions' ? value.id : value.key;
      return {
        get: key => request(tx, () => clone(store.get(key))),
        getAll: () => request(tx, () => [...store.values()].map(clone)),
        put: value => request(tx, () => { store.set(keyOf(value), clone(value)); return keyOf(value); }),
        add: value => request(tx, () => {
          const key = keyOf(value);
          if (store.has(key)) throw new Error('Duplicate primary key');
          store.set(key, clone(value)); return key;
        }),
      };
    },
  };
  tx.scheduleFinish();
  return tx;
}
globalThis.indexedDB = {
  open() {
    const req = {result:null, error:null, onsuccess:null, onerror:null, onupgradeneeded:null};
    setTimeout(() => {
      req.result = {
        objectStoreNames: {contains: name => stores.has(name)},
        createObjectStore: name => stores.set(name, new Map()),
        transaction,
        close() {},
        onversionchange: null,
      };
      req.onupgradeneeded?.();
      req.onsuccess?.();
    }, 0);
    return req;
  },
};
const { startTimer, stopTimer, snapshot, saveDeferredSession, saveEditedSession } = await import('../dist/assets/db.js');
const id = await startTimer();
await stopTimer();
let entry = (await snapshot()).sessions.find(s => s.id === id);
assert.equal(entry.status, 'pending');
const revisedStart = entry.startedAt;
const revisedEnd = entry.stoppedAt;
const stopRevision = entry.revision;
await saveDeferredSession(id, stopRevision, {
  startedAt: revisedStart, stoppedAt: revisedEnd, pauses:[],
  category: '  Planung  ', description: '',
});
let state = await snapshot();
entry = state.sessions.find(s => s.id === id);
assert.equal(entry.status, 'pending');
assert.equal(entry.category, 'Planung');
assert.equal(entry.description, null);
assert.equal(entry.revision, stopRevision+1);
assert.equal(state.categories[0].name, 'Planung');
const revision = entry.revision;
await assert.rejects(() => saveDeferredSession(id, stopRevision, {
  startedAt: revisedStart, stoppedAt: revisedEnd, pauses: [], category: 'Overwrite', description: 'Bad',
}), /anderen Tab/);
assert.equal((await snapshot()).sessions.find(s=>s.id===id).category, 'Planung');
await saveDeferredSession(id, revision, {
  startedAt: revisedStart, stoppedAt: revisedEnd, pauses: [],
  category: 'Planung', description: 'Aufgaben gesammelt',
});
entry = (await snapshot()).sessions.find(s => s.id === id);
assert.equal(entry.status, 'pending', 'An explicit Später must keep a complete entry pending');
assert.equal(entry.description, 'Aufgaben gesammelt');
await saveEditedSession(id, entry.revision, {
  startedAt: revisedStart, stoppedAt: revisedEnd, pauses: [],
  category: 'Planung', description: 'Aufgaben gesammelt',
});
entry = (await snapshot()).sessions.find(s => s.id === id);
assert.equal(entry.status, 'completed', 'Only Abschluss finishes the entry');
assert.equal(entry.description, 'Aufgaben gesammelt');
// Changing entry boundaries and pauses must also survive "Später", not only text fields.
const morning = new Date(2026, 9, 27, 9, 0).getTime();
const eleven = morning + 120*60_000;
stores.get('sessions').set('partial-break', {
  id:'partial-break', status:'pending', startedAt:morning, stoppedAt:eleven,
  segments:[{start:morning,end:eleven}], category:null,description:null,
  createdAt:morning,updatedAt:eleven,revision:1,
});
await saveDeferredSession('partial-break', 1, {
  startedAt:morning+10*60_000, stoppedAt:eleven-10*60_000,
  pauses:[{start:morning+30*60_000,end:morning+45*60_000}],
  category:'',description:'Erste Notizen',
});
const revised = (await snapshot()).sessions.find(s=>s.id==='partial-break');
assert.equal(revised.status, 'pending');
assert.equal(revised.description, 'Erste Notizen');
assert.equal(revised.category, null);
assert.equal(revised.startedAt, morning+10*60_000);
assert.equal(revised.stoppedAt, eleven-10*60_000);
assert.deepEqual(revised.segments, [
  {start:morning+10*60_000,end:morning+30*60_000},
  {start:morning+45*60_000,end:eleven-10*60_000},
]);
console.log('PASS: real IndexedDB save path, partial values, modified times and pauses, revisions, Später vs Abschließen');
