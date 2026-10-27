import { clearHistory, deleteDateRange, deleteDay, deleteWeek, deleteEntry, deleteCategorySuggestion, pauseTimer, restoreBackup, resumeTimer, saveEditedSession, setTheme, setLanguage, setCategoryListExpanded, snapshot, startTimer, stopTimer, returnToStoppedTimer, undoDeleteEntry } from './db.js';
import { dateKey, formatClock, formatDayLabel, formatDuration, formatTime, groupSessionsByDay, localWeekBounds, presetRange, workingMilliseconds } from './time.js';
import type { Session, Snapshot, Theme, LanguagePreference } from './types.js';
import type { StoppedFrom } from './timer-recovery.js';
import { getPauses } from './records.js';
import { localPauseDate, localPauseTime, parsePausePoint, pauseDayOptions, suggestPause, validatePausePeriods } from './pause-editor.js';
import { validateEntryOrder, timeOneMinuteBefore, timeOneMinuteAfter } from './time-editor-validation.js';
import type { PausePeriod } from './pause-editor.js';
import { categoryKey, pickerCategories } from './categories.js';
import { missingDocumentationFields, documentationHint } from './editor-validation.js';
import { createBackup, createCsv, csvFileName, parseBackup } from './transfers.js';
import { BACKUP_SHARE_FORMATS, CSV_SHARE_FORMATS, chooseShareableFile, isMobileSharePlatform } from './file-share.js';
import { deletionImpact, selectedRange } from './ranges.js';
import { loadRangePreference, saveRangePreference } from './range-preferences.js';
import type { RangeContext, RangePreference } from './range-preferences.js';
import type { CsvPreset } from './time.js';
import { intlLocale, setUiLanguage, tr, translateUi } from './i18n.js';
import { buildHistorySections } from './history-groups.js';
import type { HistoryMonth, HistoryWeek } from './history-groups.js';
import type { DayGroup } from './types.js';

const app = document.querySelector<HTMLElement>('#app')!;
const editorDialog = document.querySelector<HTMLDialogElement>('#editor-dialog')!;
const settingsDialog = document.querySelector<HTMLDialogElement>('#settings-dialog')!;
const confirmDialog = document.querySelector<HTMLDialogElement>('#confirm-dialog')!;
const toastElement = document.querySelector<HTMLElement>('#toast')!;
const channel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('zeitspur-events-v1') : null;
let state: Snapshot = { sessions: [], activeSessionId: null, theme: 'system', language: 'auto', categories: [], categoryListExpanded: false };
let expandedDays = new Set<string>();
let collapsedDays = new Set<string>();
let expandedWeeks = new Set<string>();
let collapsedWeeks = new Set<string>();
let expandedMonths = new Set<string>();
let busy = false;
let refreshSequence = 0;
let toastTimer: number | undefined;
let heroVisible = true;
// Only the locally opened Stop dialog keeps a frozen preview behind the modal.
// The timer itself has already been stopped and persisted in IndexedDB.
let stoppedPreviewSessionId: string | null = null;
function stoppedPreviewSession(): Session | undefined {
  return stoppedPreviewSessionId === null ? undefined : state.sessions.find(
    (item) => item.id === stoppedPreviewSessionId && item.status === 'pending',
  );
}
let visibilityObserver: IntersectionObserver | null = null;

