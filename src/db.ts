import type { CategorySuggestion, Session, Snapshot, Theme, LanguagePreference } from './types.js';
import { categoryKey, isCategoryList, removeCategory, useCategory } from './categories.js';

const DATABASE = 'zeitspur-v1';
const STORE_SESSIONS = 'sessions';
const STORE_SETTINGS = 'settings';

type StoredSetting = { key: string; value: unknown };
let pendingOpen: Promise<IDBDatabase> | null = null;

function request<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('Datenbank-Anfrage fehlgeschlagen'));
  });
}

function finished(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onabort = () => reject(tx.error ?? new Error('Datenbank-Transaktion abgebrochen'));
    tx.onerror = () => reject(tx.error ?? new Error('Datenbank-Fehler'));
  });
}

export function getDb(): Promise<IDBDatabase> {
  if (!pendingOpen) {
    pendingOpen = new Promise<IDBDatabase>((resolve, reject) => {
      const opener = indexedDB.open(DATABASE, 1);
      opener.onupgradeneeded = () => {
        const db = opener.result;
        if (!db.objectStoreNames.contains(STORE_SESSIONS)) db.createObjectStore(STORE_SESSIONS, { keyPath: 'id' });
        if (!db.objectStoreNames.contains(STORE_SETTINGS)) db.createObjectStore(STORE_SETTINGS, { keyPath: 'key' });
      };
      opener.onsuccess = () => {
        const db = opener.result;
        db.onversionchange = () => {
          db.close();
          pendingOpen = null;
        };
        resolve(db);
      };
      opener.onerror = () => reject(opener.error ?? new Error('Datenbank konnte nicht geöffnet werden'));
      opener.onblocked = () => reject(new Error('Datenbank durch anderen Tab blockiert'));
    }).catch((error: unknown) => {
      pendingOpen = null;
      throw error;
    });
  }
  return pendingOpen!;
}

async function transact<T>(
  mode: IDBTransactionMode,
  work: (sessions: IDBObjectStore, settings: IDBObjectStore) => Promise<T>,
): Promise<T> {
  const db = await getDb();
  const tx = db.transaction([STORE_SESSIONS, STORE_SETTINGS], mode);
  const commit = finished(tx);
  try {
    const value = await work(tx.objectStore(STORE_SESSIONS), tx.objectStore(STORE_SETTINGS));
    await commit;
    return value;
  } catch (error) {
    try { tx.abort(); } catch { /* already committed/aborted */ }
    await commit.catch(() => undefined);
    throw error;
  }
}

function savedCategories(record: StoredSetting | undefined): CategorySuggestion[] {
  if (!record) return [];
  if (!isCategoryList(record.value)) throw new Error('Gespeicherte Kategorien sind ungültig. Es wurden keine Daten überschrieben.');
  return record.value;
}

export async function snapshot(): Promise<Snapshot> {
  return transact('readonly', async (sessions, settings) => {
    const [list, active, theme, categories, categoryListExpanded, language] = await Promise.all([
      request<Session[]>(sessions.getAll()),
      request<StoredSetting | undefined>(settings.get('activeSessionId')),
      request<StoredSetting | undefined>(settings.get('theme')),
      request<StoredSetting | undefined>(settings.get('categories')),
      request<StoredSetting | undefined>(settings.get('categoryListExpanded')),
      request<StoredSetting | undefined>(settings.get('language')),
    ]);
    const themeValue = theme?.value;
    return {
      sessions: list,
      activeSessionId: typeof active?.value === 'string' ? active.value : null,
      language: language?.value === 'de' || language?.value === 'en' ? language.value : 'auto',
      theme: themeValue === 'dark' || themeValue === 'light' ? themeValue : 'system',
      categories: savedCategories(categories),
      categoryListExpanded: categoryListExpanded?.value === true,
    };
  });
}

export async function startTimer(): Promise<string> {
  return transact('readwrite', async (sessions, settings) => {
    const active = await request<StoredSetting | undefined>(settings.get('activeSessionId'));
    if (active?.value) throw new Error('Es läuft bereits eine Zeiterfassung in einem anderen Tab.');
    const now = Date.now();
    const id = crypto.randomUUID();
    const item: Session = {
      id, status: 'running', startedAt: now, stoppedAt: null,
      segments: [{ start: now, end: null }], category: null, description: null,
      createdAt: now, updatedAt: now, revision: 1,
    };
    await request(sessions.add(item));
    await request(settings.put({ key: 'activeSessionId', value: id }));
    return id;
  });
}

