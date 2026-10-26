# Zeitspur – lokaler Offline-Time-Tracker (POC 0.29)

**Keine Cloud, kein Backend, kein Login.** Alle Zeiterfassungen liegen ausschließlich in der IndexedDB des jeweiligen Browsers. Zeitspur kann als Progressive Web App installiert und nach dem ersten erfolgreichen Laden offline genutzt werden.

## Änderung in 0.29 – Pausen per Uhrzeit, direkte Zeitraum-Validierung

- Pausen werden standardmäßig nur über zwei **Uhrzeitfelder** editiert. Nur wenn ein Arbeitseintrag mehrere Kalendertage umfasst, lassen sich die betreffenden Tage separat wählen.
- Neue Pausen erhalten einen vorgeschlagenen Zeitraum innerhalb der Arbeitszeit, unter Berücksichtigung vorhandener Pausen. Bereits vorhandene Pausen werden unverändert angezeigt.
- **Von/Bis werden unmittelbar im Formular überprüft**: Ein Arbeitsbeginn nach dem Ende und eine Pause mit Ende vor oder gleich dem Beginn blockieren das Speichern. Die Meldung steht am betreffenden Feld und zusätzlich im sichtbaren Formular-Footer (kein verdeckter Toast).
- Uhrzeit- und Datumsauswahl erhalten dynamische Grenzen; gültige Einträge über Mitternacht bleiben möglich, da die Tagesauswahl getrennt von der Uhrzeit geführt wird. Ungültige Zwischenstände werden nie stillschweigend korrigiert.
- Datenbank, CSV-Export und Backup-Format bleiben unverändert.
- Zusätzliches Browser-Testskript (lokaler Test mit Playwright): `python tests/editor-time-browser.py`.

## Änderung in 0.28 – Einheitliche englische CSV-Dateinamen

- CSV-Dateinamen sind unabhängig von der UI-Sprache **immer Englisch**: `zeitspur-2026-10-01-to-2026-10-31.csv`, für gesamte Historie `zeitspur-all-2026-09-12-to-2026-10-26.csv`.
- Leere Historie: `zeitspur-all-empty-2026-10-26.csv`; falls nur eine Filtergrenze gesetzt ist, `start` beziehungsweise `today`.
- Gilt für **CSV herunterladen** und **CSV teilen**. CSV-Inhalt, englische Spaltennamen, Exportfilter und JSON-Backup bleiben unverändert.

## Änderung in 0.27 – CSV-Zeitraum im Dateinamen

- Export mit gewähltem Zeitraum: `zeitspur-2026-10-01-bis-2026-10-31.csv` (bereits zuvor bei gefilterten Exporten vorhanden).
- **Gesamte Historie:** Statt nur des heutigen Datums enthält der Dateiname den tatsächlichen Zeitraum der exportierbaren Einträge, z. B. `zeitspur-gesamt-2026-09-12-bis-2026-10-26.csv`. Es zählen frühester Start und spätestes Ende gestoppter Einträge; laufende Timer werden nicht exportiert. Bei leerer Historie: `zeitspur-gesamt-leer-2026-10-26.csv` (Datum des Downloads).
- Dateinamen gelten **identisch** beim CSV-Download und beim nativen CSV-Teilen. CSV-Spalten, Datenfilter und JSON-Backups sind unverändert. Der Bereich im Dateinamen beschreibt beim Filter den **gewählten Zeitraum**. Weil der Export vollständige, den Filter überlappende Einträge enthält, können deren Zeitstempel über die Filtergrenzen hinausreichen.
- Keine Datenmigration notwendig.

## Änderung in 0.26 – Excel-/Google-Sheets-freundliche CSV-Zeitstempel

- `started_at` und `stopped_at` werden in CSV als **lokale Datums-/Uhrzeitwerte ohne Zeitzonen-Offset** ausgegeben: `2026-10-26 09:15:00` (Schema `YYYY-MM-DD HH:mm:ss`). Keine ISO-`T`-Trennung, kein `Z`, kein `+01:00` und keine Millisekunden.
- Das gilt gleichermaßen für **CSV herunterladen** und **CSV teilen**. Englische Spaltennamen, Semikolon, UTF-8-BOM, volle Minuten und Zeitraumfilter bleiben erhalten.
- **Wichtig bei Sommer-/Winterzeit:** Zwei unterschiedliche reale Zeitpunkte können dieselbe lokale Uhrzeit haben. CSV ist für Tabellenbearbeitung gedacht, nicht für einen verlustfreien Datenimport. Die präzisen Epoch-Zeitwerte in IndexedDB und JSON-Backups bleiben unverändert; `exportedAt` im Backup bleibt ISO-UTC mit `Z`. Keine Datenmigration.
- Excel und Google Sheets können das Format in der Regel direkt als Datum/Uhrzeit interpretieren; abhängig von den Import-/Locale-Einstellungen ist gegebenenfalls die Spalte als Datum/Uhrzeit zu deklarieren.

## Änderung in 0.25 – direkte und konsistente Aktionen

- Eintrags-, Tages- und Wochenaktionen haben jeweils **nur eine** Löschoption: Das unnötige Drei-Punkte-Menü entfällt überall. Ein dezentes Papierkorb-Icon ist direkt erreichbar, über Tooltip/Accessible Name als **„Eintrag löschen“**, **„Tag löschen“** bzw. **„Woche löschen“**.
- Bei offenen Einträgen bleibt **„Ergänzen“** die wichtigste Aktion. Das einzelne Lösch-Icon ersetzt den fehlerhaft abgeschnittenen Dropdown und wird nicht mehr von der Listenkarte verdeckt.
- Löschbestätigung, Undo für Einzeleinträge und Schutz offener Einträge beim Löschen von Tagen/Wochen sind unverändert. Keine Änderungen am Datenformat.

