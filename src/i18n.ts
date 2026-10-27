/** Zeitspur UI translations. German source copy is canonical; user data is never translated. */
export type LanguagePreference = 'auto' | 'de' | 'en';
export type Locale = 'de' | 'en';
let current: Locale = 'de';

export function detectLocale(languages: readonly string[] = (typeof navigator !== 'undefined' ? navigator.languages : ['de'])): Locale {
  const first = languages[0] ?? 'de';
  return /^de(?:-|$)/i.test(first) ? 'de' : 'en';
}
export function resolveLanguage(preference: LanguagePreference, languages?: readonly string[]): Locale {
  return preference === 'auto' ? detectLocale(languages) : preference;
}
export function setUiLanguage(preference: LanguagePreference): Locale {
  current = resolveLanguage(preference);
  if (typeof document !== 'undefined') {
    document.documentElement.lang = current;
    document.title = current === 'de' ? 'Zeitspur – Lokaler Time Tracker' : 'Zeitspur – Local Time Tracker';
    const description = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    description?.setAttribute('content', current === 'de' ? 'Einfach Zeit erfassen. Privat, lokal und offline.' : 'Track time simply. Private, local and offline.');
  }
  return current;
}
export function uiLocale(): Locale { return current; }
export function intlLocale(): string { return current === 'de' ? 'de-DE' : 'en-GB'; }

