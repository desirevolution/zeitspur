import assert from 'node:assert/strict';
import { detectLocale, resolveLanguage, setUiLanguage, intlLocale, tr } from '../dist/assets/i18n.js';
assert.equal(detectLocale(['de-DE', 'en-GB']), 'de');
assert.equal(detectLocale(['en-GB', 'de-DE']), 'en');
assert.equal(detectLocale(['fr-FR']), 'en');
assert.equal(resolveLanguage('de', ['en-US']), 'de');
assert.equal(resolveLanguage('en', ['de-DE']), 'en');
assert.equal(resolveLanguage('auto', ['en-US']), 'en');
assert.equal(setUiLanguage('en'), 'en');
assert.equal(intlLocale(), 'en-GB');
for (const [de, en] of [
  ['Einstellungen', 'Settings'],
  ['JSON-Backup herunterladen', 'Download JSON backup'],
  ['JSON-Backup teilen', 'Share JSON backup'],
  ['Zeit dokumentieren', 'Document time'],
  ['Gesamte Historie', 'Entire history'],
  ['Kategorie fehlt.', 'Category required.'],
  ['Beschreibung fehlt', 'Description required'],
  ['3 Kategorien', '3 categories'],
  ['Woche vom 20.10.', 'Week of 20.10.'],
  ['Alle Zeiterfassungen werden gelöscht. Gespeicherte Kategorien und Einstellungen bleiben erhalten.', 'All time entries will be deleted. Saved categories and settings will remain.'],
]) assert.equal(tr(de), en, de);
assert.equal(tr('„Planung“ wird beim Speichern als Kategorie angelegt.'), '“Planung” will be added as a category when you save.');
assert.equal(setUiLanguage('de'), 'de');
assert.equal(tr('Einstellungen'), 'Einstellungen');
console.log('PASS: language selection, auto detection, translations, interpolation, German fallback');