## Änderung in 0.24 – vereinfachte Oberfläche

- Timer-Panel auf Desktop und Smartphone kompakter, mit ruhigerer Monospace-Uhr und klaren Abständen.
- Offene (noch nicht dokumentierte) Einträge erscheinen nur im Block „Offene Einträge“, nicht doppelt in der Historie. Das ändert weder ihren Speicherstatus noch ihre Exportierbarkeit.
- Wochen gruppieren Tage in einer zusammenhängenden, weniger verschachtelten Liste; die Tageszeilen zeigen Anzahl und Summe, Wochen zeigen einen lesbaren lokalen Datumsbereich.
- Löschaktionen für Einträge (auch offene), Tage und Wochen sind als sekundäre Aktionen verfügbar; Bearbeiten und Ergänzen bleiben direkt erreichbar. Seit 0.25 erfolgen die Löschaktionen ohne Menü. Löschen aus der Historie betrifft nur abgeschlossene Zeiterfassungen, nicht offene Einträge. Löschbestätigungen/Undo-Verhalten bleiben erhalten.
- Deutsche und englische UI-Texte ergänzt. Zeiterfassungen, IndexedDB, CSV-/Backupformate und Gruppierungsregeln bleiben unverändert.

## Änderung in 0.23 – CSV-Ausgabe

- Einheitliche englische CSV-Header in `snake_case`.
- Damaliges CSV-Format: lokale ISO-8601-Zeitstempel mit explizitem Offset statt UTC-`Z` (ab Version 0.26 **ohne Offset**, siehe oben).
- `paused_minutes` und `worked_minutes` als **ganze Minuten**, kaufmännisch gerundet; keine Dezimal-Sekunden mehr.
- Semikolon, UTF-8-BOM, Zeitraumfilter und CSV-Dateifreigabe bleiben erhalten.
- Keine Änderung an IndexedDB, Timer-Daten, Kategorien oder JSON-Backupformat; keine Migration nötig.

## Sofort starten – fertig gebautes Paket

Den Inhalt des `fertig`-ZIPs entpacken und **aus dem entpackten Verzeichnis** starten:

```bash
python3 -m http.server 8080 --bind 127.0.0.1
```

Im Browser `http://localhost:8080` öffnen. Für den Zugriff vom Smartphone bitte **HTTPS** nutzen (z. B. über einen statischen Server hinter Caddy). Ein Aufruf per `file://` ist kein zuverlässiger PWA-Betrieb.

Im Projekt-ZIP ist bereits ein `dist/`-Ordner enthalten: `cd dist` und dort denselben Befehl ausführen.

## Entwicklung

Mit Node.js und npm:

```bash
npm install
npm run dev
```

Produktionsbuild:

```bash
npm run build
npm run preview
```

Als Build-Fallback ohne installierte npm-Abhängigkeiten (benötigt ein globales `tsc`):

```bash
npm run build:standalone
```

Danach den Ordner `dist/` per HTTPS oder localhost ausliefern. Der relative Pfad `./` unterstützt Unterverzeichnisse. Der `sw.js` wird beim Build mit Cache-Hashes erzeugt.

## PWA-Updates (neu in 0.8)

- Die Update-Erkennung wird als **separater Skripteinstieg** geladen. So können auch ältere SW-Versionen, die `assets/main.js` cache-first ausliefern, den neuen Update-Mechanismus laden, sobald `index.html` frisch geladen wurde.
- Bei App-Start, beim Wiederkehren aus dem Hintergrund und bei Netzwerk-Wiederverbindung wird auf neue Service-Worker-Versionen geprüft (`ServiceWorkerRegistration.update()`, `updateViaCache: 'none'`; während normaler Benutzung höchstens alle fünf Minuten).
- Eine neue Version wird im Hintergrund vorbereitet. Eine kompakte Leiste zeigt **Update verfügbar → Aktualisieren / Später**. Beim Klick schickt die App `SKIP_WAITING` an den neuen Worker und lädt erst nach `controllerchange` neu. Ein offenes Formular wird nie ungefragt neu geladen.
- Der Service Worker cached die App-Dateien beim Installieren unter Umgehung des Browser-HTTP-Caches und greift im Betrieb nur auf **seinen eigenen versionierten Cache** zurück. Andere alte Cache-Versionen werden bei Aktivierung entfernt.
- Zeiterfassungen und Kategorien bleiben in **IndexedDB**, unabhängig vom Service-Worker-Cache. Ein Versionswechsel verändert das Datenbankschema nicht.

**HTTP-Cache richtig konfigurieren:** Da die direkt startbare Standalone-Version Dateinamen ohne Content-Hash verwendet (`assets/main.js`, `assets/styles.css`), für die kleine statische App alle Assets auf `Cache-Control: no-cache, max-age=0, must-revalidate` setzen. So kann der Browser online den aktuellen Stand neu validieren; **offline** übernimmt weiter der Service Worker. Beispiel für Caddy:

```caddyfile
tracker.example.com {
    root * /srv/zeitspur
    header Cache-Control "no-cache, max-age=0, must-revalidate"
    file_server
}
```

Für andere Hosting-Konfigurationen entsprechend anpassen; dabei die **Origin** (Schema, Host, Port) für den lokalen IndexedDB-Bestand nicht ändern. Deployment erst vollständig hochladen, dann ausliefern (keine teilweise aktualisierten Dateibestände). Beim **ersten Umstieg aus älteren Versionen** kann ggf. noch ein einmaliger manueller Reload notwendig sein, wenn ein HTTP-/Proxy-Cache bereits die alte `index.html` zurückliefert. Danach läuft die Prüfung selbständig.

## Gespeicherte Zeitraumwahl (neu in 0.22)

