"""Offline Chromium layout regression: fixed settings header with scrolling content.

Runs without a web server or external network; tests real CSS at mobile and
short desktop sizes and checks the rendered Done action stays visible.
"""
from pathlib import Path
from playwright.sync_api import sync_playwright

root = Path(__file__).resolve().parents[1]
css = (root / 'src/styles.css').read_text()
source = (root / 'src/main.ts').read_text()
settings_fragment = source[source.index('settingsDialog.innerHTML = `'):source.index('translateUi(settingsDialog);', source.index('settingsDialog.innerHTML = `'))]
assert settings_fragment.count('data-action="close-settings"') == 1, 'One close action, in the header only'
assert 'class="modal-top settings-header"' in settings_fragment
assert 'class="settings-scroll"' in settings_fragment
assert 'class="modal-actions"' not in settings_fragment
assert 'id="settings-title"' in settings_fragment

long_categories = ''.join(f'<div class="category-manage-item"><button class="button outline">Kategorie {i:02d}</button></div>' for i in range(30))
html = f'''<!doctype html><html lang="de"><head>
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"/>
<style>{css}</style></head><body>
<dialog id="settings-dialog" aria-labelledby="settings-title">
<div class="modal-content settings-content">
  <div class="modal-top settings-header"><h2 id="settings-title">Einstellungen</h2>
    <button type="button" class="button primary settings-done" data-action="close-settings">Fertig</button></div>
  <div class="settings-scroll" id="settings-scroll-region">
    <h3 class="setting-heading">CSV-Export</h3><div class="range-grid">
      <button class="range-option">Gesamte Historie</button><button class="range-option">Diese Woche</button>
    </div><div class="settings-divider"></div><h3 class="setting-heading">Kategorien</h3>
    <input type="search" placeholder="Kategorien durchsuchen"/>
    <div class="category-manage-list">{long_categories}</div>
    <div class="settings-divider"></div><h3 class="setting-heading">Datensicherung</h3>
    <button class="button outline">JSON-Backup</button>
    <div class="settings-divider"></div><div class="setting-row"><strong>Sprache</strong>
      <button class="theme-option">Deutsch</button></div>
  </div>
</div></dialog>
<script>const d=document.querySelector('#settings-dialog');d.showModal();
d.addEventListener('click',e=>{{if(e.target.closest('[data-action="close-settings"]'))d.close()}});</script>
</body></html>'''

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox','--disable-dev-shm-usage'])
    for width,height in [(1200,860),(1000,600),(1000,430),(390,844),(390,560),(320,470)]:
        page = browser.new_page(viewport={'width':width,'height':height},device_scale_factor=1)
        page.set_content(html)
        metrics = page.evaluate('''() => {
          const d = document.querySelector('#settings-dialog');
          const h = d.querySelector('.settings-header');
          const b = d.querySelector('.settings-scroll');
          const done = h.querySelector('button');
          const rect = (element) => element.getBoundingClientRect().toJSON();
          return {dialog:rect(d),header:rect(h),body:rect(b),button:rect(done),
                  scrollHeight:b.scrollHeight,clientHeight:b.clientHeight,
                  dialogOverflow:getComputedStyle(d).overflowY,
                  headerText:done.textContent.trim()};
        }''')
        assert metrics['dialog']['top'] >= -.5 and metrics['dialog']['bottom'] <= height+.5, (width,height,metrics)
        assert metrics['header']['bottom'] <= metrics['body']['top']+.5, (width,height,metrics)
        assert metrics['button']['top'] >= -0.5 and metrics['button']['bottom']<=height+.5, (width,height,metrics)
        assert metrics['scrollHeight'] > metrics['clientHeight'], (width,height,metrics)
        assert metrics['dialogOverflow']=='hidden', (width,height,metrics)
        before = page.locator('.settings-header').bounding_box()['y']
        page.locator('.settings-scroll').evaluate('(el) => { el.scrollTop = el.scrollHeight; }')
        after = page.locator('.settings-header').bounding_box()['y']
        assert abs(before-after) < 1, (width,height,before,after)
        assert page.locator('.settings-done').is_visible()
        # Escape closes the native modal without a click.
        page.keyboard.press('Escape')
        assert not page.locator('#settings-dialog').evaluate('(d)=>d.open')
        page.close()
        print(f'PASS: {width}x{height}, fixed settings header / scroll body / Escape')
    # Check the labeled button itself closes the dialog.
    page = browser.new_page(viewport={'width':390,'height':560})
    page.set_content(html)
    page.locator('.settings-done').click()
    assert not page.locator('#settings-dialog').evaluate('(d)=>d.open')
    print('PASS: Done closes the settings dialog')
    page.close()
    browser.close()
