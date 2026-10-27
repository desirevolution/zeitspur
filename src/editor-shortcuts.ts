/** One shortcut for documenting work: only stopped/open entries may be deferred. */
export type ShortcutMode = 'manual' | 'pending' | 'completed';
export type EditorShortcutAction = 'finish' | 'later' | 'invalid-time' | 'incomplete';

export function editorShortcutAction(mode: ShortcutMode, documentationComplete: boolean, timeValid: boolean): EditorShortcutAction {
  if (!timeValid) return 'invalid-time';
  if (documentationComplete) return 'finish';
  return mode === 'pending' ? 'later' : 'incomplete';
}