- Unter **Einstellungen → CSV-Export** und **Einstellungen → Daten löschen** wird jeweils die zuletzt gewählte Zeitraum-Voreinstellung gespeichert. Die beiden Auswahlen sind vollständig unabhängig.
- Auch die beiden Datumsfelder bei **Benutzerdefiniert** werden gemerkt und beim nächsten Öffnen wieder eingesetzt, selbst wenn zwischendurch ein anderes Preset gewählt wurde. Unvollständig eingegebene Daten werden ebenfalls als Eingabe behalten, können aber nicht für eine ungewollte Löschung verwendet werden.
- Beim allerersten Öffnen ist in beiden Bereichen weiterhin **Gesamte Historie** ausgewählt. Danach gilt die letzte lokale Auswahl, auch nach Reload, App-Neustart oder einem Update.
- Relative Zeiträume (**Diese Woche**, **Letzte Woche**, **Dieser Monat**, **Letzter Monat**) werden jedes Mal relativ zum **aktuellen Datum** berechnet, nicht mit alten absoluten Daten eingefroren.
- Diese **reinen UI-Präferenzen** werden separat im `localStorage` der jeweiligen Browser-Origin und des jeweiligen Browserprofils gespeichert. Sie sind **nicht Teil des JSON-Backups** und werden durch dessen Wiederherstellung nicht geändert; andere Geräte und Browser bleiben unabhängig.
- Das Löschen von Zeiterfassungen entfernt die Zeitraum-Präferenzen nicht. Ein explizites Löschen der Website-Daten oder der Wechsel zu einer anderen Origin entfernt beziehungsweise isoliert sie wie andere browserlokale Daten.
- Falls der Browser `localStorage` sperrt oder gespeicherte Werte beschädigt sind, verwendet der Dialog die Voreinstellung ohne die übrige App zu blockieren. Keine IndexedDB-Migration und keine Änderung am Backupformat.
- Tests: `npm run test:logic` und optional `python tests/range-preferences-browser.py` (benötigt Playwright/Chromium, kann durch die Einschränkungen der Testumgebung übersprungen werden).

## Native Datei-Freigabe auf Mobilgeräte beschränkt (0.21)

- **Desktop (Linux, Windows, macOS):** Die Buttons **Teilen** (CSV) und **JSON-Backup teilen** sind bewusst ausgeblendet, selbst wenn der Browser `navigator.share()` teilweise bereitstellt. Insbesondere Firefox auf Linux kann sonst eine sichtbare, aber nicht funktionsfähige Aktion anzeigen.
- **Mobil (Android, iPhone/iPad):** Teilen ist verfügbar, wenn `navigator.share()` und die Dateifreigabe unterstützt werden. Die tatsächliche Datei wird weiterhin bei jeder Freigabe durch `canShare({files: [...]})` geprüft; bei Backup-Dateien hat `.txt` weiterhin Vorrang.
- **Backup-Aktionen:** **JSON-Backup herunterladen** und **JSON-Backup teilen** (Englisch: **Download JSON backup** / **Share JSON backup**). **Wiederherstellen** bleibt unverändert.
- Mobil-/Desktop-Erkennung berücksichtigt Android/iOS im User Agent, `userAgentData.mobile` und iPadOS im Desktop-Modus. Es werden keine Serveranfragen dazu durchgeführt.
- **Test:** `npm run test:share` prüft beide Desktop-Browser-Beispiele und Android/iOS/iPadOS; `npm run test:logic` prüft die übersetzten Beschriftungen.
- Keine Änderung an IndexedDB, Backup-Format, PWA-Cache-Mechanismus oder gespeicherten Kategorien.

## Backup teilen – Bugfix in 0.20

- Der native Teilen-Button verwendet **bevorzugt `.txt` mit `text/plain`** für das JSON-Backup. Diese Kombination ist in Chromium für Dateien zugelassen. Das Backup enthält weiterhin ein vollständiges JSON-Dokument.
- Beim Tippen wird `navigator.canShare({ files: [actualFile] })` für die **tatsächliche Backup-Datei** ausgeführt, nicht nur mit einer winzigen Testdatei. So können auch Größen-/Browserlimits berücksichtigt werden.
- Fehler beim Teilen werden **direkt innerhalb des Einstellungsdialogs** sichtbar. Das bisherige globale Toast konnte hinter dem modalen Dialog liegen. Das bewusste Abbrechen des nativen Dialogs bleibt ohne Fehlermeldung.
- **Wiederherstellen akzeptiert `.json` und `.txt`**, validiert jedoch strikt den JSON-Inhalt und das Backupformat v2. Der normale Download speichert weiterhin `.json`.
- Die Share API benötigt HTTPS und eine Browser-/Systemumgebung mit Unterstützung für Datei-Teilen. Ist diese nicht vorhanden, bitte das Backup herunterladen und über den Dateimanager teilen.

## Native Backup-Freigabe (eingeführt in 0.19)