async function modifyActive(operation: 'pause' | 'resume' | 'stop'): Promise<string> {
  return transact('readwrite', async (sessions, settings) => {
    const active = await request<StoredSetting | undefined>(settings.get('activeSessionId'));
    if (typeof active?.value !== 'string') throw new Error('Es ist kein Timer aktiv.');
    const session = await request<Session | undefined>(sessions.get(active.value));
    if (!session) throw new Error('Aktiver Timer konnte nicht gefunden werden.');
    const now = Date.now();
    if (operation === 'pause') {
      if (session.status !== 'running') throw new Error('Dieser Timer läuft nicht.');
      const segment = session.segments.at(-1);
      if (!segment || segment.end !== null) throw new Error('Ungültiger Timerzustand.');
      segment.end = Math.max(segment.start, now);
      session.status = 'paused';
    } else if (operation === 'resume') {
      if (session.status !== 'paused') throw new Error('Dieser Timer ist nicht pausiert.');
      session.segments.push({ start: now, end: null });
      session.status = 'running';
    } else {
      if (session.status !== 'running' && session.status !== 'paused') throw new Error('Dieser Timer ist nicht aktiv.');
      if (session.status === 'running') {
        const segment = session.segments.at(-1);
        if (!segment || segment.end !== null) throw new Error('Ungültiger Timerzustand.');
        segment.end = Math.max(segment.start, now);
      }
      session.status = 'pending';
      session.stoppedAt = Math.max(session.startedAt, now);
      await request(settings.put({ key: 'activeSessionId', value: null }));
    }
    session.updatedAt = now;
    session.revision += 1;
    await request(sessions.put(session));
    return session.id;
  });
}

export const pauseTimer = () => modifyActive('pause');
export const resumeTimer = () => modifyActive('resume');
export const stopTimer = () => modifyActive('stop');

export async function saveDocumentation(id: string, rawCategory: string, rawDescription: string): Promise<void> {
  await transact('readwrite', async (sessions, settings) => {
    const session = await request<Session | undefined>(sessions.get(id));
    if (!session || (session.status !== 'pending' && session.status !== 'completed')) throw new Error('Eintrag ist nicht mehr bearbeitbar.');
    const description = rawDescription.trim();
    if (!rawCategory.trim() || !description) throw new Error('Kategorie und Beschreibung sind Pflichtfelder.');
    const current = await request<StoredSetting | undefined>(settings.get('categories'));
    const updated = useCategory(savedCategories(current), rawCategory, Date.now());
    session.category = updated.name;
    session.description = description;
    session.status = 'completed';
    session.updatedAt = Date.now();
    session.revision += 1;
    await request(sessions.put(session));
    await request(settings.put({ key: 'categories', value: updated.items }));
  });
}

export async function setLanguage(language: LanguagePreference): Promise<void> {
  if (!['auto', 'de', 'en'].includes(language)) throw new Error('Ungültige Sprachauswahl.');
  await transact('readwrite', async (_, settings) => {
    await request(settings.put({ key: 'language', value: language }));
  });
}

export async function setTheme(theme: Theme): Promise<void> {
  if (!['system', 'light', 'dark'].includes(theme)) throw new Error('Ungültiges Theme');
  await transact('readwrite', async (_, settings) => {
    await request(settings.put({ key: 'theme', value: theme }));
  });
}

// Operations introduced after the first POC: all changes remain atomic across tabs.
export async function saveEditedSession(id: string, expectedRevision: number, values: import('./records.js').EditValues): Promise<void> {
  const { buildEditedSession } = await import('./records.js');
  await transact('readwrite', async (sessions, settings) => {
    const current = await request<Session | undefined>(sessions.get(id));
    if (!current || current.revision !== expectedRevision) throw new Error('Der Eintrag wurde in einem anderen Tab geändert. Bitte erneut öffnen.');
    const categorySetting = await request<StoredSetting | undefined>(settings.get('categories'));
    const list = savedCategories(categorySetting);
    const edited = buildEditedSession(current, values);
    if (edited.status === 'completed' && edited.category) {
      const updated = useCategory(list, edited.category, Date.now());
      edited.category = updated.name;
      await request(settings.put({ key: 'categories', value: updated.items }));
    }
    await request(sessions.put(edited));
  });
}

export async function deleteEntry(id: string): Promise<Session> {
  return transact('readwrite', async (sessions, settings) => {
    const active = await request<StoredSetting | undefined>(settings.get('activeSessionId'));
    if (active?.value === id) throw new Error('Ein aktiver Timer darf nicht gelöscht werden.');
    const session = await request<Session | undefined>(sessions.get(id));
    if (!session) throw new Error('Eintrag wurde bereits gelöscht.');
    await request(sessions.delete(id));
    return session;
  });
}