const EN: Record<string, string> = {
  'Zeitspur wird geladen …': 'Loading Zeitspur…',
  'Update verfügbar': 'Update available',
  'Aktualisieren': 'Update',
  'Aktualisieren …': 'Updating…',
  'Später': 'Later',
  'Zurück zum Timer': 'Back to timer',
  'Später dokumentieren': 'Document later',
  'Eintrag kann später ergänzt werden.': 'You can complete this entry later.',
  'Rückgängig': 'Undo',
  'Abbrechen': 'Cancel',
  'Schließen': 'Close',
  'Einstellungen öffnen': 'Open settings',
  'Zeitspur auf GitHub öffnen (neuer Tab)': 'Open Zeitspur on GitHub (new tab)',
  'Ohne Kategorie': 'No category',
  'Unvollständig': 'Incomplete',
  'Neuer Zeiteintrag': 'New time entry',
  'Eintrag': 'entry',
  'Neuen Eintrag erstellen (N)': 'Create entry (N)',
  'Eintrag erstellt.': 'Entry created.',
  'Tastaturhilfe (?)': 'Keyboard shortcuts (?)',
  'Tastaturhilfe anzeigen': 'Show keyboard shortcuts',
  'Tastaturkürzel': 'Keyboard shortcuts',
  'Globale Kürzel funktionieren nur außerhalb von Formularfeldern und Dialogen.': 'Global shortcuts work only outside form fields and dialogs.',
  'Timer starten': 'Start timer',
  'Timer pausieren / fortsetzen': 'Pause / resume timer',
  'Timer stoppen': 'Stop timer',
  'Neuen Eintrag erstellen': 'Create new entry',
  'Nächstes Feld': 'Next field',
  'Kategorie auswählen': 'Select category',
  'Kategorie übernehmen': 'Use category',
  'Eintrag speichern / abschließen': 'Save / complete entry',
  'Dialog schließen': 'Close dialog',
  'Offene Einträge': 'Unfinished entries',
  'Ergänzen': 'Complete',
  'Historie': 'History',
  'Keine Einträge': 'No entries',
  'Noch keine abgeschlossenen Einträge': 'No completed entries yet',
  'Tagesaktionen': 'Day actions',
  'Wochenaktionen': 'Week actions',
  'Eintragsaktionen': 'Entry actions',
  'Diese Woche': 'This week',
  'Letzte Woche': 'Last week',
  'Woche löschen': 'Delete week',
  'Woche': 'week',
  'Wochen': 'weeks',
  'Tag löschen': 'Delete day',
  'Eintrag bearbeiten': 'Edit entry',
  'Einträge': 'entries',
  'Nicht dokumentiert': 'Undocumented',
  'Offen': 'Unfinished',
  'über Mitternacht': 'overnight',
  'Bereit': 'Ready',
  'Gestoppt': 'Stopped',
  'Zurück': 'Back',
  'Läuft': 'Running',
  'Pausiert': 'Paused',
  'Beginn': 'Started',
  'Start': 'Start',
  'Weiter': 'Resume',
  'Pause': 'Pause',
  'Stop': 'Stop',
  'Timer läuft': 'Timer running',
  'Zum Timer': 'Go to timer',
  'Zeiterfassung': 'Time tracking',
  'Heute': 'Today',
  'Gestern': 'Yesterday',
  'Zeit dokumentieren': 'Document time',
  'Beginn (Uhrzeit)': 'Start (time)',
  'Ende (Uhrzeit)': 'End (time)',
  'Datum ändern': 'Change date',
  '(nur bei Bedarf)': '(optional)',
  'Startdatum': 'Start date',
  'Enddatum': 'End date',
  'Kategorie': 'Category',
  'Kategorien': 'Categories',
  'Kategorie fehlt.': 'Category required.',
  'Beschreibung': 'Description',
  'Beschreibung fehlt.': 'Description required.',
  'Kategorie eingeben oder auswählen': 'Enter or select a category',
  'Zuletzt verwendet': 'Recently used',
  'Passend & zuletzt verwendet': 'Matching & recently used',
  'Alle Kategorien': 'All categories',
  'Kategorien durchsuchen': 'Search categories',
  'Kategorien auswählen': 'Select categories',
  'Keine Kategorien gefunden': 'No categories found',
  'Noch keine Kategorien': 'No categories yet',
  'Weniger anzeigen': 'Show less',
  'Alle Kategorien anzeigen': 'Show all categories',
  'Was hast du gemacht?': 'What did you work on?',
  'Pausen bearbeiten': 'Edit breaks',
  'Tag': 'Day',
  'Zeitraum': 'Range',
  'Bitte zuerst den Zeitraum korrigieren.': 'Correct the entry range first.',
  'Der Beginn darf nicht nach dem Ende liegen.': 'Start cannot be after end.',
  'Bitte Pausenzeiten korrigieren.': 'Correct the break times.',
  'Kein Platz für eine weitere Pause.': 'No room for another break.',
  'Ungültige Pausenzeit.': 'Invalid break time.',
  'Diese Uhrzeit existiert an diesem Datum nicht.': 'This time does not exist on this date.',
  'Das Pausenende muss nach dem Pausenbeginn liegen.': 'Break end must be after break start.',
  'Pause liegt außerhalb der Erfassung.': 'Break is outside the entry range.',
  'Pausen dürfen sich nicht überschneiden.': 'Breaks must not overlap.',
  'Pausen werden von der gesamten Zeit abgezogen. Sie dürfen sich nicht überschneiden.': 'Breaks are deducted from the total time. They must not overlap.',
  'Von': 'From',
  'Bis': 'To',
  'Von Datum': 'From date',
  'Bis Datum': 'To date',
  'Pause entfernen': 'Remove break',
  '+ Pause hinzufügen': '+ Add break',
  'Abschließen': 'Complete',
  'Einstellungen': 'Settings',
  'CSV-Export': 'CSV export',
  'Daten löschen': 'Delete data',
  'Löschzeitraum': 'Deletion period',
  'Exportzeitraum': 'Export period',
  'Dieser Monat': 'This month',
  'Letzter Monat': 'Last month',
  'Zeitraum wählen': 'Custom range',
  'Gesamte Historie': 'Entire history',
  'Herunterladen': 'Download',
  'Teilen': 'Share',
  'Zeitraum löschen': 'Delete period',
  'Historie löschen': 'Delete history',
  'Zum Löschen Timer zuerst stoppen.': 'Stop the timer before deleting data.',
  'Keine Treffer': 'No matches',
  'Entfernen': 'Remove',
  'Entfernen löscht nur die Kategorie aus der Auswahl, keine Zeiterfassungen. Erneute Verwendung legt sie wieder an.': 'Removing a category only removes it from the choices, not from time entries. Using it again adds it back.',
  'Datensicherung': 'Backups',
  'JSON-Backup': 'JSON backup',
  'JSON-Backup herunterladen': 'Download JSON backup',
  'JSON-Backup teilen': 'Share JSON backup',
  'JSON-Backup teilen (auf manchen Geräten als Textdatei)': 'Share JSON backup (as a text file on some devices)',
  'Wiederherstellen': 'Restore',
  'Timer vorher stoppen': 'Stop the timer first',
  'Darstellung': 'Appearance',
  'Darstellung wählen': 'Choose appearance',
  'System': 'System',
  'Hell': 'Light',
  'Dunkel': 'Dark',
  'Sprache': 'Language',
  'Sprache wählen': 'Choose language',
  'Automatisch': 'Automatic',
  'Deutsch': 'Deutsch',
  'Fertig': 'Done',
  'Erneut versuchen': 'Try again',
  'Speicher nicht verfügbar': 'Storage unavailable',
  'Bitte prüfe die Browser-Einstellungen. Ohne lokale Speicherung kann kein Timer gestartet werden.': 'Check your browser settings. A timer cannot start without local storage.',
  'Eintrag löschen?': 'Delete entry?',
  'Eintrag löschen': 'Delete entry',
  'Die gesamte Zeiterfassung wird gelöscht – auch wenn sie sich über mehrere Tage erstreckt. Du kannst das Löschen anschließend 9 Sekunden lang rückgängig machen.': 'The entire entry will be deleted, even if it spans several days. You can undo this within 9 seconds.',
  'Tag löschen?': 'Delete day?',
  'Woche löschen?': 'Delete week?',
  'Historie löschen?': 'Delete history?',
  'Zeitraum löschen?': 'Delete period?',
  'Backup wiederherstellen?': 'Restore backup?',
  'Daten ersetzen': 'Replace data',
  'Kategorie entfernen?': 'Remove category?',
  'Kategorie entfernen': 'Remove category',
  'Kein Rückgängig möglich.': 'This cannot be undone.',
  'Alle Zeiterfassungen werden gelöscht. Gespeicherte Kategorien und Einstellungen bleiben erhalten.': 'All time entries will be deleted. Saved categories and settings will remain.',
  'Arbeitszeit außerhalb des Zeitraums bleibt erhalten. Gespeicherte Kategorien bleiben erhalten.': 'Time outside the selected period will remain. Saved categories will remain.',
  'Alle Einträge': 'All entries',
  'Ungültiger Zeitraum': 'Invalid date range',
  'Keine Einträge im gewählten Zeitraum.': 'No entries in the selected period.',
  'CSV erstellt.': 'CSV created.',
  'CSV-Teilen wird hier nicht unterstützt. Bitte herunterladen.': 'CSV sharing is not supported here. Please download the file.',
  'JSON-Backup erstellt.': 'JSON backup created.',
  'JSON-Backup kann hier nicht geteilt werden. Bitte herunterladen.': 'JSON backup cannot be shared here. Please download it.',
  'Backup-Teilen fehlgeschlagen. Bitte JSON-Backup herunterladen und über eine andere App teilen.': 'Sharing failed. Download the JSON backup and share it through another app.',
  'Dieses Backup kann hier nicht geteilt werden. Bitte JSON-Backup herunterladen.': 'This backup cannot be shared here. Please download the JSON backup.',
  'Datei konnte nicht geteilt werden. Bitte herunterladen.': 'Could not share the file. Please download it.',
  'Backup ist zu groß (maximal 25 MB).': 'Backup is too large (maximum 25 MB).',
  'Eintrag gelöscht.': 'Entry deleted.',
  'Eintrag wiederhergestellt.': 'Entry restored.',
  'Eintrag gespeichert.': 'Entry saved.',
  'Zeiterfassung abgeschlossen.': 'Time entry completed.',
  'Kategorie entfernt.': 'Category removed.',
  'Eintrag ist nicht mehr verfügbar.': 'Entry is no longer available.',
  'Ein unerwarteter Fehler ist aufgetreten.': 'An unexpected error occurred.',
  'Lokaler Speicher nicht verfügbar. Änderungen sind aktuell nicht möglich.': 'Local storage is unavailable. Changes cannot be saved right now.',
  'Ungültiges Datum oder Uhrzeit.': 'Invalid date or time.',
  'Bitte Beginn und Ende des Zeitraums wählen.': 'Please select a start and end date.',
  'Das Enddatum muss nach dem Startdatum liegen.': 'The end date must be after the start date.',
  'Beschreibung fehlt': 'Description required',
  'Kategorie fehlt': 'Category required',
  'Kategorie und Beschreibung fehlen': 'Category and description required',
  'Es läuft bereits eine Zeiterfassung in einem anderen Tab.': 'A timer is already running in another tab.',
  'Es ist kein Timer aktiv.': 'No timer is active.',
  'Aktiver Timer konnte nicht gefunden werden.': 'Active timer not found.',
  'Dieser Timer läuft nicht.': 'This timer is not running.',
  'Dieser Timer ist nicht pausiert.': 'This timer is not paused.',
  'Dieser Timer ist nicht aktiv.': 'This timer is not active.',
  'Ungültiger Timerzustand.': 'Invalid timer state.',
  'Ein aktiver Timer darf nicht gelöscht werden.': 'An active timer cannot be deleted.',
  'Vor dem Löschen der Historie bitte den Timer stoppen.': 'Stop the timer before deleting the history.',
  'Bitte den Timer vor dem Löschen dieses Zeitraums stoppen.': 'Stop the timer before deleting this period.',
  'Vor dem Wiederherstellen bitte den Timer stoppen.': 'Stop the timer before restoring a backup.',
  'Eintrag ist nicht mehr bearbeitbar.': 'Entry can no longer be edited.',
  'Kategorie und Beschreibung sind Pflichtfelder.': 'Category and description are required.',
  'Der Eintrag wurde in einem anderen Tab geändert. Bitte erneut öffnen.': 'The entry was changed in another tab. Please reopen it.',
  'Gespeicherte Kategorien sind ungültig. Es wurden keine Daten überschrieben.': 'Saved categories are invalid. No data was overwritten.',
  'Ungültiger Eintrag im Backup.': 'Invalid entry in backup.',
  'Ein Backup-Eintrag enthält ungültige Felder.': 'A backup entry contains invalid fields.',
  'Ungültiger Stop-Zeitpunkt im Backup.': 'Invalid stop time in backup.',
  'Arbeitsintervalle im Backup sind ungültig.': 'Work intervals in backup are invalid.',
  'Aktiver Eintrag im Backup hat ungültige Intervalle.': 'Active entry in backup has invalid intervals.',
  'Offene Arbeitsintervalle im Backup.': 'Unclosed work intervals in backup.',
  'Arbeitsintervalle fehlen im Backup.': 'Work intervals are missing in backup.',
  'Abgeschlossener Eintrag ohne Pflichtfelder im Backup.': 'Completed entry is missing required fields in backup.',
  'Datei ist kein unterstütztes Zeitspur-Backup (Version 2).': 'This is not a supported Zeitspur backup (version 2).',
  'Doppelte Eintrags-ID im Backup.': 'Duplicate entry ID in backup.',
  'Ungültige gespeicherte Kategorien im Backup.': 'Invalid saved categories in backup.',
  'Datenbank-Anfrage fehlgeschlagen': 'Database request failed',
  'Datenbank-Transaktion abgebrochen': 'Database transaction aborted',
  'Datenbank-Fehler': 'Database error',
  'Datenbank konnte nicht geöffnet werden': 'Could not open database',
  'Datenbank durch anderen Tab blockiert': 'Database is blocked by another tab',
  'Ungültiges Theme': 'Invalid theme',
  'Eintrag wurde bereits gelöscht.': 'Entry has already been deleted.',
  'Dieser Eintrag wurde bereits wiederhergestellt.': 'This entry has already been restored.',
  'Datum ist kein Wochenbeginn (Montag).': 'The date is not a week start (Monday).',
  'Aktive Timer können nicht nachträglich bearbeitet werden.': 'Active timers cannot be edited.',
  'Ende muss nach dem Beginn liegen.': 'End must be after start.',
  'Pausen dürfen sich nicht überschneiden und müssen innerhalb der Erfassung liegen.': 'Breaks must not overlap and must be within the entry.',
  'Die gesamte Zeit kann nicht aus Pausen bestehen.': 'Breaks cannot cover the entire entry.',
  'Ungültiges Tagesdatum.': 'Invalid day.',
  'Ungültiger Löschzeitraum.': 'Invalid deletion period.',
  'Aktive Einträge können nicht gelöscht werden.': 'Active entries cannot be deleted.',
  'Unerwartetes offenes Zeitintervall.': 'Unexpected open work interval.',
  'Ungültige Sprachauswahl.': 'Invalid language selection.',
  'Ungültige Sprache im Backup.': 'Invalid language in backup.',
};