- Unter **Einstellungen → Datensicherung** steht neben **JSON-Backup herunterladen** auf unterstützten Mobilgeräten jetzt **JSON-Backup teilen**. Die Funktion öffnet das native Teilen-Menü und verschickt **die komplette lokale Sicherung als Datei**, nicht bloß einen Link oder eine E-Mail-Vorlage.
- Der native `navigator.share()`-Aufruf erfolgt **direkt im Klick-Handler**, ohne vorheriges `await` (notwendige Benutzeraktivierung). Die zuletzt geladene IndexedDB-Momentaufnahme wird für den Share-Vorgang synchron serialisiert. Änderungsereignisse – auch aus anderen Tabs – aktualisieren diese Momentaufnahme.
- Die meisten Chromium-Browser erlauben per Web Share API **keine `.json`-Dateien**. Bevorzugt wird die Datei als **`.txt` mit `text/plain`** geteilt; nur falls notwendig und unterstützt als `.json`. Der Inhalt ist **in beiden Fällen dasselbe vollständige JSON-Backup**. Die Dateiauswahl bei **Wiederherstellen** erlaubt daher nun `.json` **oder `.txt`**, geprüft wird weiterhin ausschließlich das strikte Backup-Schema v2.
- Auf Desktop ist Datei-Teilen generell ausgeblendet. Fehlt auf Mobilgeräten die Browser-API für Datei-Teilen, wird **Teilen** ebenfalls ausgeblendet. Ist die konkrete Datei nicht teilbar, erscheint ein Hinweis im Einstellungsdialog. Der normale JSON-Download funktioniert unabhängig davon. Ein abgebrochener systemseitiger Teilen-Dialog löst keine Fehlermeldung und keinen zusätzlichen Download aus.
- Keine Datenbankänderung, kein neues Backupformat, keine Netzwerkübertragung durch Zeitspur. Die tatsächlich gewählte Teilen-Ziel-App kann Daten selbst versenden; ihr Verhalten liegt außerhalb der PWA.
- Test: `npm run test:share` prüft unterstützte Dateiformate, Browser ohne Dateifreigabe, `.txt`-Fallback, JSON-Importierbarkeit und unveränderten CSV-Share. Die systemseitige Freigabe sollte zusätzlich auf einem echten Android-Gerät überprüft werden.

## Historie mit Wochen- und Monatsgruppen (neu in 0.18)

- **Diese Woche** ist anfangs aufgeklappt, **heute** ebenfalls. Die aktuelle Woche darf manuell eingeklappt werden; bei neuem App-Start wird sie wieder geöffnet.
- **Letzte Woche** und weitere Wochen sind standardmäßig eingeklappt. Ein Klick auf die Wochenzeile zeigt die zugehörigen Tage; deren Einträge können separat aufgeklappt werden.
- Ältere Wochen sind nach **Monaten als Archiv** eingeklappt. Wochen des aktuellen Monats werden direkt angezeigt. Die letzte Woche bleibt als schnelle Abkürzung sichtbar, auch an Monatsgrenzen.
- Wochen über zwei Monate werden **vollständig dem Monat ihres Donnerstags** zugeordnet. Die angezeigte Monatsgruppensumme umfasst damit ganze zugeordnete Wochen und ist *keine exakte Monatsabrechnung*. Export-/Löschzeitraum und Tageslogik bleiben davon unberührt.
- Die manuell auf-/zugeklappten Gruppen bleiben während der laufenden Sitzung bei Bearbeitung und Speicherung erhalten, werden nach neuem Seitenaufruf auf die Standardansicht zurückgesetzt.
- Wochen- und Tageslöschaktionen bleiben unverändert: Sie befinden sich im jeweils aufgeklappten Abschnitt.
- Die Ansicht benötigt **keine Datenbankmigration**, da alle Gruppen aus der Historie berechnet werden.
- Test: `TZ=Europe/Berlin node tests/history-groups-smoke.mjs` (Monatsgrenzen, DST, eindeutige Zuordnung).

## Einstellungendialog mit fixer Kopfzeile (neu in 0.17)

- **Fertig** steht bei Desktop und Mobile oben rechts neben **Einstellungen** und bleibt auch beim Scrollen sichtbar.
- Die untere **Fertig**-Schaltfläche entfällt. Nur der Einstellungsinhalt ist scrollbar; der Dialogkopf bleibt fest stehen.
- Mobile Ansicht weiterhin Vollbild mit Safe-Area-Abständen; Desktop als höhenbegrenzter Dialog.
- Escape bzw. systemseitiges Schließen des nativen Dialogs bleiben erhalten. Ein Sprach-/Themewechsel wird wie bisher unmittelbar gespeichert.
- Keine Änderungen an IndexedDB, Kategorien, Timerlogik oder Backupformat.

## Sprachen und Wortmarke (neu in 0.16)

- Die frühere Wortmarke **zeitspur.** mit farbigem Punkt ist wieder sichtbar; die PWA-Icons bleiben unverändert.
- Oberfläche auf **Deutsch und Englisch**. Voreinstellung **Automatisch**: die erste bevorzugte Browsersprache bestimmt die UI-Sprache (`de` → Deutsch, alle anderen → Englisch).
- Unter **Einstellungen → ganz unten → Sprache** stehen **Automatisch / Deutsch / English** zur Wahl. Die Änderung wird sofort angewandt und als zusätzlicher Datensatz im bisherigen IndexedDB-`settings`-Store gespeichert (keine Schema-Migration).
- Übersetzungen umfassen Timer, Historie, Editor, Kategorien, Lösch-/Backupdialoge, Status- und Fehlermeldungen sowie Datumsformate. Der Inhalt eigener Kategorien/Beschreibungen wird **nicht** übersetzt.
- Das JSON-Backup **Version 2** bleibt kompatibel: Es enthält jetzt optional `language`. Alte Version-2-Backups ohne das Feld werden als `auto` interpretiert. Der CSV-Aufbau und seine Spaltennamen bleiben für bestehende Workflows stabil.
- Bei automatischer Erkennung wird nur die primäre Browsersprache verwendet. Weitere Übersetzungen können später im zentralen Modul `src/i18n.ts` ergänzt werden. Das statische PWA-Manifest bleibt vorerst deutsch; die Spracheinstellung betrifft die App-Oberfläche.
- Tests: `npm run test:logic`, `npm run test:pwa`, `python tests/i18n-dom.py` (netzwerkfrei, Chromium) und die bestehenden Layouttests.

## Kategorieauswahl auf Smartphones (Fix in 0.14)

