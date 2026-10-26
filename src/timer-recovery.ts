import type { Session } from './types.js';

export type StoppedFrom = 'running' | 'paused';

/** Undo the Stop transition without creating a second time entry.
 * A running timer keeps counting through the documentation dialog; an originally
 * paused timer remains paused. Caller must guard the active-session setting and
 * expected revision in a single IndexedDB transaction.
 */
export function restoreStoppedSession(session: Session, previousStatus: StoppedFrom, now = Date.now()): Session {
  if (session.status !== 'pending' || session.stoppedAt === null || !session.segments.length) {
    throw new Error('Die Zeiterfassung kann nicht zum Timer zurückgesetzt werden.');
  }
  const segments = session.segments.map(segment => ({ ...segment }));
  const last = segments.at(-1)!;
  if (last.end === null) throw new Error('Ungültiger Timerzustand.');
  if (previousStatus === 'running') {
    if (last.end !== session.stoppedAt) throw new Error('Der Timer hat einen unerwarteten Endzeitpunkt.');
    last.end = null;
  }
  return {
    ...session, status: previousStatus, stoppedAt: null, segments,
    updatedAt: now, revision: session.revision + 1,
  };
}