const iconPaths: Record<string, string> = {
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  play: '<path d="m8 5 11 7-11 7z"/>',
  pause: '<rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/>',
  stop: '<rect x="6" y="6" width="12" height="12" rx="2"/>',
  settings: '<path d="M4 7h16M4 17h16"/><circle cx="9" cy="7" r="2" fill="currentColor" stroke="none"/><circle cx="15" cy="17" r="2" fill="currentColor" stroke="none"/>',
  arrow: '<path d="m7 17 10-10M9 7h8v8"/>',
  edit: '<path d="m15 5 4 4M3 21l4.5-1 12-12a2.1 2.1 0 0 0-3-3l-12 12z"/>',
  chevron: '<path d="m6 9 6 6 6-6"/>',
  close: '<path d="M6 6l12 12M18 6 6 18"/>',
  folder: '<path d="M3 7a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v10H3z"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
  trash: '<path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14M10 10v7M14 10v7"/>',
  download: '<path d="M12 3v13m-5-5 5 5 5-5M4 17v4h16v-4"/>',
  restore: '<path d="M12 3a9 9 0 1 1-8 5M3 3v6h6"/>',
  share: '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.7 10.6 6.6-4.1M8.7 13.4l6.6 4.1"/>',
};
function icon(name: string, size = 20): string {
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${iconPaths[name] ?? ''}</svg>`;
}
function escapeHtml(input: string): string {
  return input.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!);
}
function activeSession(): Session | undefined {
  return state.sessions.find((session) => session.id === state.activeSessionId);
}
function toast(message: string): void {
  window.clearTimeout(toastTimer);
  toastElement.textContent = tr(message);
  toastElement.hidden = false;
  toastTimer = window.setTimeout(() => { toastElement.hidden = true; }, 4200);
}
function undoToast(message: string, undo: () => Promise<void>): void {
  window.clearTimeout(toastTimer);
  toastElement.textContent = tr(message) + ' ';
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'toast-undo';
  button.textContent = tr('Rückgängig');
  toastElement.append(button);
  toastElement.hidden = false;
  button.addEventListener('click', () => {
    button.disabled = true;
    void undo().then(async () => {
      notifyChange();
      await refresh();
      toast('Eintrag wiederhergestellt.');
    }).catch(showError);
  }, { once: true });
  toastTimer = window.setTimeout(() => { toastElement.hidden = true; }, 9000);
}
interface ConfirmationOptions {
  title: string;
  description: string;
  confirmLabel: string;
  destructive?: boolean;
}
/** Consistent modal confirmation, also usable on top of the editor or settings dialog. */
function confirmAction({ title, description, confirmLabel, destructive = true }: ConfirmationOptions): Promise<boolean> {
  if (confirmDialog.open) return Promise.resolve(false);
  confirmDialog.innerHTML = `<div class="confirm-body">
    <div class="confirm-icon ${destructive ? 'confirm-icon-danger' : ''}">${icon(destructive ? 'trash' : 'info', 24)}</div>
    <h2 id="confirm-title"></h2><p id="confirm-description"></p>
    <form method="dialog" class="confirm-actions">
      <button class="button secondary" type="submit" value="cancel">Abbrechen</button>
      <button class="button ${destructive ? 'danger-confirm' : 'primary'}" type="submit" value="confirm" id="confirm-accept"></button>
    </form>
  </div>`;
  confirmDialog.querySelector<HTMLElement>('#confirm-title')!.textContent = tr(title);
  confirmDialog.querySelector<HTMLElement>('#confirm-description')!.textContent = tr(description);
  confirmDialog.querySelector<HTMLButtonElement>('#confirm-accept')!.textContent = tr(confirmLabel);
  confirmDialog.returnValue = 'cancel';
  return new Promise<boolean>((resolve) => {
    confirmDialog.addEventListener('close', () => resolve(confirmDialog.returnValue === 'confirm'), { once: true });
    translateUi(confirmDialog);
    confirmDialog.showModal();
  });
}
function downloadText(name: string, content: string, mime: string): void {
  const url = URL.createObjectURL(new Blob([content], { type: mime }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = name;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 30000);
}
function toLocalInput(time: number): string {
  const d = new Date(time);
  const two = (v: number) => String(v).padStart(2, '0');
  return `${d.getFullYear()}-${two(d.getMonth() + 1)}-${two(d.getDate())}T${two(d.getHours())}:${two(d.getMinutes())}:${two(d.getSeconds())}`;
}
function fromLocalInput(value: string, original: number): number {
  // Unchanged inputs retain original millisecond precision.
  if (value === toLocalInput(original)) return original;
  const parsed = new Date(value).getTime();
  if (!Number.isFinite(parsed)) throw new Error('Ungültiges Datum oder Uhrzeit.');
  return parsed;
}
function fromDateAndClock(datePart: string, clockPart: string, original: number): number {
  const previous = toLocalInput(original);
  if (datePart === previous.slice(0, 10) && clockPart === previous.slice(11, 16)) return original;
  const parsed = fromLocalInput(`${datePart}T${clockPart}:00`, original);
  if (toLocalInput(parsed).slice(0, 16) !== `${datePart}T${clockPart}`) throw new Error('Diese Uhrzeit existiert an diesem Datum nicht.');
  return parsed;
}
function applyTheme(theme: Theme): void {
  document.documentElement.dataset.theme = theme;
  document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')?.setAttribute('content', theme === 'light' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: light)').matches) ? '#f6f7f7' : '#12171b');
}
async function refresh(): Promise<void> {
  const sequence = ++refreshSequence;
  try {
    const next = await snapshot();
    if (sequence !== refreshSequence) return;
    state = next;
    setUiLanguage(state.language);
    updateUpdateBannerText();
    applyTheme(state.theme);
    render();
  } catch (error) {
    console.error(error);
    toast('Lokaler Speicher nicht verfügbar. Änderungen sind aktuell nicht möglich.');
    app.innerHTML = `<main class="fatal"><h1>Speicher nicht verfügbar</h1><p>Bitte prüfe die Browser-Einstellungen. Ohne lokale Speicherung kann kein Timer gestartet werden.</p><button class="button secondary" data-action="retry">Erneut versuchen</button></main>`;
    translateUi(app);
  }
}
function notifyChange(): void {
  channel?.postMessage({ type: 'changed' });
}
function updateUpdateBannerText(): void {
  const banner = document.querySelector<HTMLElement>('#update-banner');
  const title = banner?.querySelector<HTMLElement>('span');
  if (title) title.textContent = tr('Update verfügbar');
  const apply = document.querySelector<HTMLButtonElement>('#update-apply');
  if (apply && !apply.disabled) apply.textContent = tr('Aktualisieren');
  const later = document.querySelector<HTMLButtonElement>('#update-later');
  if (later) later.textContent = tr('Später');
}
function categorySuggestions(): string[] {
  return [...state.categories].sort((a, b) => b.lastUsedAt - a.lastUsedAt || a.name.localeCompare(b.name, intlLocale())).map(item => item.name);
}
/** UI-only hint for non-zero sessions shorter than the rounded minute. */
function displayListDuration(milliseconds: number): string {
  return milliseconds > 0 && milliseconds < 30_000 ? '< 1 min' : formatDuration(milliseconds);
}
function formatWeekDates(week: HistoryWeek): string {
  const start = new Date(week.start);
  const end = new Date(week.end - 1);
  const fmt = (value: Date) => new Intl.DateTimeFormat(intlLocale(), { day: 'numeric', month: 'short' }).format(value);
  return `${fmt(start)} – ${fmt(end)} ${end.getFullYear()}`;
}
/** One action per scope: no overflow menu or clipped popover is necessary. */
function deleteButton(scope: 'entry' | 'day' | 'week', id: string): string {
  const labels = { entry: 'Eintrag löschen', day: 'Tag löschen', week: 'Woche löschen' };
  const dataNames = { entry: 'id', day: 'day', week: 'week' };
  const label = labels[scope];
  return `<button class="icon-button delete-action" type="button" data-action="delete-${scope}" data-${dataNames[scope]}="${escapeHtml(id)}" aria-label="${label}" title="${label}">${icon('trash', 17)}</button>`;
}
function renderPending(): string {
  const pending = state.sessions.filter((s) => s.status === 'pending').sort((a, b) => (b.stoppedAt ?? 0) - (a.stoppedAt ?? 0));
  if (!pending.length) return '';
  return `<section class="section pending-section" aria-label="Offene Einträge">
    <div class="section-head"><h2>Offene Einträge <span class="count">${pending.length}</span></h2></div>
    <div class="pending-list">${pending.map((session) => `<div class="pending-item">
      <div class="pending-content"><strong>Nicht dokumentiert</strong><span>${escapeHtml(new Intl.DateTimeFormat(intlLocale(), { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(session.startedAt))}${workingMilliseconds(session) ? ` · ${escapeHtml(displayListDuration(workingMilliseconds(session)))}` : ''}</span></div>
      <button type="button" class="button outline small" data-action="edit" data-id="${session.id}">Ergänzen ${icon('arrow', 15)}</button>
      ${deleteButton('entry', session.id)}
    </div>`).join('')}</div></section>`;
}
function renderHistoryDay(day: DayGroup): string {
  const open = expandedDays.has(day.key) || (!collapsedDays.has(day.key) && day.key === dateKey(Date.now()));
  return `<article class="day-card">
    <div class="day-bar">
      <button class="day-head" type="button" data-action="toggle-day" data-day="${day.key}" aria-expanded="${open}" aria-controls="entries-${day.key}">
        <span class="day-label">${icon('chevron', 17)}<span>${escapeHtml(formatDayLabel(day.key))}</span><span class="day-count">${day.entries.length}</span></span>
        <strong class="duration">${escapeHtml(displayListDuration(day.durationMs))}</strong>
      </button>
      ${deleteButton('day', day.key)}
    </div>
    <div id="entries-${day.key}" class="day-entries" ${open ? '' : 'hidden'}>
      ${day.entries.map(({ session, dayMs }) => `<div class="history-row">
        <div class="history-details"><div class="history-title"><span translate="no">${escapeHtml(session.category ?? '—')}</span></div>
          ${session.description ? `<p>${escapeHtml(session.description)}</p>` : ''}
          <span class="history-meta">${formatTime(session.startedAt)} – ${session.stoppedAt ? formatTime(session.stoppedAt) : '…'}${dateKey(session.startedAt) !== dateKey(session.stoppedAt ?? session.startedAt) ? ' · über Mitternacht' : ''}</span></div>
        <span class="history-duration">${escapeHtml(displayListDuration(dayMs))}</span>
        <button class="icon-button edit-entry" type="button" data-action="edit" data-id="${session.id}" aria-label="Eintrag bearbeiten" title="Eintrag bearbeiten">${icon('edit', 17)}</button>
        ${deleteButton('entry', session.id)}
      </div>`).join('')}
    </div>
  </article>`;
}
function renderHistoryWeek(week: HistoryWeek, currentWeekKey: string, lastWeekKey: string): string {
  const open = expandedWeeks.has(week.key) || (week.key === currentWeekKey && !collapsedWeeks.has(week.key));
  const label = week.key === currentWeekKey ? 'Diese Woche' : week.key === lastWeekKey ? 'Letzte Woche' : `Woche vom ${new Intl.DateTimeFormat(intlLocale(), { day: '2-digit', month: '2-digit' }).format(week.start)}`;
  const entryCount = week.days.reduce((sum, day) => sum + day.entries.length, 0);
  return `<div class="week-group">
    <div class="week-bar">
      <button class="week-heading" type="button" data-action="toggle-week" data-week="${week.key}" aria-expanded="${open}" aria-controls="week-content-${week.key}">
        <span class="week-heading-text">${icon('chevron', 17)}<span class="week-title">${label}<small>${formatWeekDates(week)}</small></span></span>
        <span class="week-stats"><small>${entryCount} ${entryCount === 1 ? 'Eintrag' : 'Einträge'}</small><strong class="duration">${escapeHtml(displayListDuration(week.durationMs))}</strong></span>
      </button>
      ${deleteButton('week', week.key)}
    </div>
    <div class="week-content" id="week-content-${week.key}" ${open ? '' : 'hidden'}>
      <div class="days">${week.days.map(renderHistoryDay).join('')}</div>
    </div>
  </div>`;
}
function renderHistoryMonth(month: HistoryMonth, currentWeekKey: string, lastWeekKey: string): string {
  const open = expandedMonths.has(month.key);
  const [year, monthNumber] = month.key.split('-').map(Number);
  const label = new Intl.DateTimeFormat(intlLocale(), { month: 'long', year: 'numeric' }).format(new Date(year, monthNumber - 1, 1));
  return `<div class="month-group">
    <button class="month-heading" type="button" data-action="toggle-month" data-month="${month.key}" aria-expanded="${open}" aria-controls="month-content-${month.key}">
      <span class="month-title">${icon('chevron', 17)}<strong>${escapeHtml(label)}</strong></span>
      <span class="month-meta">${month.weeks.length} ${month.weeks.length === 1 ? 'Woche' : 'Wochen'} · ${formatDuration(month.durationMs)}</span>
    </button>
    <div class="month-content" id="month-content-${month.key}" ${open ? '' : 'hidden'}>
      ${month.weeks.map(week => renderHistoryWeek(week, currentWeekKey, lastWeekKey)).join('')}
    </div>
  </div>`;
}
function renderHistory(): string {
  // Pending items already have a dedicated completion workflow above the history.
  // Keep them in IndexedDB, exports and backups, but do not display them twice.
  const days = groupSessionsByDay(state.sessions.filter((session) => session.status === 'completed'));
  const groups = buildHistorySections(days);
  return `<section class="section history" aria-label="Historie">
    <div class="section-head"><h2>Historie</h2></div>
    ${days.length === 0 ? `<div class="empty"><span>Noch keine abgeschlossenen Einträge</span></div>` : `<div class="weeks">
      ${groups.recentWeeks.map(week => renderHistoryWeek(week, groups.currentWeekKey, groups.lastWeekKey)).join('')}
      ${groups.currentMonthWeeks.map(week => renderHistoryWeek(week, groups.currentWeekKey, groups.lastWeekKey)).join('')}
      ${groups.archivedMonths.map(month => renderHistoryMonth(month, groups.currentWeekKey, groups.lastWeekKey)).join('')}
    </div>`}
  </section>`;
}
function renderTimer(session: Session | undefined): string {
  const preview = session ? undefined : stoppedPreviewSession();
  const displayed = session ?? preview;
  const isPaused = session?.status === 'paused';
  const status = session ? (isPaused ? 'Pausiert' : 'Läuft') : preview ? 'Gestoppt' : 'Bereit';
  const stateClass = session ? (isPaused ? 'is-paused' : 'is-running') : preview ? 'is-stopped' : 'is-idle';
  return `<section id="timer-hero" class="timer-card ${stateClass}" aria-label="Zeiterfassung">
    <div class="timer-card-top"><span class="live-status"><span class="status-light"></span>${status}</span></div>
    <div class="timer-center"><div class="timer-display" data-clock>${displayed ? formatClock(workingMilliseconds(displayed)) : '00:00:00'}</div>
      ${displayed ? `<span class="timer-subtitle">Beginn ${formatTime(displayed.startedAt)}</span>` : ''}
    </div>
    <div class="timer-actions">${preview ? `<span class="timer-stopped-hint">${tr('Gestoppt')}</span>` : !session ? `<button type="button" class="button primary big" data-action="start">${icon('play', 20)} Start</button>` :
      `<button type="button" class="button secondary big" data-action="${isPaused ? 'resume' : 'pause'}">${icon(isPaused ? 'play' : 'pause', 19)} ${isPaused ? 'Weiter' : 'Pause'}</button>
       <button type="button" class="button stop big" data-action="stop">${icon('stop', 19)} Stop</button>`}
    </div>
  </section>`;
}

function render(): void {
  const session = activeSession();
  app.innerHTML = `<div class="page-wrap">
    <header class="site-header"><div class="identity"><a class="brand-mark brand-link" href="https://github.com/desirevolution/zeitspur" target="_blank" rel="noopener noreferrer" aria-label="Zeitspur auf GitHub öffnen (neuer Tab)" title="Zeitspur auf GitHub öffnen (neuer Tab)">${icon('clock', 28)}</a><div class="brand">zeitspur<span class="brand-dot">.</span></div></div>
      <div class="header-actions"><button class="icon-button settings-button" type="button" data-action="settings" aria-label="Einstellungen öffnen">${icon('settings', 21)}</button></div>
    </header>
    <main>${renderTimer(session)}${renderPending()}${renderHistory()}</main>
    <footer class="footer"><span>Version 0.33</span></footer>
  </div>
  <div class="mini-timer" id="mini-timer" ${session && !heroVisible ? '' : 'hidden'}><div class="mini-inner"><div class="mini-left"><span class="mini-status"></span><strong data-mini-clock>${session ? formatClock(workingMilliseconds(session)) : '00:00:00'}</strong><span>${session?.status === 'paused' ? 'Pausiert' : 'Timer läuft'}</span></div><button type="button" class="mini-jump" data-action="jump-to-timer">Zum Timer ${icon('arrow', 15)}</button></div></div>`;
  visibilityObserver?.disconnect();
  if (typeof IntersectionObserver !== 'undefined') {
    visibilityObserver = new IntersectionObserver(([entry]) => {
      heroVisible = entry.isIntersecting;
      const mini = document.querySelector<HTMLElement>('#mini-timer');
      if (mini) mini.hidden = !activeSession() || heroVisible;
    }, { threshold: 0.08 });
    visibilityObserver.observe(document.querySelector('#timer-hero')!);
  }
  updateClock();
  translateUi(app);
}
function updateClock(): void {
  const session = activeSession();
  const time = session ? formatClock(workingMilliseconds(session)) : stoppedPreviewSession() ? formatClock(workingMilliseconds(stoppedPreviewSession()!)) : '00:00:00';
  document.querySelectorAll<HTMLElement>('[data-clock], [data-mini-clock]').forEach((node) => {
    if (node.textContent !== time) node.textContent = time;
  });
}
/** Keep the mobile editor inside the *visible* viewport when the software keyboard opens.
 * interactive-widget=resizes-content covers supporting Android browsers; VisualViewport
 * handles visual-only viewport resizing (notably iOS/Safari). The footer remains outside
 * the scrolling form body, so actions never depend on scrolling past the keyboard.
 */
function monitorEditorViewport(): void {
  const mobile = window.matchMedia('(max-width: 650px)');
  const viewport = window.visualViewport;
  const scrollRegion = editorDialog.querySelector<HTMLElement>('#editor-scroll-region');
  if (!scrollRegion || !mobile.matches) return;

  let frame = 0;
  function revealFocusedField(): void {
    // With the keyboard open, give category suggestions the top of the scroll region
    // instead of only exposing the input while the suggestions remain below the fold.
    if (editorDialog.classList.contains('category-picking')) {
      const input = scrollRegion!.querySelector<HTMLElement>('#category');
      if (input) {
        const region = scrollRegion!.getBoundingClientRect();
        const rect = input.getBoundingClientRect();
        scrollRegion!.scrollTop += rect.top - region.top - 12;
      }
      return;
    }
    const focused = document.activeElement;
    if (!(focused instanceof HTMLElement) || !scrollRegion!.contains(focused)) return;
    const region = scrollRegion!.getBoundingClientRect();
    const field = focused.getBoundingClientRect();
    if (field.bottom > region.bottom - 14) scrollRegion!.scrollTop += field.bottom - region.bottom + 18;
    else if (field.top < region.top + 14) scrollRegion!.scrollTop -= region.top + 14 - field.top;
  }
  function applyViewport(): void {
    if (!editorDialog.open) return;
    if (viewport) {
      editorDialog.style.setProperty('--editor-viewport-height', `${viewport.height}px`);
      editorDialog.style.setProperty('--editor-viewport-top', `${Math.max(0, viewport.offsetTop)}px`);
    }
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(revealFocusedField);
  }
  function onFocus(): void {
    // The keyboard often resizes after focusin, especially in iOS PWAs.
    applyViewport();
  }
  function cleanup(): void {
    viewport?.removeEventListener('resize', applyViewport);
    viewport?.removeEventListener('scroll', applyViewport);
    window.removeEventListener('resize', applyViewport);
    editorDialog.removeEventListener('focusin', onFocus);
    cancelAnimationFrame(frame);
    editorDialog.style.removeProperty('--editor-viewport-height');
    editorDialog.style.removeProperty('--editor-viewport-top');
  }
  viewport?.addEventListener('resize', applyViewport);
  viewport?.addEventListener('scroll', applyViewport);
  window.addEventListener('resize', applyViewport);
  editorDialog.addEventListener('focusin', onFocus);
  editorDialog.addEventListener('close', cleanup, { once: true });
  applyViewport();
}

function editSession(id: string, stoppedFrom?: StoppedFrom): void {
  // A new editor starts in normal mode even if a previous editor was closed during typing.
  editorDialog.classList.remove('category-picking');
  const session = state.sessions.find((s) => s.id === id);
  if (!session || (session.status !== 'pending' && session.status !== 'completed')) return toast('Eintrag ist nicht mehr verfügbar.');
  const editingSession = session;
  // Only an editor opened directly by Stop can undo that Stop.
  const canReturnToTimer = session.status === 'pending' && stoppedFrom !== undefined;
  let documentationSaved = false;
  let documentationDeferred = false;
  const list = categorySuggestions();
  const pauseMarkup = (start: number, end: number, originalStart = -1, originalEnd = -1): string => `<div class="pause-row" data-pause-row data-original-start="${originalStart}" data-original-end="${originalEnd}">
    <div class="pause-row-head"><span class="pause-row-title">${tr('Pause')}</span><button type="button" class="icon-button" data-action="remove-pause" aria-label="${tr('Pause entfernen')}" title="${tr('Pause entfernen')}">${icon('trash', 17)}</button></div>
    <div class="pause-fields">
      <div class="pause-point"><label>${tr('Von')}<span class="pause-day-wrap" hidden></span><input class="pause-start" type="time" step="60" value="${localPauseTime(start)}" required></label></div>
      <div class="pause-point"><label>${tr('Bis')}<span class="pause-day-wrap" hidden></span><input class="pause-end" type="time" step="60" value="${localPauseTime(end)}" required></label></div>
    </div>
    <p class="pause-row-error" role="status" hidden></p>
    <input type="hidden" class="pause-start-date" value="${localPauseDate(start)}">
    <input type="hidden" class="pause-end-date" value="${localPauseDate(end)}">
  </div>`;
  editorDialog.innerHTML = `<form id="editor-form" class="modal-content" novalidate>
    <div class="modal-top"><div><h2 id="editor-title">${session.status === 'completed' ? 'Eintrag bearbeiten' : 'Zeit dokumentieren'}</h2></div><button type="button" class="icon-button" data-action="close-editor" aria-label="${canReturnToTimer ? tr('Zurück zum Timer') : tr('Schließen')}">${icon('close', 20)}</button></div>
    <div class="modal-body" id="editor-scroll-region">
    <div class="modal-summary"><span>${icon('clock', 18)} ${formatDuration(workingMilliseconds(session))}</span><span>${escapeHtml(new Intl.DateTimeFormat(intlLocale(), { weekday: 'short', day: 'numeric', month: 'short' }).format(session.startedAt))}</span></div>
    <div class="field-grid">
      <label class="field"><span>Beginn (Uhrzeit)</span><input id="entry-start-time" type="time" step="60" required aria-describedby="entry-range-error" value="${toLocalInput(session.startedAt).slice(11, 16)}" /></label>
      <label class="field"><span>Ende (Uhrzeit)</span><input id="entry-end-time" type="time" step="60" required aria-describedby="entry-range-error" value="${toLocalInput(session.stoppedAt ?? session.startedAt).slice(11, 16)}" /></label>
    </div>
    <p id="entry-range-error" class="entry-range-error" role="status" aria-live="polite" hidden></p>
    <details class="date-editor"><summary>Datum ändern <span class="date-summary">(nur bei Bedarf)</span></summary><div class="field-grid">
      <label class="field"><span>Startdatum</span><input id="entry-start-date" type="date" required value="${toLocalInput(session.startedAt).split('T')[0]}"></label>
      <label class="field"><span>Enddatum</span><input id="entry-end-date" type="date" required value="${toLocalInput(session.stoppedAt ?? session.startedAt).split('T')[0]}"></label>
    </div></details>
    <label class="field"><span>Kategorie <span class="required">*</span></span><input id="category" name="category" autocomplete="off" maxlength="90" required aria-describedby="category-error" placeholder="Kategorie eingeben oder auswählen" value="${escapeHtml(session.category ?? '')}" /><span id="category-error" class="field-error" hidden>Kategorie fehlt.</span></label>
    <div class="category-picker" id="category-picker">
      <div class="category-picker-head"><span id="category-list-label">Zuletzt verwendet</span><span class="category-count" id="category-count">${list.length} Kategorien</span></div>
      <div class="category-search" id="category-search-wrap" ${state.categoryListExpanded ? '' : 'hidden'}>
        <input id="category-search" type="search" placeholder="Kategorien durchsuchen" aria-label="Kategorien durchsuchen" autocomplete="off" />
      </div>
      <div id="category-options" class="category-options" aria-label="Kategorien auswählen"></div>
      <p class="category-new-hint" id="category-new-hint" hidden></p>
      <button type="button" class="category-expand-button" id="category-expand" data-action="expand-categories" aria-expanded="${state.categoryListExpanded}" aria-controls="category-search-wrap category-options">
        ${state.categoryListExpanded ? 'Weniger anzeigen' : 'Alle Kategorien anzeigen'} ${icon('chevron', 16)}
      </button>
    </div>
    <label class="field"><span>Beschreibung <span class="required">*</span></span><textarea id="description" name="description" rows="4" maxlength="2000" required aria-describedby="description-error" placeholder="Was hast du gemacht?">${escapeHtml(session.description ?? '')}</textarea><span id="description-error" class="field-error" hidden>Beschreibung fehlt.</span></label>
    <details class="pause-editor"><summary id="pause-summary">Pausen bearbeiten (${getPauses(session).length})</summary>
    <p class="modal-hint">Pausen werden von der gesamten Zeit abgezogen. Sie dürfen sich nicht überschneiden.</p>
    <p class="pause-scope" id="pause-scope" aria-live="polite"></p>
    <div id="pause-list">${getPauses(session).map(p => pauseMarkup(p.start, p.end, p.start, p.end)).join('')}</div>
    <button type="button" class="button outline small" data-action="add-pause">+ Pause hinzufügen</button></details>
    </div>
    <div class="editor-footer"><p class="editor-requirements" id="editor-requirements" role="status" aria-live="polite"></p>
      <div class="modal-actions">
        <button type="button" class="button secondary" data-action="close-editor">${canReturnToTimer ? 'Zurück' : 'Später'}</button>
        ${canReturnToTimer ? '<button type="button" class="button secondary" data-action="defer-editor">Später</button>' : ''}
        <button type="submit" class="button primary">Abschließen</button>
      </div></div>
  </form>`;
  translateUi(editorDialog);
  const form = editorDialog.querySelector<HTMLFormElement>('#editor-form')!;
  // X, Escape and "Zurück zum Timer" share the same non-destructive exit.
  // "Später dokumentieren" deliberately keeps the stopped entry pending.
  editorDialog.addEventListener('close', () => {
    if (!canReturnToTimer || documentationSaved || documentationDeferred) {
      if (stoppedPreviewSessionId === session.id) stoppedPreviewSessionId = null;
      // Deferring does not save the entry, so refresh the view explicitly.
      if (documentationDeferred) void refresh();
      return;
    }
    void (async () => {
      busy = true;
      try {
        await returnToStoppedTimer(session.id, session.revision, stoppedFrom!);
        notifyChange();
      } catch (error) {
        showError(error); // Stopped entry remains available for documentation.
      } finally {
        if (stoppedPreviewSessionId === session.id) stoppedPreviewSessionId = null;
        await refresh();
        const hero = document.querySelector<HTMLElement>('#timer-hero');
        hero?.scrollIntoView({ block: 'start', behavior: 'smooth' });
        hero?.querySelector<HTMLButtonElement>('button[data-action="pause"], button[data-action="resume"]')?.focus({ preventScroll: true });
        busy = false;
      }
    })();
  }, { once: true });
  const preventCancelDuringSave = (event: Event): void => {
    // Escape must not dismiss a dialog while IndexedDB is saving it.
    if (busy) event.preventDefault();
  };
  editorDialog.addEventListener('cancel', preventCancelDuringSave);
  editorDialog.addEventListener('close', () => {
    editorDialog.removeEventListener('cancel', preventCancelDuringSave);
  }, { once: true });
  form.querySelector<HTMLButtonElement>('button[data-action="defer-editor"]')?.addEventListener('click', () => {
    if (busy) return;
    documentationDeferred = true;
    editorDialog.close();
    toast('Eintrag kann später ergänzt werden.');
  });
  const categoryField = form.querySelector<HTMLInputElement>('#category')!;
  const categorySearch = form.querySelector<HTMLInputElement>('#category-search')!;
  const descriptionField = form.querySelector<HTMLTextAreaElement>('#description')!;
  const scrollRegion = form.querySelector<HTMLElement>('#editor-scroll-region')!;
  const footerHint = form.querySelector<HTMLElement>('#editor-requirements')!;
  const picker = form.querySelector<HTMLElement>('#category-picker')!;
  const isMobileEditor = window.matchMedia('(max-width: 650px)');
  let revealCategoryFrame = 0;
  function setCategoryPicking(active: boolean): void {
    if (!isMobileEditor.matches || !editorDialog.open) return;
    editorDialog.classList.toggle('category-picking', active);
    cancelAnimationFrame(revealCategoryFrame);
    if (active) revealCategoryFrame = requestAnimationFrame(() => {
      const region = scrollRegion.getBoundingClientRect();
      const input = categoryField.getBoundingClientRect();
      scrollRegion.scrollTop += input.top - region.top - 12;
    });
  }
  function isCategoryControl(element: Element | null): boolean {
    return element === categoryField || Boolean(element && picker.contains(element));
  }
  // The footer is useful when writing the description, but obstructs the suggestions
  // while the category keyboard is open. Hide it only during category interaction.
  form.addEventListener('focusin', (event) => {
    setCategoryPicking(isCategoryControl(event.target as Element));
  });
  form.addEventListener('focusout', () => {
    requestAnimationFrame(() => {
      if (editorDialog.open && !isCategoryControl(document.activeElement)) setCategoryPicking(false);
    });
  });
  editorDialog.addEventListener('close', () => {
    cancelAnimationFrame(revealCategoryFrame);
    editorDialog.classList.remove('category-picking');
  }, { once: true });
  let attemptedCompletion = false;
  let liveEntryError = '';
  let livePauseError = false;
  function updateEditorFooter(): void {
    const hint = documentationHint(categoryField.value, descriptionField.value);
    const notes = [liveEntryError ? tr(liveEntryError) : '', livePauseError ? tr('Bitte Pausenzeiten korrigieren.') : '', tr(hint)].filter(Boolean);
    footerHint.textContent = notes.join(' · ');
    footerHint.hidden = !notes.length;
    footerHint.classList.toggle('editor-has-time-error', Boolean(liveEntryError || livePauseError));
  }
  /** Only show red documentation errors after completion was attempted; time errors show immediately. */
  function updateDocumentationFeedback(): ('category' | 'description')[] {
    const missing = missingDocumentationFields(categoryField.value, descriptionField.value);
    for (const name of ['category', 'description'] as const) {
      const field = name === 'category' ? categoryField : descriptionField;
      const invalid = attemptedCompletion && missing.includes(name);
      field.setAttribute('aria-invalid', String(invalid));
      field.closest('.field')?.classList.toggle('field-invalid', invalid);
      form.querySelector<HTMLElement>(`#${name}-error`)!.hidden = !invalid;
    }
    updateEditorFooter();
    return missing;
  }
  function focusDocumentationField(field: HTMLInputElement | HTMLTextAreaElement): void {
    field.focus({ preventScroll: true });
    // Scroll only the editor body, not the fixed footer or the page behind the dialog.
    requestAnimationFrame(() => {
      if (!editorDialog.open) return;
      const region = scrollRegion.getBoundingClientRect();
      const rect = field.getBoundingClientRect();
      if (rect.bottom > region.bottom - 16) scrollRegion.scrollTop += rect.bottom - region.bottom + 20;
      else if (rect.top < region.top + 16) scrollRegion.scrollTop -= region.top + 16 - rect.top;
    });
  }
  let isExpanded = state.categoryListExpanded;
  function refreshPicker(): void {
    const draft = categoryField.value.trim();
    const available = pickerCategories(state.categories, draft, isExpanded, categorySearch.value);
    const matches = draft && list.some(name => categoryKey(name).includes(categoryKey(draft)));
    form.querySelector<HTMLElement>('#category-list-label')!.textContent = tr(isExpanded ? 'Alle Kategorien' : matches ? 'Passend & zuletzt verwendet' : 'Zuletzt verwendet');
    form.querySelector<HTMLElement>('#category-count')!.textContent = tr(`${list.length} ${list.length === 1 ? 'Kategorie' : 'Kategorien'}`);
    form.querySelector<HTMLElement>('#category-options')!.innerHTML = available.length
      ? available.map(name => `<button type="button" class="category-select ${categoryKey(name) === categoryKey(draft) ? 'selected' : ''}" data-action="use-category" data-category="${escapeHtml(name)}" aria-pressed="${categoryKey(name) === categoryKey(draft)}">${escapeHtml(name)}</button>`).join('')
      : `<span class="category-empty">${tr(list.length ? 'Keine Kategorien gefunden' : 'Noch keine Kategorien')}</span>`;
    const hint = form.querySelector<HTMLElement>('#category-new-hint')!;
    const isNew = Boolean(draft && !list.some(name => categoryKey(name) === categoryKey(draft)));
    hint.hidden = !isNew;
    if (isNew) hint.textContent = tr(`„${draft}“ wird beim Speichern als Kategorie angelegt.`);
    const toggle = form.querySelector<HTMLButtonElement>('#category-expand')!;
    toggle.hidden = list.length <= 5 && !isExpanded;
    toggle.setAttribute('aria-expanded', String(isExpanded));
    toggle.innerHTML = `${tr(isExpanded ? 'Weniger anzeigen' : 'Alle Kategorien anzeigen')} ${icon('chevron', 16)}`;
    form.querySelector<HTMLElement>('#category-search-wrap')!.hidden = !isExpanded;
  }
  // Pause editing uses only clock fields. Dates appear as separate choices only when
  // the surrounding entry crosses a calendar boundary (or a prior date is invalid).
  const pauseList = form.querySelector<HTMLElement>('#pause-list')!;
  const pauseScope = form.querySelector<HTMLElement>('#pause-scope')!;
  const addPauseButton = form.querySelector<HTMLButtonElement>('[data-action="add-pause"]')!;
  const finishButton = form.querySelector<HTMLButtonElement>('button[type="submit"]')!;
  const startDateField = form.querySelector<HTMLInputElement>('#entry-start-date')!;
  const endDateField = form.querySelector<HTMLInputElement>('#entry-end-date')!;
  const startTimeField = form.querySelector<HTMLInputElement>('#entry-start-time')!;
  const endTimeField = form.querySelector<HTMLInputElement>('#entry-end-time')!;
  const entryRangeFeedback = form.querySelector<HTMLElement>('#entry-range-error')!;
  const pauseRows = () => [...pauseList.querySelectorAll<HTMLElement>('[data-pause-row]')];
  function entryTimeConstraints(): void {
    // Browser pickers should not offer an inverted range on the same day.
    // Invalid keyboard input still gets a visible inline error rather than being silently changed.
    startDateField.max = endDateField.value || '';
    endDateField.min = startDateField.value || '';
    const sameDay = Boolean(startDateField.value && startDateField.value === endDateField.value);
    startTimeField.max = sameDay ? endTimeField.value : '';
    endTimeField.min = sameDay ? startTimeField.value : '';
  }
  function renderEntryRangeFeedback(message: string): void {
    liveEntryError = message;
    entryRangeFeedback.textContent = message ? tr(message) : '';
    entryRangeFeedback.hidden = !message;
    // Time pair is treated as one logical input; don't attribute a date error to text fields alone.
    const invalid = Boolean(message);
    for (const field of [startDateField, endDateField, startTimeField, endTimeField]) field.setAttribute('aria-invalid', String(invalid));
    const dateEditor = form.querySelector<HTMLElement>('.date-editor')!;
    dateEditor.classList.toggle('field-invalid', invalid && startDateField.value > endDateField.value);
    updateEditorFooter();
    finishButton.disabled = invalid || livePauseError;
  }
  function entryBounds(): { start: number; end: number } {
    const start = fromDateAndClock(form.querySelector<HTMLInputElement>('#entry-start-date')!.value, form.querySelector<HTMLInputElement>('#entry-start-time')!.value, editingSession.startedAt);
    const end = fromDateAndClock(form.querySelector<HTMLInputElement>('#entry-end-date')!.value, form.querySelector<HTMLInputElement>('#entry-end-time')!.value, editingSession.stoppedAt!);
    const error = validateEntryOrder(start, end);
    if (error) throw new Error(error);
    return { start, end };
  }
  function pointFields(row: HTMLElement, side: 'start' | 'end') {
    return {
      date: row.querySelector<HTMLInputElement>(`.pause-${side}-date`)!,
      time: row.querySelector<HTMLInputElement>(`.pause-${side}`)!,
      wrap: row.querySelector<HTMLElement>(`.pause-${side}`)!.closest('.pause-point')!.querySelector<HTMLElement>('.pause-day-wrap')!,
      original: Number(row.dataset[side === 'start' ? 'originalStart' : 'originalEnd'] ?? -1),
    };
  }
  function readPauseRow(row: HTMLElement): PausePeriod {
    const a = pointFields(row, 'start');
    const b = pointFields(row, 'end');
    return {
      start: parsePausePoint({ date: a.date.value, time: a.time.value, original: a.original }),
      end: parsePausePoint({ date: b.date.value, time: b.time.value, original: b.original }),
    };
  }
  function refreshPauseDayChoices(row: HTMLElement, side: 'start' | 'end', start: number, end: number): void {
    const point = pointFields(row, side);
    const first = localPauseDate(start);
    const last = localPauseDate(end);
    const show = first !== last || point.date.value !== first;
    point.wrap.hidden = !show;
    if (show) {
      const days = pauseDayOptions(start, end);
      const fieldLabel = tr('Tag');
      const chosen = point.date.value;
      // Up to 31 calendar days: an easy day dropdown. Longer entries: a date picker.
      if (days.length) {
        const options = chosen && !days.includes(chosen) ? [chosen, ...days] : days;
        point.wrap.innerHTML = `<select class="pause-day" aria-label="${fieldLabel}" required>${options.map(day => {
          const date = new Date(`${day}T12:00:00`);
          const label = Number.isFinite(date.getTime()) ? new Intl.DateTimeFormat(intlLocale(), { weekday: 'short', day: 'numeric', month: 'short' }).format(date) : day;
          return `<option value="${escapeHtml(day)}" ${chosen === day ? 'selected' : ''}>${escapeHtml(label)}</option>`;
        }).join('')}</select>`;
      } else {
        point.wrap.innerHTML = `<input class="pause-day" aria-label="${fieldLabel}" type="date" value="${escapeHtml(chosen)}" min="${first}" max="${last}" required>`;
      }
    } else {
      point.wrap.innerHTML = '';
    }
    // Native time constraints help avoid choices outside the entry, with exact
    // validation still applied to seconds and cross-day/order relationships.
    let min = point.date.value === first ? localPauseTime(start) : '';
    let max = point.date.value === last ? localPauseTime(end) : '';
    const otherSide = side === 'start' ? 'end' : 'start';
    const other = pointFields(row, otherSide);
    if (point.date.value === other.date.value && other.time.value) {
      const neighborLimit = side === 'start' ? timeOneMinuteBefore(other.time.value) : timeOneMinuteAfter(other.time.value);
      if (neighborLimit) {
        if (side === 'start') max = max && max < neighborLimit ? max : neighborLimit;
        else min = min && min > neighborLimit ? min : neighborLimit;
      }
    }
    // Impossible bounds (while the user edits an invalid pair) must not become
    // a native overnight time range; the inline error handles the intermediate state.
    point.time.min = min && max && min > max ? '' : min;
    point.time.max = min && max && min > max ? '' : max;
  }
  function syncPauseEditor(): boolean {
    entryTimeConstraints();
    const rows = pauseRows();
    form.querySelector<HTMLElement>('#pause-summary')!.textContent = tr(`Pausen bearbeiten (${rows.length})`);
    let bounds: { start: number; end: number };
    try {
      bounds = entryBounds();
    } catch (error) {
      renderEntryRangeFeedback(error instanceof Error ? error.message : 'Ungültiges Datum oder Uhrzeit.');
      pauseScope.textContent = tr('Bitte zuerst den Zeitraum korrigieren.');
      addPauseButton.disabled = true;
      // Existing break errors are not erased; changing the range alone must not fix them silently.
      livePauseError = false;
      finishButton.disabled = true;
      updateEditorFooter();
      return false;
    }
    renderEntryRangeFeedback('');
    const { start, end } = bounds;
    const format = (ts: number) => new Intl.DateTimeFormat(intlLocale(), { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(ts);
    pauseScope.textContent = `${tr('Zeitraum')}: ${format(start)} – ${format(end)}`;
    const values: PausePeriod[] = [];
    const parsingErrors: (string | null)[] = [];
    for (const row of rows) {
      for (const side of ['start', 'end'] as const) refreshPauseDayChoices(row, side, start, end);
      try {
        values.push(readPauseRow(row));
        parsingErrors.push(null);
      } catch (error) {
        values.push({ start: NaN, end: NaN });
        parsingErrors.push(error instanceof Error ? error.message : 'Ungültige Pausenzeit.');
      }
    }
    const errors = validatePausePeriods(start, end, values).map((error, i) => parsingErrors[i] ?? error);
    rows.forEach((row, i) => {
      const error = row.querySelector<HTMLElement>('.pause-row-error')!;
      error.textContent = errors[i] ? tr(errors[i]!) : '';
      error.hidden = !errors[i];
      row.classList.toggle('pause-invalid', Boolean(errors[i]));
      for (const time of row.querySelectorAll<HTMLInputElement>('input[type="time"]')) time.setAttribute('aria-invalid', String(Boolean(errors[i])));
    });
    livePauseError = errors.some(Boolean);
    // A new break needs at least one full minute of uncovered time; a zero-duration
    // entry or a work interval fully covered by breaks must never offer this action.
    addPauseButton.disabled = livePauseError || suggestPause(start, end, values) === null;
    finishButton.disabled = livePauseError;
    form.querySelector<HTMLElement>('#pause-summary')!.classList.toggle('summary-invalid', livePauseError);
    updateEditorFooter();
    return !livePauseError;
  }
  pauseList.addEventListener('change', (event) => {
    const field = event.target as HTMLInputElement | HTMLSelectElement;
    if (field.classList.contains('pause-day')) {
      const side = field.closest('.pause-point')!.querySelector<HTMLInputElement>('.pause-start') ? 'start' : 'end';
      pointFields(field.closest<HTMLElement>('[data-pause-row]')!, side).date.value = field.value;
    }
    syncPauseEditor();
  });
  pauseList.addEventListener('input', (event) => {
    const target = event.target as HTMLInputElement;
    if (target.classList.contains('pause-day')) {
      const side = target.closest('.pause-point')!.querySelector<HTMLInputElement>('.pause-start') ? 'start' : 'end';
      pointFields(target.closest<HTMLElement>('[data-pause-row]')!, side).date.value = target.value;
    }
    // Updating only after change for day controls avoids destroying the native dropdown mid-selection.
    if (!target.classList.contains('pause-day')) syncPauseEditor();
  });
  for (const id of ['entry-start-date', 'entry-end-date', 'entry-start-time', 'entry-end-time']) {
    form.querySelector(`#${id}`)!.addEventListener('change', syncPauseEditor);
    form.querySelector(`#${id}`)!.addEventListener('input', syncPauseEditor);
  }
  syncPauseEditor();
  refreshPicker();
  updateDocumentationFeedback();
  form.addEventListener('click', (event) => {
    const target = (event.target as HTMLElement).closest<HTMLButtonElement>('button[data-action]');
    if (target?.dataset.action === 'add-pause') {
      try {
        const { start, end } = entryBounds();
        const existing = pauseRows().map(readPauseRow);
        const proposal = suggestPause(start, end, existing);
        if (!proposal) return toast('Kein Platz für eine weitere Pause.');
        pauseList.insertAdjacentHTML('beforeend', pauseMarkup(proposal.start, proposal.end));
        form.querySelector<HTMLDetailsElement>('details.pause-editor')!.open = true;
        syncPauseEditor();
      } catch (error) { showError(error); }
    }
    if (target?.dataset.action === 'remove-pause') { target.closest('[data-pause-row]')?.remove(); syncPauseEditor(); }
    if (target?.dataset.action === 'use-category') {
      categoryField.value = target.dataset.category ?? '';
      categorySearch.value = '';
      // Close the expanded list after selection; keep the stored preference for next time.
      isExpanded = false;
      refreshPicker();
      updateDocumentationFeedback();
      setCategoryPicking(false);
      focusDocumentationField(descriptionField);
    }
    if (target?.dataset.action === 'expand-categories') {
      setCategoryPicking(true);
      isExpanded = !isExpanded;
      categorySearch.value = '';
      refreshPicker();
      // Save the explicit user's choice, not the automatic collapse after selection.
      state.categoryListExpanded = isExpanded;
      void setCategoryListExpanded(isExpanded).then(notifyChange).catch(showError);
      if (isExpanded && window.matchMedia('(hover: hover) and (pointer: fine)').matches) categorySearch.focus();
    }
  });
  categoryField.addEventListener('input', () => {
    refreshPicker();
    updateDocumentationFeedback();
    setCategoryPicking(true);
  });
  // Keyboard users can advance directly from a typed category to the description.
  categoryField.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && !event.isComposing) {
      event.preventDefault();
      focusDocumentationField(descriptionField);
    }
  });
  descriptionField.addEventListener('input', updateDocumentationFeedback);
  categorySearch.addEventListener('input', refreshPicker);
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (busy) return;
    attemptedCompletion = true;
    const missing = updateDocumentationFeedback();
    if (missing.length) {
      focusDocumentationField(missing[0] === 'category' ? categoryField : descriptionField);
      return;
    }
    if (!syncPauseEditor()) {
      const invalidRow = pauseRows().find(row => row.classList.contains('pause-invalid'));
      if (invalidRow) {
        form.querySelector<HTMLDetailsElement>('details.pause-editor')!.open = true;
        focusDocumentationField(invalidRow.querySelector<HTMLInputElement>('.pause-start')!);
      } else form.querySelector<HTMLInputElement>('#entry-start-time')?.focus();
      return;
    }
    if (!form.reportValidity()) return;
    busy = true;
    try {
      const start = fromDateAndClock(form.querySelector<HTMLInputElement>('#entry-start-date')!.value, form.querySelector<HTMLInputElement>('#entry-start-time')!.value, editingSession.startedAt);
      const end = fromDateAndClock(form.querySelector<HTMLInputElement>('#entry-end-date')!.value, form.querySelector<HTMLInputElement>('#entry-end-time')!.value, editingSession.stoppedAt!);
      const pauses = pauseRows().map(readPauseRow);
      await saveEditedSession(session.id, session.revision, {
        startedAt: start, stoppedAt: end, pauses,
        category: form.querySelector<HTMLInputElement>('#category')!.value,
        description: form.querySelector<HTMLTextAreaElement>('#description')!.value,
      });
      notifyChange();
      documentationSaved = true;
      editorDialog.close();
      await refresh();
      toast(session.status === 'pending' ? 'Zeiterfassung abgeschlossen.' : 'Eintrag gespeichert.');
    } catch (error) { showError(error); }
    finally { busy = false; }
  });
  editorDialog.showModal();
  monitorEditorViewport();
  if (session.status === 'pending' && window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
    window.setTimeout(() => form.querySelector<HTMLInputElement>('#category')?.focus(), 40);
  }
}
const RANGE_LABELS: { id: CsvPreset; label: string }[] = [
  { id: 'week', label: 'Diese Woche' },
  { id: 'last-week', label: 'Letzte Woche' },
  { id: 'month', label: 'Dieser Monat' },
  { id: 'last-month', label: 'Letzter Monat' },
  { id: 'custom', label: 'Zeitraum wählen' },
  { id: 'all', label: 'Gesamte Historie' },
];
function getPreset(prefix: RangeContext): CsvPreset {
  return settingsDialog.querySelector<HTMLInputElement>(`#${prefix}-preset`)!.value as CsvPreset;
}
function getSelection(prefix: RangeContext) {
  return selectedRange(
    getPreset(prefix),
    settingsDialog.querySelector<HTMLInputElement>(`#${prefix}-from`)!.value,
    settingsDialog.querySelector<HTMLInputElement>(`#${prefix}-to`)!.value,
  );
}
function hasNativeCsvShare(): boolean {
  return isMobileSharePlatform() && chooseShareableFile('zeitspur', 'a;b', CSV_SHARE_FORMATS) !== null;
}
function backupName(): string {
  return `zeitspur-backup-${dateKey(Date.now())}`;
}
function hasNativeBackupShare(): boolean {
  // Only a capability hint for rendering; the actual backup file (not a tiny
  // placeholder) is validated with canShare() when the user taps Share.
  return isMobileSharePlatform() && typeof navigator.share === 'function' && typeof navigator.canShare === 'function';
}
function backupShareFeedback(message: string): void {
  const feedback = settingsDialog.querySelector<HTMLElement>('#backup-share-feedback');
  if (feedback && settingsDialog.open) {
    feedback.textContent = tr(message);
    feedback.hidden = false;
    feedback.scrollIntoView({ block: 'nearest', behavior: 'auto' });
  } else toast(message);
}
function nativeShare(file: File, title: string, context: 'csv' | 'backup' = 'csv'): void {
  // Do not await any IndexedDB operation before navigator.share(): browsers
  // require transient user activation from the original button click.
  try {
    void navigator.share({ files: [file], title }).catch((error: unknown) => {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      console.error('Dateifreigabe fehlgeschlagen:', error);
      if (context === 'backup') backupShareFeedback('Backup-Teilen fehlgeschlagen. Bitte JSON-Backup herunterladen und über eine andere App teilen.');
      else toast('Datei konnte nicht geteilt werden. Bitte herunterladen.');
    });
  } catch (error) {
    console.error('Dateifreigabe fehlgeschlagen:', error);
    if (context === 'backup') backupShareFeedback('Backup-Teilen fehlgeschlagen. Bitte JSON-Backup herunterladen und über eine andere App teilen.');
    else toast('Datei konnte nicht geteilt werden. Bitte herunterladen.');
  }
}
function currentRangePreference(prefix: RangeContext): RangePreference {
  return {
    preset: getPreset(prefix),
    from: settingsDialog.querySelector<HTMLInputElement>(`#${prefix}-from`)!.value,
    to: settingsDialog.querySelector<HTMLInputElement>(`#${prefix}-to`)!.value,
  };
}
function rangePicker(prefix: RangeContext, preference: RangePreference): string {
  const defaultPreset = preference.preset;
  return `<div class="range-picker" role="group" aria-label="${prefix === 'delete' ? 'Löschzeitraum' : 'Exportzeitraum'}">
    <input type="hidden" id="${prefix}-preset" value="${defaultPreset}">
    <div class="range-grid">${RANGE_LABELS.map(({ id, label }) => `<button type="button" class="range-option ${id === 'custom' ? 'range-option-custom' : ''} ${id === 'all' ? 'range-option-all' : ''}" data-range-for="${prefix}" data-range-preset="${id}" aria-pressed="${id === defaultPreset}">${id === 'custom' ? icon('clock', 17) : ''}<span>${label}</span>${id === defaultPreset ? `<span class="range-selected-mark">${icon('check', 15)}</span>` : '<span class="range-selected-mark" hidden></span>'}</button>`).join('')}</div>
    <div id="${prefix}-custom" class="range-dates" hidden>
      <label class="field"><span>Von</span><input id="${prefix}-from" type="date" value="${preference.from}" aria-label="Von Datum"></label>
      <label class="field"><span>Bis</span><input id="${prefix}-to" type="date" value="${preference.to}" aria-label="Bis Datum"></label>
    </div>
    <p class="range-hint" id="${prefix}-range-hint" role="status" aria-live="polite"></p>
  </div>`;
}
function formatShortDate(key: string): string {
  const [year, month, day] = key.split('-').map(Number);
  return new Intl.DateTimeFormat(intlLocale(), { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(year, month - 1, day, 12));
}
function updateRangeUi(prefix: RangeContext): void {
  const preset = getPreset(prefix);
  settingsDialog.querySelector<HTMLElement>(`#${prefix}-custom`)!.hidden = preset !== 'custom';
  settingsDialog.querySelectorAll<HTMLButtonElement>(`[data-range-for="${prefix}"]`).forEach(button => {
    const selected = button.dataset.rangePreset === preset;
    button.setAttribute('aria-pressed', String(selected));
    const mark = button.querySelector<HTMLElement>('.range-selected-mark')!;
    mark.hidden = !selected;
    if (selected) mark.innerHTML = icon('check', 15);
  });
  const hint = settingsDialog.querySelector<HTMLElement>(`#${prefix}-range-hint`)!;
  const button = prefix === 'delete' ? settingsDialog.querySelector<HTMLButtonElement>('[data-action="delete-range"]') : null;
  try {
    const range = getSelection(prefix);
    const affected = deletionImpact(state.sessions, range);
    const dateLabel = range.from && range.to ? `${formatShortDate(range.from)} – ${formatShortDate(range.to)}` : tr('Alle Einträge');
    if (prefix === 'delete') {
      hint.textContent = tr(`${dateLabel} · ${affected.count} ${affected.count === 1 ? 'Eintrag' : 'Einträge'} · ${formatDuration(affected.durationMs)}`);
      if (button) {
        button.disabled = Boolean(state.activeSessionId) || affected.count === 0;
        button.innerHTML = `${icon('trash', 18)} ${tr(preset === 'all' ? 'Historie löschen' : 'Zeitraum löschen')}`;
      }
    } else {
      hint.textContent = dateLabel;
    }
  } catch (error) {
    hint.textContent = error instanceof Error ? error.message : 'Ungültiger Zeitraum';
    if (button) button.disabled = true;
  }
}
function renderSettingsCategories(): void {
  const query = categoryKey(settingsDialog.querySelector<HTMLInputElement>('#settings-category-search')?.value ?? '');
  const all = categorySuggestions();
  const filtered = query ? all.filter(name => categoryKey(name).includes(query)) : all;
  const count = settingsDialog.querySelector<HTMLElement>('#settings-category-count');
  const container = settingsDialog.querySelector<HTMLElement>('#settings-category-list');
  if (!count || !container) return;
  count.textContent = tr(`${all.length} ${all.length === 1 ? 'Kategorie' : 'Kategorien'}`);
  container.innerHTML = filtered.length
    ? filtered.map(name => `<div class="category-manage-row"><span>${escapeHtml(name)}</span><button type="button" class="category-remove-action" data-action="remove-stored-category" data-category="${escapeHtml(name)}" aria-label="Kategorie ${escapeHtml(name)} entfernen">${icon('trash', 17)} <span>Entfernen</span></button></div>`).join('')
    : `<p class="category-empty">${tr(all.length ? 'Keine Treffer' : 'Noch keine Kategorien')}</p>`;
  translateUi(container);
}
function showSettings(previousScrollTop = 0): void {
  const active = Boolean(state.activeSessionId);
  settingsDialog.innerHTML = `<div class="modal-content settings-content"><div class="modal-top settings-header"><h2 id="settings-title">Einstellungen</h2><button type="button" class="button primary settings-done" data-action="close-settings">Fertig</button></div>
    <div class="settings-scroll" id="settings-scroll-region">
    <h3 class="setting-heading">CSV-Export</h3>
    ${rangePicker('export', loadRangePreference('export'))}
    <div class="settings-action-row"><button class="button outline" type="button" data-action="export-csv">${icon('download', 18)} Herunterladen</button>
    ${hasNativeCsvShare() ? `<button class="button outline" type="button" data-action="share-csv">${icon('share', 18)} Teilen</button>` : ''}</div>
    <div class="settings-divider"></div><h3 class="setting-heading">Daten löschen</h3>
    ${rangePicker('delete', loadRangePreference('delete'))}
    <div class="settings-action-row"><button class="button outline danger-action" type="button" data-action="delete-range" ${active ? 'disabled' : ''}>${icon('trash', 18)} Zeitraum löschen</button></div>
    ${active ? '<p class="range-hint">Zum Löschen Timer zuerst stoppen.</p>' : ''}
    <div class="settings-divider"></div><h3 class="setting-heading">Kategorien</h3>
    <div class="category-settings">
      <input id="settings-category-search" type="search" placeholder="Kategorien durchsuchen" aria-label="Kategorien durchsuchen" autocomplete="off" />
      <div class="category-settings-count" id="settings-category-count"></div>
      <div class="category-manage-list" id="settings-category-list"></div>
      <p class="category-settings-hint">Entfernen löscht nur die Kategorie aus der Auswahl, keine Zeiterfassungen. Erneute Verwendung legt sie wieder an.</p>
    </div>
    <div class="settings-divider"></div><h3 class="setting-heading">Datensicherung</h3>
    <div class="settings-action-row"><button class="button outline" type="button" data-action="backup">${icon('download', 18)} JSON-Backup herunterladen</button>
    ${hasNativeBackupShare() ? `<button class="button outline" type="button" data-action="share-backup" title="JSON-Backup teilen (auf manchen Geräten als Textdatei)">${icon('share', 18)} JSON-Backup teilen</button>` : ''}
    <button class="button outline" type="button" data-action="select-restore" ${active ? 'disabled title="Timer vorher stoppen"' : ''}>${icon('restore', 18)} Wiederherstellen</button></div>
    <p id="backup-share-feedback" class="share-feedback" role="status" aria-live="polite" hidden></p>
    <input id="restore-file" type="file" accept=".json,.txt,application/json,text/plain" hidden />
    <div class="settings-divider"></div><div class="setting-row"><div><strong>Darstellung</strong></div>
      <div class="theme-options" role="group" aria-label="Darstellung wählen">${(['system', 'light', 'dark'] as const).map((theme) => `<button class="theme-option ${state.theme === theme ? 'selected' : ''}" type="button" data-action="set-theme" data-theme="${theme}" aria-pressed="${state.theme === theme}">${{ system: 'System', light: 'Hell', dark: 'Dunkel' }[theme]}</button>`).join('')}</div>
    </div>
    <div class="settings-divider"></div><div class="setting-row"><div><strong>Sprache</strong></div>
      <div class="theme-options language-options" role="group" aria-label="Sprache wählen">${(['auto', 'de', 'en'] as const).map((language) => `<button class="theme-option ${state.language === language ? 'selected' : ''}" type="button" data-action="set-language" data-language="${language}" aria-pressed="${state.language === language}">${{ auto: 'Automatisch', de: 'Deutsch', en: 'English' }[language]}</button>`).join('')}</div>
    </div>
    </div>
  </div>`;
  translateUi(settingsDialog);
  settingsDialog.querySelectorAll<HTMLButtonElement>('[data-range-for]').forEach(button => {
    button.addEventListener('click', () => {
      const prefix = button.dataset.rangeFor as RangeContext;
      settingsDialog.querySelector<HTMLInputElement>(`#${prefix}-preset`)!.value = button.dataset.rangePreset!;
      saveRangePreference(prefix, currentRangePreference(prefix));
      updateRangeUi(prefix);
      // The date inputs are intentionally not auto-focused on mobile, so the
      // browser date picker does not unexpectedly cover the preset controls.
    });
  });
  for (const prefix of ['export', 'delete'] as const) {
    settingsDialog.querySelectorAll<HTMLInputElement>(`#${prefix}-custom input`).forEach(input => {
      const persistAndUpdate = () => {
        saveRangePreference(prefix, currentRangePreference(prefix));
        updateRangeUi(prefix);
      };
      input.addEventListener('change', persistAndUpdate);
      input.addEventListener('input', persistAndUpdate);
    });
    updateRangeUi(prefix);
  }
  settingsDialog.querySelector<HTMLInputElement>('#settings-category-search')!.addEventListener('input', renderSettingsCategories);
  renderSettingsCategories();
  settingsDialog.querySelector<HTMLInputElement>('#restore-file')!.addEventListener('change', (event) => {
    const target = event.target as HTMLInputElement;
    const file = target.files?.[0];
    if (file) void importBackupFile(file);
    target.value = '';
  });
  settingsDialog.showModal();
  // Restoring the dialog after an immediate language/theme change should not
  // unexpectedly jump back to the top of the settings list.
  settingsDialog.querySelector<HTMLElement>('.settings-scroll')!.scrollTop = previousScrollTop;
}

async function importBackupFile(file: File): Promise<void> {
  if (busy) return;
  if (file.size > 25 * 1024 * 1024) return toast('Backup ist zu groß (maximal 25 MB).');
  busy = true;
  try {
    const raw: unknown = JSON.parse(await file.text());
    const parsed = parseBackup(raw);
    if (!await confirmAction({
      title: 'Backup wiederherstellen?',
      description: `Das Backup enthält ${parsed.sessions.length} Einträge. Es ersetzt alle derzeit gespeicherten Zeiterfassungen und Einstellungen. Lade bei Bedarf vorher ein Backup deiner aktuellen Daten herunter.`,
      confirmLabel: 'Daten ersetzen',
    })) return;
    await restoreBackup(parsed);
    notifyChange();
    settingsDialog.close();
    await refresh();
    toast(`${parsed.sessions.length} Einträge wiederhergestellt.`);
  } catch (error) { showError(error); }
  finally { busy = false; }
}
function showError(error: unknown): void {
  console.error(error);
  toast(error instanceof Error ? error.message : 'Ein unerwarteter Fehler ist aufgetreten.');
}
async function timerAction(action: string): Promise<void> {
  if (busy) return;
  busy = true;
  if (action === 'start' && navigator.storage?.persist) {
    // Best effort only; timer persistence must not depend on browser permission.
    void navigator.storage.persist().catch(() => false);
  }
  try {
    let stoppedId: string | undefined;
    let previousStatus: StoppedFrom | undefined;
    if (action === 'start') await startTimer();
    else if (action === 'pause') await pauseTimer();
    else if (action === 'resume') await resumeTimer();
    else if (action === 'stop') {
      const stopped = await stopTimer();
      stoppedId = stopped.id;
      previousStatus = stopped.previousStatus;
      // Keep the exact persisted Stop duration visible behind the editor.
      stoppedPreviewSessionId = stopped.id;
    }
    notifyChange();
    await refresh();
    if (stoppedId) editSession(stoppedId, previousStatus);
  } catch (error) {
    showError(error);
    await refresh();
  } finally { busy = false; }
}
app.addEventListener('click', (event) => {
  const button = (event.target as HTMLElement).closest<HTMLButtonElement>('button[data-action]');
  if (!button) return;
  const action = button.dataset.action;
  if (action === 'start' || action === 'pause' || action === 'resume' || action === 'stop') { void timerAction(action); return; }
  if (action === 'edit' && button.dataset.id) editSession(button.dataset.id);
  if (action === 'delete-entry' && button.dataset.id) {
    const id = button.dataset.id;
    void (async () => {
      if (busy || !await confirmAction({
        title: 'Eintrag löschen?',
        description: 'Die gesamte Zeiterfassung wird gelöscht – auch wenn sie sich über mehrere Tage erstreckt. Du kannst das Löschen anschließend 9 Sekunden lang rückgängig machen.',
        confirmLabel: 'Eintrag löschen',
      })) return;
      busy = true;
      try {
        const deleted = await deleteEntry(id);
        notifyChange();
        await refresh();
        undoToast('Eintrag gelöscht.', () => undoDeleteEntry(deleted));
      } catch (error) { showError(error); } finally { busy = false; }
    })();
  }
  if (action === 'delete-day' && button.dataset.day) {
    const key = button.dataset.day;
    void (async () => {
      if (busy || !await confirmAction({
        title: 'Tag löschen?',
        description: `Alle abgeschlossenen Arbeitszeiten am ${formatDayLabel(key)} werden entfernt. Offene Einträge bleiben bestehen. Bei Einträgen über Mitternacht bleiben die Anteile anderer Tage erhalten. Diese Aktion lässt sich nicht rückgängig machen.`,
        confirmLabel: 'Tag löschen',
      })) return;
      busy = true;
      try {
        const changed = await deleteDay(key, true);
        notifyChange();
        await refresh();
        toast(`${changed} Einträge für ${key} angepasst oder gelöscht.`);
      } catch (error) { showError(error); } finally { busy = false; }
    })();
  }
  if (action === 'delete-week' && button.dataset.week) {
    const weekStart = button.dataset.week;
    const bounds = localWeekBounds(new Date(`${weekStart}T12:00:00`).getTime());
    void (async () => {
      if (busy || !await confirmAction({
        title: 'Woche löschen?',
        description: `Alle abgeschlossenen Arbeitszeiten von ${bounds.startKey} bis ${bounds.endKey} werden entfernt. Offene Einträge und Arbeitszeit außerhalb dieser Woche bleiben erhalten. Diese Aktion lässt sich nicht rückgängig machen.`,
        confirmLabel: 'Woche löschen',
      })) return;
      busy = true;
      try {
        const changed = await deleteWeek(weekStart, true);
        notifyChange();
        await refresh();
        toast(`${changed} Einträge dieser Woche angepasst oder gelöscht.`);
      } catch (error) { showError(error); } finally { busy = false; }
    })();
  }
  if (action === 'settings') showSettings();
  if (action === 'retry') void refresh();
  if (action === 'jump-to-timer') document.querySelector('#timer-hero')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  if (action === 'toggle-week' && button.dataset.week) {
    const key = button.dataset.week;
    const currentlyOpen = expandedWeeks.has(key) || (key === localWeekBounds(Date.now()).startKey && !collapsedWeeks.has(key));
    if (currentlyOpen) { expandedWeeks.delete(key); collapsedWeeks.add(key); }
    else { collapsedWeeks.delete(key); expandedWeeks.add(key); }
    render();
  }
  if (action === 'toggle-month' && button.dataset.month) {
    const key = button.dataset.month;
    if (expandedMonths.has(key)) expandedMonths.delete(key);
    else expandedMonths.add(key);
    render();
  }
  if (action === 'toggle-day' && button.dataset.day) {
    const key = button.dataset.day;
    const currentlyOpen = expandedDays.has(key) || (key === dateKey(Date.now()) && !collapsedDays.has(key));
    if (currentlyOpen) { expandedDays.delete(key); collapsedDays.add(key); }
    else { collapsedDays.delete(key); expandedDays.add(key); }
    render();
  }
});
editorDialog.addEventListener('click', (event) => {
  const button = (event.target as HTMLElement).closest<HTMLButtonElement>('button[data-action="close-editor"]');
  if (button && !busy) editorDialog.close();
});
settingsDialog.addEventListener('click', (event) => {
  const button = (event.target as HTMLElement).closest<HTMLButtonElement>('button[data-action]');
  if (!button) return;
  if (button.dataset.action === 'close-settings') settingsDialog.close();
  if (button.dataset.action === 'remove-stored-category') {
    const category = button.dataset.category ?? '';
    void (async () => {
      const confirmed = await confirmAction({
        title: 'Kategorie entfernen?',
        description: `„${category}“ wird aus der Kategorienauswahl entfernt. Zeiterfassungen bleiben unverändert. Wird der Name später erneut verwendet, erscheint er wieder in der Auswahl.`,
        confirmLabel: 'Kategorie entfernen',
      });
      if (!confirmed) return;
      try {
        await deleteCategorySuggestion(category);
        notifyChange();
        await refresh();
        renderSettingsCategories();
        toast('Kategorie entfernt.');
      } catch (error) { showError(error); }
    })();
  }
  if (button.dataset.action === 'export-csv' || button.dataset.action === 'share-csv') {
    try {
      const { from, to } = getSelection('export');
      // Build synchronously from the loaded IndexedDB snapshot: navigator.share()
      // needs to be called within the original button activation, without await.
      const csv = createCsv(state.sessions, from, to);
      const name = csvFileName(state.sessions, from, to);
      if (button.dataset.action === 'share-csv') {
        if (!isMobileSharePlatform()) return;
        const file = chooseShareableFile(name.replace(/\.csv$/, ''), csv, CSV_SHARE_FORMATS);
        if (!file) {
          toast('CSV-Teilen wird hier nicht unterstützt. Bitte herunterladen.');
          return;
        }
        nativeShare(file, 'Zeitspur CSV');
      } else {
        downloadText(name, csv, 'text/csv;charset=utf-8');
        toast('CSV erstellt.');
      }
    } catch (error) { showError(error); }
  }
  if (button.dataset.action === 'delete-range') {
    void (async () => {
      if (busy) return;
      let range: ReturnType<typeof getSelection>;
      try { range = getSelection('delete'); } catch (error) { showError(error); return; }
      const preview = deletionImpact(state.sessions, range);
      if (!preview.count) { toast('Keine Einträge im gewählten Zeitraum.'); return; }
      const all = !range.from && !range.to;
      const scope = all ? 'die gesamte Historie' : `${range.from} bis ${range.to}`;
      const confirmed = await confirmAction({
        title: all ? 'Historie löschen?' : 'Zeitraum löschen?',
        description: `${preview.count} ${preview.count === 1 ? 'Eintrag' : 'Einträge'} betroffen (${formatDuration(preview.durationMs)} Arbeitszeit). Auswahl: ${scope}. ${all ? 'Alle Zeiterfassungen werden gelöscht. Gespeicherte Kategorien und Einstellungen bleiben erhalten.' : 'Arbeitszeit außerhalb des Zeitraums bleibt erhalten. Gespeicherte Kategorien bleiben erhalten.'} Kein Rückgängig möglich.`,
        confirmLabel: all ? 'Historie löschen' : 'Zeitraum löschen',
      });
      if (!confirmed || busy) return;
      busy = true;
      try {
        const count = all ? await clearHistory() : await deleteDateRange(range.from!, range.to!);
        notifyChange();
        settingsDialog.close();
        await refresh();
        toast(`${count} ${count === 1 ? 'Eintrag' : 'Einträge'} gelöscht oder angepasst.`);
      } catch (error) { showError(error); } finally { busy = false; }
    })();
  }
  if (button.dataset.action === 'backup') {
    void (async () => {
      try {
        const current = await snapshot();
        const backup = createBackup(current);
        downloadText(`${backupName()}.json`, JSON.stringify(backup, null, 2), 'application/json;charset=utf-8');
        toast('JSON-Backup erstellt.');
      } catch (error) { showError(error); }
    })();
  }
  if (button.dataset.action === 'share-backup') {
    if (!isMobileSharePlatform()) return;
    try {
      // state is the most recently loaded IndexedDB snapshot (also refreshed on
      // changes from other tabs). Construct and share before the click gesture ends.
      const backup = JSON.stringify(createBackup(state), null, 2);
      const file = chooseShareableFile(backupName(), backup, BACKUP_SHARE_FORMATS);
      if (!file) {
        backupShareFeedback('Dieses Backup kann hier nicht geteilt werden. Bitte JSON-Backup herunterladen.');
        return;
      }
      const feedback = settingsDialog.querySelector<HTMLElement>('#backup-share-feedback');
      if (feedback) { feedback.hidden = true; feedback.textContent = ''; }
      nativeShare(file, 'Zeitspur Backup', 'backup');
    } catch (error) {
      console.error(error);
      backupShareFeedback('Backup-Teilen fehlgeschlagen. Bitte JSON-Backup herunterladen und über eine andere App teilen.');
    }
  }
  if (button.dataset.action === 'select-restore') settingsDialog.querySelector<HTMLInputElement>('#restore-file')?.click();
  if (button.dataset.action === 'set-language') {
    const previousScrollTop = settingsDialog.querySelector<HTMLElement>('.settings-scroll')?.scrollTop ?? 0;
    const language = button.dataset.language as LanguagePreference;
    void (async () => {
      try {
        await setLanguage(language);
        notifyChange();
        await refresh();
        settingsDialog.close();
        showSettings(previousScrollTop);
        updateUpdateBannerText();
      } catch (error) { showError(error); }
    })();
  }
  if (button.dataset.action === 'set-theme') {
    const previousScrollTop = settingsDialog.querySelector<HTMLElement>('.settings-scroll')?.scrollTop ?? 0;
    const theme = button.dataset.theme as Theme;
    void (async () => {
      try {
        await setTheme(theme);
        notifyChange();
        await refresh();
        settingsDialog.close();
        showSettings(previousScrollTop);
      } catch (error) { showError(error); }
    })();
  }
});
channel?.addEventListener('message', () => { void refresh(); });
window.addEventListener('focus', () => { void refresh(); });
window.matchMedia('(prefers-color-scheme: light)').addEventListener('change', () => { if (state.theme === 'system') applyTheme('system'); });
document.addEventListener('visibilitychange', () => { if (!document.hidden) void refresh(); });
window.setInterval(updateClock, 250);
void refresh();