- Beim Fokus auf das Kategorie-Eingabefeld oder die Suche nach Kategorien wird im mobilen Vollbild-Editor die feste Aktionsleiste **temporär ausgeblendet**, damit die zuletzt verwendeten Kategorien nicht unter ihr verschwinden.
- Das Eingabefeld wird innerhalb des scrollbaren Editorbereichs nach oben positioniert. Die Vorschläge bleiben erreichbar und können bei größerer Anzahl intern gescrollt werden.
- Nach der Auswahl einer Kategorie springt der Fokus wie bisher zur Beschreibung; **Später** und **Abschließen** erscheinen wieder. Beim manuellen Wechsel zu einem anderen Feld ebenso.
- Die obere Schließen-Schaltfläche bleibt immer erreichbar. Auf Desktop bleibt die Darstellung unverändert.
- Kein Eingriff in Zeitberechnung, gespeicherte Daten, Kategorien oder Backup-Schema.

## Desktop-Editor mit fixierten Aktionen (Fix in 0.15)

- Der Desktop-Editor hat eine maximale Höhe relativ zum sichtbaren Browserfenster; das Dialogfenster selbst scrollt nicht mehr.
- Kopfzeile sowie **Später** und **Abschließen** bleiben dauerhaft sichtbar. Ausschließlich der mittlere Formularbereich scrollt, auch wenn viele Kategorie-Vorschläge sichtbar oder die erweiterten Pausen geöffnet sind.
- Kategorien behalten ihre eigene begrenzte Scrollhöhe. Die mobile Vollbild-/Tastatur-Logik aus 0.14 bleibt erhalten.
- Regressionstest (netzwerkfrei): `python tests/desktop-editor-layout.py` prüft den Editor bei 860, 600 und 430 px Fensterhöhe. Zusätzlich `python tests/mobile-category-layout.py`.

## Abschluss des Eintrags (neu in 0.13)

- Die Aktion im Editor heißt **Abschließen** statt „Speichern“. **Später** behält die bisherige Bedeutung: Ein bereits gestoppter, unvollständiger Eintrag bleibt offen und kann später dokumentiert werden.
- Kategorie und Beschreibung sind Pflichtfelder. Die fixe untere Leiste zeigt dezent an, welche Angabe noch fehlt; bei vollständiger Eingabe verschwindet der Hinweis. Es gibt **keine zusätzliche Bestätigung**.
- Beim Auswählen eines Kategorie-Vorschlags wird die **Beschreibung automatisch fokussiert** und innerhalb des scrollbaren Editorinhalts sichtbar gemacht. Wer eine Kategorie eintippt, kann mit Enter zur Beschreibung springen.
- Beim Versuch, unvollständige Angaben abzuschließen, bleibt der Editor geöffnet. Fehlende Felder werden **direkt am Feld** markiert und das erste fehlende Feld wird fokussiert. Leerzeichen allein gelten nicht als Inhalt. Beim Nachtragen verschwinden die Markierungen sofort.
- Der mobile Tastatur-Fix aus 0.12 bleibt erhalten: Kopfbereich und Fußleiste bleiben fest, während nur der Editorinhalt scrollt.
- Die Änderungen betreffen lediglich die Formulareingabe. Es gibt **keine Änderungen an IndexedDB, Kategorien, Zeitlogik oder dem JSON-Backupformat**.

## Mobile Tastatur und Löschdialog (neu in 0.12)

- Bei **Gesamte Historie löschen** nennt der Bestätigungsdialog ausdrücklich, dass **gespeicherte Kategorien und Einstellungen erhalten bleiben**. Auch bei Zeitraum-Löschung wird der Erhalt der Kategorien erwähnt. Alle Aktionen benötigen weiterhin eine Bestätigung und lassen sich bei aktivem Timer nicht ausführen.
- Der mobile Eintragseditor hat einen **festen Kopfbereich und eine feste untere Aktionsleiste** (Später / Abschließen). Nur der Bereich mit Zeitfeldern, Kategorie, Beschreibung und Pausen scrollt.
- `<meta name="viewport" ... interactive-widget=resizes-content>` ermöglicht unterstützten Mobilbrowsern, das Layout mit der virtuellen Tastatur zu verkleinern. Für Browser, die nur den **Visual Viewport** ändern (z. B. iOS Safari), passt `visualViewport` die Höhe und obere Position des geöffneten Editors an. Eingabefelder werden innerhalb des Formularbereichs bei Bedarf sichtbar gescrollt.
- Mobile Eingabefelder haben mindestens 16px Schriftgröße, um unbeabsichtigtes Heranzoomen bei iOS-Eingaben zu vermeiden. Die Fußleiste berücksichtigt den Safe-Area-Abstand.
- Die Keyboard-Anpassung verändert **keine** Zeit-, Datenbank- oder Backup-Struktur und greift ausschließlich in einem geöffneten Editor auf mobilen Ansichten.
- **Gerätetest notwendig:** Insbesondere physische Android-PWA und iOS-PWA mit geöffneter Tastatur prüfen. Der automatische Chromium-Test kann in dieser Umgebung wegen `net::ERR_BLOCKED_BY_ADMINISTRATOR` nicht ausgeführt werden.

## Kategorien-Bedienung (neu in 0.11)