export async function undoDeleteEntry(item: Session): Promise<void> {
  await transact('readwrite', async (sessions) => {
    const exists = await request<Session | undefined>(sessions.get(item.id));
    if (exists) throw new Error('Dieser Eintrag wurde bereits wiederhergestellt.');
    await request(sessions.add(item));
  });
}

export async function deleteDay(key: string, completedOnly = false): Promise<number> {
  const { dayBounds } = await import('./records.js');
  const bounds = dayBounds(key);
  return deleteRange(bounds.start, bounds.end, false, completedOnly);
}

export async function deleteWeek(weekStart: string, completedOnly = false): Promise<number> {
  const { dayBounds } = await import('./records.js');
  const { localWeekBounds } = await import('./time.js');
  const bounds = dayBounds(weekStart);
  const week = localWeekBounds(bounds.start);
  if (week.startKey !== weekStart) throw new Error('Datum ist kein Wochenbeginn (Montag).');
  return deleteRange(week.start, week.end, false, completedOnly);
}

/** Delete only recorded work inside the inclusive local calendar-date range. */
export async function deleteDateRange(from: string, to: string): Promise<number> {
  const { dayBounds } = await import('./records.js');
  if (from > to) throw new Error('Das Enddatum muss nach dem Startdatum liegen.');
  const first = dayBounds(from);
  const last = dayBounds(to);
  // Unlike historical day/week actions, settings deletion always requires a stopped timer.
  return deleteRange(first.start, last.end, true);
}

async function deleteRange(start: number, end: number, requireStopped = false, completedOnly = false): Promise<number> {
  const { cutRangeFromSession, intersectsRecordedSession } = await import('./records.js');
  return transact('readwrite', async (sessions, settings) => {
    const [all, active] = await Promise.all([
      request<Session[]>(sessions.getAll()), request<StoredSetting | undefined>(settings.get('activeSessionId')),
    ]);
    if (active?.value && (requireStopped || all.some((s) => s.id === active.value && intersectsRecordedSession(s, start, end)))) {
      throw new Error('Bitte den Timer vor dem Löschen dieses Zeitraums stoppen.');
    }
    let modified = 0;
    for (const session of all) {
      if (session.status === 'running' || session.status === 'paused' || (completedOnly && session.status !== 'completed') || !intersectsRecordedSession(session, start, end)) continue;
      const remaining = cutRangeFromSession(session, start, end);
      await request(sessions.delete(session.id));
      for (const item of remaining) await request(sessions.add(item));
      modified++;
    }
    return modified;
  });
}

export async function clearHistory(): Promise<number> {
  return transact('readwrite', async (sessions, settings) => {
    const active = await request<StoredSetting | undefined>(settings.get('activeSessionId'));
    if (active?.value) throw new Error('Vor dem Löschen der Historie bitte den Timer stoppen.');
    const count = await request(sessions.count());
    await request(sessions.clear());
    return count;
  });
}

export async function restoreBackup(data: { sessions: Session[]; theme: Theme; categories: CategorySuggestion[]; language?: LanguagePreference }): Promise<void> {
  await transact('readwrite', async (sessions, settings) => {
    const active = await request<StoredSetting | undefined>(settings.get('activeSessionId'));
    if (active?.value) throw new Error('Vor dem Wiederherstellen bitte den Timer stoppen.');
    await request(sessions.clear());
    for (const item of data.sessions) await request(sessions.add(item));
    await request(settings.put({ key: 'theme', value: data.theme }));
    await request(settings.put({ key: 'language', value: data.language ?? 'auto' }));
    await request(settings.put({ key: 'categories', value: data.categories }));
    await request(settings.put({ key: 'activeSessionId', value: null }));
  });
}

/** Explicit category removal, without changing historical time records. */
export async function deleteCategorySuggestion(categoryName: string): Promise<void> {
  if (!categoryKey(categoryName)) return;
  await transact('readwrite', async (_sessions, settings) => {
    const record = await request<StoredSetting | undefined>(settings.get('categories'));
    const existing = savedCategories(record);
    await request(settings.put({ key: 'categories', value: removeCategory(existing, categoryName) }));
  });
}

/** Local UI preference; independent of sessions and category data, no schema migration. */
export async function setCategoryListExpanded(expanded: boolean): Promise<void> {
  await transact('readwrite', async (_sessions, settings) => {
    await request(settings.put({ key: 'categoryListExpanded', value: expanded }));
  });
}
