"""Network-free Chromium layout regression for compact mobile category entry.

The 420px viewport approximates the portion of the screen left above a mobile
software keyboard. This tests the actual CSS but cannot simulate native IME behavior.
"""
from pathlib import Path
from playwright.sync_api import sync_playwright

css = (Path(__file__).resolve().parents[1] / 'src' / 'styles.css').read_text()
chips = ''.join(f'<button type="button" class="category-select">{s}</button>' for s in ['Entwicklung','Meeting','Dokumentation','Planung','Support'])
html = f'''<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"/><style>{css}</style></head><body>
<dialog id="editor-dialog" open><form class="modal-content">
<div class="modal-top"><h2>Zeit dokumentieren</h2><button type="button">×</button></div>
<div class="modal-body" id="editor-scroll-region">
<div class="modal-summary">42m</div>
<div class="field-grid"><label class="field">Beginn<input type="time" value="08:00"/></label><label class="field">Ende<input type="time" value="08:42"/></label></div>
<div class="date-editor">Datum ändern</div>
<label class="field">Kategorie<input id="category" value=""/></label>
<div id="category-picker" class="category-picker"><div class="category-picker-head">Zuletzt verwendet</div><div class="category-options">{chips}</div><button type="button" class="category-expand-button">Alle Kategorien anzeigen</button></div>
<label class="field">Beschreibung<textarea></textarea></label>
</div><div class="editor-footer"><p class="editor-requirements">Beschreibung fehlt</p><div class="modal-actions"><button type="button" class="button secondary">Später</button><button type="button" class="button primary">Abschließen</button></div></div>
</form></dialog></body></html>'''

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox', '--disable-dev-shm-usage'])
    page = browser.new_page(viewport={'width':390,'height':420}, device_scale_factor=1)
    page.set_content(html, wait_until='domcontentloaded')
    def geom():
        return page.evaluate('''() => {
            const d = document.getElementById('editor-dialog');
            const body = d.querySelector('.modal-body');
            const footer = d.querySelector('.editor-footer');
            const input = d.querySelector('#category');
            const first = d.querySelector('.category-select');
            return { bodyHeight: body.getBoundingClientRect().height,
                footerDisplay: getComputedStyle(footer).display,
                inputTop:input.getBoundingClientRect().top,
                firstBottom:first.getBoundingClientRect().bottom,
                bodyBottom:body.getBoundingClientRect().bottom };
        }''')
    initial = geom()
    assert initial['footerDisplay'] != 'none', initial
    page.locator('#editor-dialog').evaluate("d => d.classList.add('category-picking')")
    page.locator('#category').evaluate('''el => {
        const body = el.closest('.modal-body');
        body.scrollTop += el.getBoundingClientRect().top - body.getBoundingClientRect().top - 12;
    }''')
    picking = geom()
    assert picking['footerDisplay'] == 'none', picking
    assert picking['bodyHeight'] > initial['bodyHeight'] + 50, (initial, picking)
    assert picking['firstBottom'] <= picking['bodyBottom'], picking
    page.locator('#editor-dialog').evaluate("d => d.classList.remove('category-picking')")
    restored = geom()
    assert restored['footerDisplay'] != 'none', restored
    print('PASS: mobile keyboard-height viewport, category suggestions visible, actions restored')
    browser.close()