- Im Eintragseditor erscheinen die **fünf zuletzt verwendeten Kategorien** als Schnellauswahl. Beim Tippen werden passende Kategorien nach vorn geholt; die zuletzt verwendeten Kategorien bleiben als Fallback sichtbar, statt komplett zu verschwinden.
- **Alle Kategorien anzeigen** öffnet die vollständige Liste mit einer separaten Suche. Beim Antippen einer Kategorie wird die Liste im aktuellen Editor wieder eingeklappt. Die **explizit gewählte Aufklapp-Einstellung** bleibt in IndexedDB gespeichert und wird beim nächsten Öffnen des Editors wiederhergestellt.
- Ein bislang unbekannter Kategoriename wird erst beim **Speichern des Zeiteintrags** dauerhaft angelegt. Auch eine zuvor entfernte Kategorie wird dadurch wieder angeboten.
- Kategorien lassen sich ausschließlich unter **Einstellungen → Kategorien** verwalten und nach Bestätigung entfernen. Historische Einträge bleiben unverändert; das Löschen von Einträgen oder Zeiträumen entfernt keine Kategorien.
- Keine Datenbankschema-Migration erforderlich: die Aufklapp-Einstellung nutzt einen zusätzlichen Datensatz im bestehenden IndexedDB-`settings`-Store. Backupformat (Version 2) bleibt unverändert. Die Aufklapp-Einstellung ist eine lokale Gerätepräferenz und nicht Teil des JSON-Backups.

## Funktionsumfang POC 0.18

**Design seit 0.10:** Ursprüngliches grünes PWA-Uhrenlogo aus 0.8 wiederhergestellt, ergänzt durch die passende Markenmarke im Header. Die Oberfläche ist etwas wärmer und eleganter: dunkles Tannengrün statt kaltem Anthrazit, abgestimmte helle Farben, mehr Raum für den Timer, sanfte Lichtakzente ausschließlich in der Timer-Karte, dezente Schatten und einheitliche Rundungen. Weiterhin keine Werbe-/Motivationsslogans, keine externen Schriften und keine zusätzlichen UI-Funktionen. **Keine Änderung an IndexedDB, Timer-Logik oder JSON-Schema.**

**Neu in 0.8:** Automatische Prüfung auf PWA-Updates mit zurückhaltendem Reload-Dialog und sicherer Aktivierung nach Bestätigung. 0.7 enthielt bereits: Einstellungen öffnen auf Smartphones als Vollbild-Dialog analog zum Eintragseditor (mit Safe-Area-Abstand). Unter „Daten löschen“ ist „Gesamte Historie“ vorausgewählt, unter „CSV-Export“ unverändert „Gesamte Historie“. Löschen erfordert weiterhin eine separate Bestätigung und ist bei aktivem Timer gesperrt.

- Start, Pause, Weiter, Stop (auch nach Reload/Schließen des Browsers korrekt)
- Maximal ein aktiver Timer je Browser-Origin – auch in mehreren Tabs
- Stop öffnet sofort einen Editor; unvervollständigte Einträge bleiben erhalten
- Kategorie/Notiz erfassen, dauerhaft gespeicherte Kategorien als Vorschläge (nach letzter Verwendung sortiert)
- Start-/End-Uhrzeit nachträglich korrigieren; Datum ist optional aufklappbar und wird normalerweise unverändert beibehalten. Beim Speichern unveränderter Uhrzeiten bleibt auch die ursprüngliche Sekunden- und Millisekundenpräzision erhalten.
- Pausen im erweiterten Editor bearbeiten
- Tageshistorie und korrekt auf lokale Kalendertage aufgeteilte Arbeitszeit
- Eintrag nach Bestätigung löschen mit **9 Sekunden Rückgängig**
- Woche mit Bestätigung löschen (Montag–Sonntag): wie bei Tageslöschung bleiben tatsächliche Arbeitszeiten außerhalb des gewählten Wochenintervalls erhalten, auch über Mitternacht/Sommerzeit
- Tag mit Bestätigung löschen: nur dessen **gearbeitete** Zeit wird entfernt, andere Tagesanteile bleiben erhalten. Gesplittete Einträge behalten Kategorie und Beschreibung
- CSV-Export: gesamte Historie, diese/letzte Woche, dieser/letzter Monat oder eigener Datumsbereich; eine Zeile je vollständiger Zeiterfassung
- **CSV teilen:** auf Browsern mit nativer Dateifreigabe zusätzlich zum Download ein systemweiter „Teilen“-Button. Erstellt die CSV direkt aus dem lokalen Snapshot und ruft `navigator.share()` synchron beim Klick auf (kein E-Mail-/mailto-Sonderweg). Auf anderen Browsern wird die Aktion ausgeblendet.
- Kategorien als größere, fingerfreundliche Auswahl-Schaltflächen (ohne benachbarte Löschsymbole). Über **Einstellungen → Kategorien** kann man Kategorien separat entfernen, immer nach Bestätigung. Dadurch werden **keine** historischen Einträge gelöscht. Die Kategorienliste ist von der Historie unabhängig. Vorschläge bleiben beim Löschen von Einträgen, Tagen, Wochen oder der gesamten Historie erhalten. Nur ausdrückliches Entfernen löscht sie aus der Liste; eine erneute Eingabe legt sie wieder an. Die Kategorienliste ist im JSON-Backup enthalten.
- Vollständiges JSON-Backup und validierter Restore, der den aktuellen Bestand nach eigener App-Bestätigung **ersetzt**
- Einheitliche eigene Bestätigungsdialoge statt `window.confirm()` für Eintrag, Tag, Woche, Zeitraum, Vorschlag und Restore; Zeitraum-/Historienlöschung nur bei gestopptem Timer
- **Zeitraum löschen** unter Einstellungen: analog zum CSV-Export gesamte Historie, diese/letzte Woche, dieser/letzter Monat oder eigener Datumsbereich (beide Daten Pflicht). Vorher zeigt die App Anzahl betroffener Zeiterfassungen und Nettodauer. Andere Tagesanteile bleiben erhalten; die Aktion muss bestätigt werden, danach kein Undo.
- System-, helles und dunkles Theme am Ende der Einstellungen
- **Reduzierte UI:** Timer zeigt nur Bereit/Läuft/Pausiert, Uhrzeit und Start/Pause/Weiter/Stop. Werbliche Beschreibungen, Startanweisungen und doppelte Labels entfernt.
- Mobile Vollbild-Bearbeitung, kleine fixierte Timer-Leiste beim Scrollen
- Service Worker + PWA-Manifest (Offline-App-Shell)