export function tr(source: string): string {
  if (current === 'de') return source;
  if (EN[source]) return EN[source];
  // Finite templates for dynamic UI copy; never use these to translate user data.
  const patterns: [RegExp, (m: RegExpMatchArray) => string][] = [
    [/^(\d+) Wochen · (.+)$/, m => `${m[1]} weeks · ${m[2]}`],
    [/^(\d+) Woche · (.+)$/, m => `${m[1]} week · ${m[2]}`],
    [/^(\d+) Kategorien$/, m => `${m[1]} categories`],
    [/^(\d+) Kategorie$/, m => `${m[1]} category`],
    [/^(\d+) Einträge$/, m => `${m[1]} entries`],
    [/^(\d+) Eintrag$/, m => `${m[1]} entry`],
    [/^Beginn (.+)$/, m => `Started ${m[1]}`],
    [/^Woche vom (.+)$/, m => `Week of ${m[1]}`],
    [/^Woche ab (.+) löschen$/, m => `Delete week starting ${m[1]}`],
    [/^Kategorie (.+) entfernen$/, m => `Remove category ${m[1]}`],
    [/^Pausen bearbeiten \((\d+)\)$/, m => `Edit breaks (${m[1]})`],
    [/^„(.+)“ wird beim Speichern als Kategorie angelegt\.$/, m => `“${m[1]}” will be added as a category when you save.`],
    [/^(.+) · über Mitternacht$/, m => `${m[1]} · overnight`],
    [/^(\d+) Einträge für (.+) angepasst oder gelöscht\.$/, m => `${m[1]} entries for ${m[2]} modified or deleted.`],
    [/^(\d+) Einträge dieser Woche angepasst oder gelöscht\.$/, m => `${m[1]} entries for this week modified or deleted.`],
    [/^(\d+) Eintrag gelöscht oder angepasst\.$/, m => `${m[1]} entry deleted or modified.`],
    [/^(\d+) Einträge gelöscht oder angepasst\.$/, m => `${m[1]} entries deleted or modified.`],
    [/^(\d+) Einträge wiederhergestellt\.$/, m => `${m[1]} entries restored.`],
    [/^(.+) · (\d+) Einträge · (.+)$/, m => `${m[1]} · ${m[2]} entries · ${m[3]}`],
    [/^(.+) · (\d+) Eintrag · (.+)$/, m => `${m[1]} · ${m[2]} entry · ${m[3]}`],
    [/^Alle abgeschlossenen Arbeitszeiten von (.+) bis (.+) werden entfernt\. Offene Einträge und Arbeitszeit außerhalb dieser Woche bleiben erhalten\. Diese Aktion lässt sich nicht rückgängig machen\.$/, m => `All completed work from ${m[1]} to ${m[2]} will be removed. Unfinished entries and time outside this week remain. This cannot be undone.`],
    [/^Alle abgeschlossenen Arbeitszeiten am (.+) werden entfernt\. Offene Einträge bleiben bestehen\. Bei Einträgen über Mitternacht bleiben die Anteile anderer Tage erhalten\. Diese Aktion lässt sich nicht rückgängig machen\.$/, m => `All completed work on ${m[1]} will be removed. Unfinished entries remain. Time on other days is retained for overnight entries. This cannot be undone.`],
    [/^Alle Arbeitszeiten von (.+) bis (.+) werden entfernt\. Arbeitszeit außerhalb dieser Woche bleibt erhalten\. Diese Aktion lässt sich nicht rückgängig machen\.$/, m => `All recorded work from ${m[1]} to ${m[2]} will be removed. Time outside this week remains. This cannot be undone.`],
    [/^Alle erfassten Arbeitszeiten am (.+) werden entfernt\. Bei Einträgen über Mitternacht bleiben die Anteile anderer Tage erhalten\. Diese Aktion lässt sich nicht rückgängig machen\.$/, m => `All recorded work on ${m[1]} will be removed. Time on other days is retained for overnight entries. This cannot be undone.`],
    [/^„(.+)“ wird aus der Kategorienauswahl entfernt\. Zeiterfassungen bleiben unverändert\. Wird der Name später erneut verwendet, erscheint er wieder in der Auswahl\.$/, m => `“${m[1]}” will be removed from the category choices. Time entries remain unchanged. Using this name again will add it back.`],
    [/^Das Backup enthält (\d+) Einträge\. Es ersetzt alle derzeit gespeicherten Zeiterfassungen und Einstellungen\. Lade bei Bedarf vorher ein Backup deiner aktuellen Daten herunter\.$/, m => `This backup contains ${m[1]} entries. It replaces all current time entries and settings. Download a backup of your current data first if needed.`],
    [/^(.+) betroffen \((.+) Arbeitszeit\)\. Auswahl: (.+)\. (.+) Kein Rückgängig möglich\.$/, m => `${m[1]} affected (${m[2]} work time). Selection: ${m[3]}. ${tr(m[4].trim())} This cannot be undone.`],
  ];
  for (const [pattern, fn] of patterns) {
    const match = source.match(pattern);
    if (match) return fn(match);
  }
  return source;
}

/** Translate only UI markup, not the user's stored categories or descriptions. */
export function translateUi(root: ParentNode): void {
  if (current === 'de') return;
  const el = root instanceof Element ? root : null;
  const skip = '.category-select, .history-details p, .category-manage-row > span, .category-new-hint, [translate="no"]';
  const nodes: Text[] = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    const node = walker.currentNode as Text;
    if (node.parentElement?.closest(skip)) continue;
    nodes.push(node);
  }
  for (const node of nodes) {
    const original = node.nodeValue ?? '';
    const trimmed = original.trim();
    if (!trimmed) continue;
    const translated = tr(trimmed);
    if (translated !== trimmed) node.nodeValue = original.replace(trimmed, translated);
  }
  const elements = [...(el ? [el] : []), ...root.querySelectorAll<HTMLElement>('*')];
  for (const element of elements) {
    if (element.matches(skip)) continue;
    for (const attribute of ['placeholder', 'aria-label', 'title']) {
      const value = element.getAttribute(attribute);
      if (value !== null) element.setAttribute(attribute, tr(value));
    }
  }
}
