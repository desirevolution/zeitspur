"""Network-free Chromium layout regression for the desktop documentation dialog.

Tests the real CSS against a long category list at regular and short desktop
viewport heights. The dialog header/footer must remain visible while only the
middle form content scrolls. Does not exercise native OS widgets.
"""
from pathlib import Path
from playwright.sync_api import sync_playwright

css = (Path(__file__).resolve().parents[1] / 'src' / 'styles.css').read_text()
chips = ''.join(f'<button type="button" class="category-select">Kategorie {i:02d}</button>' for i in range(1, 23))
html = f'''<!doctype html><html lang="de"><head><meta name="viewport" content="width=device-width, initial-scale=1"/><style>{css}</style></head><body>
<dialog id="editor-dialog"><form class="modal-content">
  <div class="modal-top"><h2>Zeit dokumentieren</h2><button type="button" class="icon-button">×</button></div>
  <div class="modal-body" id="editor-scroll-region">
    <div class="modal-summary">01:20:00</div>
    <div class="field-grid"><label class="field">Beginn<input type="time" value="09:00"/></label><label class="field">Ende<input type="time" value="10:20"/></label></div>
    <details class="date-editor"><summary>Datum ändern</summary><div class="field-grid"><label class="field">Beginn<input type="date" /></label><label class="field">Ende<input type="date" /></label></div></details>
    <label class="field">Kategorie<input id="category" value="" /></label>
    <div class="category-picker"><div class="category-picker-head">Alle Kategorien</div><div class="category-options">{chips}</div><button type="button" class="category-expand-button">Alle Kategorien anzeigen</button></div>
    <label class="field">Beschreibung<textarea rows="4"></textarea></label>
    <details class="pause-editor"><summary>Pausen bearbeiten</summary><p>Pause</p></details>
  </div>
  <div class="editor-footer"><p class="editor-requirements">Beschreibung fehlt</p><div class="modal-actions"><button type="button" class="button secondary">Später</button><button type="submit" class="button primary">Abschließen</button></div></div>
</form></dialog></body></html>'''

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox', '--disable-dev-shm-usage'])
    for height in [860, 600, 430]:
        page = browser.new_page(viewport={'width': 1100, 'height': height}, device_scale_factor=1)
        page.set_content(html)
        page.locator('#editor-dialog').evaluate('(dialog) => dialog.showModal()')
        metrics = page.evaluate('''() => {
          const d = document.querySelector('#editor-dialog');
          const top = d.querySelector('.modal-top');
          const body = d.querySelector('.modal-body');
          const footer = d.querySelector('.editor-footer');
          const buttons = [...footer.querySelectorAll('button')].map(b=>b.getBoundingClientRect().toJSON());
          const rect = el=>el.getBoundingClientRect().toJSON();
          return {dialog:rect(d), top:rect(top), body:rect(body), footer:rect(footer), buttons,
            scrollHeight:body.scrollHeight, clientHeight:body.clientHeight,
            dialogOverflow:getComputedStyle(d).overflowY};
        }''')
        assert metrics['dialog']['top'] >= 0 and metrics['dialog']['bottom'] <= height, (height, metrics)
        assert metrics['top']['bottom'] <= metrics['body']['top'] + 1, (height,metrics)
        assert metrics['body']['bottom'] <= metrics['footer']['top'] + 1, (height,metrics)
        assert metrics['buttons'] and all(0<=r['top'] and r['bottom'] <= height for r in metrics['buttons']), (height,metrics)
        assert metrics['scrollHeight'] > metrics['clientHeight'], (height,metrics)
        assert metrics['dialogOverflow'] == 'hidden', (height,metrics)
        footer_before = metrics['footer']['top']
        page.locator('.modal-body').evaluate('el => el.scrollTop = el.scrollHeight')
        footer_after = page.locator('.editor-footer').bounding_box()['y']
        assert abs(footer_before - footer_after) < 1, (height,footer_before,footer_after)
        print(f'PASS: desktop {height}px, footer fixed, content scrollable')
        page.close()
    browser.close()