**CSV-Format (aktualisiert in 0.26):** Alle Spalten heißen einheitlich auf Englisch in `snake_case`: `id`, `started_at`, `stopped_at`, `category`, `description`, `status`, `paused_minutes`, `worked_minutes`. Start und Ende werden als **lokale Datum-Uhrzeit-Werte ohne Zeitzone** (z. B. `2026-10-26 09:15:00`) ohne Millisekunden exportiert. Bei einer Zeitumstellung können gleiche lokale Uhrzeiten mehrfach vorkommen. Für eine eindeutige zeitliche Wiederherstellung weiterhin JSON-Backups verwenden. Pausen- und Nettodauer werden unabhängig voneinander **kaufmännisch auf ganze Minuten gerundet** (`30 Sekunden → 1 Minute`); dadurch können die gerundeten Werte bei kurzen Einträgen rechnerisch um eine Minute von der gerundeten Gesamtdauer abweichen. Die präzisen Zeitdaten bleiben in IndexedDB und im JSON-Backup unverändert. CSV ist weiterhin UTF-8 mit **BOM**, **Semikolon** als Trennzeichen, korrektem Escaping und Schutz vor Spreadsheet-Formelinjektion. Ein Zeitraumfilter selektiert Einträge, deren tatsächliche Arbeitsintervalle den Zeitraum überlappen, exportiert dann aber immer den kompletten Eintrag. Laufende Timer sind nicht in CSV, wohl aber in JSON-Backups enthalten.

**Backup:** Seit Zeitspur 0.6 verwendet `zeitspur-backup`, Schema-Version 2. Wird ein gesicherter, noch aktiver Timer importiert, wird er sicher als **gestoppt und offen** übernommen, damit beim Import keine fiktiven zusätzlichen Arbeitsstunden entstehen. Restore ist nur bei gestopptem Timer möglich und ersetzt Sessions, Theme und die **dauerhafte Kategorienliste**. Es gibt noch **keine Migration**: Backups der Version 1 werden nicht importiert. Bitte bei Bedarf vor dem Update eine externe Sicherung der früheren Daten aufbewahren. Vor dem Restore ein Backup der aktuellen Daten herunterladen! JSON-Import auf 25 MB begrenzt.

**Speicher und Weiterentwicklung:** Die Datenbank heißt weiterhin `zeitspur-v1`. Bestehende Sessions bleiben unter derselben Origin in IndexedDB erhalten. **Keine Kategorienmigration:** Die neue Kategorienliste startet leer und wird nur durch ab 0.6 neu verwendete Kategorien befüllt; frühere Kategorie-Vorschläge werden nicht aus älteren Zeiterfassungen übernommen. Die Datenbankversion bleibt unverändert, es erfolgt kein Schema-Upgrade. Veränderte Origin (`http`, `https`, Hostname oder Port) = andere Browserdaten. Cache und Browserdaten können durch Löschen der Website-Daten verloren gehen; regelmäßig JSON-Backups erstellen. Der Service Worker hält die Anwendung offline verfügbar, nicht die Zeit aktiv am Laufen. Die Zeit basiert auf gespeicherten Zeitstempeln.

## Tests

Nach `npm run build` oder `npm run build:standalone`:

```bash
npm run test:logic
npm run test:pwa
npm run test:share
```

Prüft u. a. das CSV-Format (lokale Uhrzeit ohne Offset über Zeitumstellung, auch bei 45-Minuten-Zeitzonen, kaufmännische Rundung), Pausen, unabhängig gespeicherte Kategorien inkl. Entfernen und JSON-Sicherung, Wiederherstellung laufender Timer, Sekundenanzeige, Mitternacht, Berliner Sommerzeit (23-/25-Stunden-Tage), Tages-, Wochen- und freie Zeitraum-Löschung, Pflichtfelder für frei gewählte Zeiträume, Teilschnitt über Mitternacht, Null-Dauer-Einträge, CSV-Escaping und JSON-Backup-Validierung.

Ein zusätzlicher netzwerkfreier Chromium-Layouttest (`python tests/mobile-category-layout.py`) simuliert die reduzierte Smartphone-Viewporthöhe bei geöffneter Tastatur und prüft, dass die Vorschlagsliste Platz erhält und die Leiste danach wieder erscheint. Er ersetzt **keinen** Test mit echter Android-Tastatur.

Die optionalen Browser-End-to-End-Tests liegen in `tests/browser_smoke.py` und `tests/browser-categories.py`. Letzterer prüft zusätzlich mobile Schnellauswahl, Suche, gespeicherten Aufklappzustand sowie Entfernen und erneutes Verwenden einer Kategorie. Beide benötigen Python-Playwright, Chromium und eine Browser-Umgebung, die die Test-Origin nicht blockiert.

Der ursprüngliche Browser-Test liegt in `tests/browser_smoke.py`. Er erfordert Python-Playwright mit Chromium und einen laufenden statischen HTTP-Server auf Port 8080. Er muss in einer Browser-Umgebung mit erlaubtem localhost-Zugriff ausgeführt werden. Hier konnte er wegen `net::ERR_BLOCKED_BY_ADMINISTRATOR` **nicht** erfolgreich ausgeführt werden.

## Architektur

- `src/db.ts`: IndexedDB, atomare Timerzustandswechsel, Löschen/Restore
- `src/records.ts`: Zeitbearbeitung, Pausen, Tages-/Wochenlöschung
- `src/transfers.ts`: CSV-Export, JSON-Backup und strikte Importvalidierung
- `src/file-share.ts`: plattformabhängige Dateifreigabe (`.json` / `.txt`), von CSV und Backup gemeinsam genutzt
- `src/time.ts`: Berechnung, Kalender-Tagesaufteilung und Sommerzeit
- `src/ranges.ts`: gemeinsame Zeitraum-Auswahl und Löschvorschau
- `src/main.ts`: Bedienoberfläche und Browser-Tabs
- `src/pwa-updates.ts`: eigenständige Update-Erkennung auch beim Umstieg aus Versionen mit altem Service Worker
- `src/styles.css`: responsive UI, Themes
- `scripts/build-standalone.mjs`, `scripts/write-sw.mjs`: Build und Offline-Cache

## Grenzen des Prototyps

- Keine Cloud-Synchronisierung zwischen Geräten; Übertragen per JSON-Backup.
- Die Browser-E2E-Tests sind noch auszuführen, bevor die App als dauerhaft verlässliches Arbeitszeitarchiv empfohlen werden kann.
- Bei wiederholten lokalen Uhrzeiten während der Zeitumstellung wählt eine **manuell geänderte** lokale Uhrzeit den vom Browser interpretierten Offset. Unveränderte Zeiten behalten ihren ursprünglichen UTC-Zeitpunkt.
- Bei konkurrierender Bearbeitung im zweiten Tab verhindert die `revision`-Prüfung unbemerktes Überschreiben; ein manueller Neuaufruf ist erforderlich.
- Manuell eingetragene, zeitlich überlappende Sessions werden noch nicht mit einer expliziten Doppelzählungswarnung markiert.

## Änderungen in POC 0.6 (bereits vorhanden)

- CSV-Teilen per **nativer Web Share API für Dateien**, nur bei ausreichender Browserunterstützung; Download bleibt separat erhalten. Anders als der frühere „E-Mail“-Button gibt es keinen `mailto:`-Fallback. Der eigentliche `share()`-Aufruf erfolgt direkt im Klick-Handler, damit die notwendige Benutzeraktivierung erhalten bleibt.
- Unter **Daten löschen** dieselben Zeitraumoptionen wie beim CSV-Export. Standard ist gesamte Historie. Bei freiem Zeitraum müssen beide Daten angegeben werden. Anzahl betroffener Einträge und Nettoarbeitszeit werden vor dem Bestätigungsdialog angezeigt.
- Mitternacht und Zeitumstellung werden über lokale Tagesgrenzen behandelt, nicht über 24-Stunden-Intervalle. Nur Arbeitszeit im ausgewählten Bereich wird aus den Intervallen entfernt. Andere Anteile werden als weiterhin gültige Einträge erhalten, ggf. aufgeteilt.
- Leere Zeitintervalle (sofort gestoppte Timer mit 0 Sekunden) werden anhand des Startdatums beim Filtern und Löschen berücksichtigt.
- Minimalistische Oberfläche: keine Überschriften „Bereit wenn du es bist“, „Fokuszeit“, „Deine nächste Zeiterfassung“, keine zusätzlichen Timer-Erklärungen oder ausladenden Leerzustände. Kompaktere Timer-Kachel.
- Datenbankname (`zeitspur-v1`) bleibt unverändert; das Backupformat verwendet weiterhin Schema-Version 2. Bestehende Einträge bleiben bei gleicher Origin erhalten.

**Tests:** `npm run build:standalone` und `npm run test:logic` erfolgreich. Der Browser-End-to-End-Test muss separat unter einem Browser mit freiem localhost-Zugriff ausgeführt werden. Mobile Dateifreigabe muss auf einem tatsächlichen Android-Gerät mit installierter PWA und HTTPS getestet werden. Die funktionierende Übergabe an eine konkrete Ziel-App hängt von Browser und Teilen-Ziel ab.

## Änderungen in POC 0.7 (UI)

- Einstellungen auf Smartphones genauso vollflächig wie den Eintragseditor anzeigen. Desktop-Dialog bleibt unverändert.
- Vorbelegung unter „Daten löschen“: **Gesamte Historie** statt „Diese Woche“. Jede Löschung bleibt bestätigt und bei aktivem Timer gesperrt.
- Keine Änderungen an IndexedDB, Backup-Format oder Kategorien.

## Design-Prinzipien ab 0.10

- Zweck vor Dekoration: keine Gradients, Glows, auffälligen Status-Badges oder werblichen Texte.
- Eine neutrale Grundpalette und genau eine Akzentfarbe für Interaktion.
- Semantische Farben: Grün nur bei laufender Messung, Orange nur für Pausen/offene Dokumentation, Rot für destruktive Aktionen.
- Kontrast und Klickflächen: textbasierte Schaltflächen statt reine Symbol-Leisten; Bearbeiten/Löschen sind mindestens 42 × 44 Pixel groß.
- Ein einheitliches kleines Radius-System (6–13 px), keine animierten Karten.
- Keine externen Fonts oder Bildbibliotheken.
- Farbangaben zentral als CSS-Variablen; System-Theme aktualisiert auch die Browser-Themenfarbe bei Wechsel der Betriebssystem-Einstellung.
- SVG-Quelle des PWA-Icons: `public/icons/icon.svg` (die klassischen PNG-PWA-Icons stammen unverändert aus 0.8 und tragen neue Dateinamen, damit der Browser sie nach dem Design-Update erneut abruft).

**Manuelle Sichtprüfung:** Weil Chromium in dieser Umgebung selbst lokale Navigation mit `ERR_BLOCKED_BY_ADMINISTRATOR` blockiert, konnten die überarbeiteten Light-/Dark-Layouts noch nicht visuell per Browser-Screenshot und Touch-Interaktion abgenommen werden. Bitte auf einem realen Desktop und Smartphone nachtesten.
