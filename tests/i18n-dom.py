"""Test in-browser translation of UI nodes without loading a network URL."""
from pathlib import Path
from playwright.sync_api import sync_playwright
compiled=(Path(__file__).resolve().parents[1]/'dist/assets/i18n.js').read_text()
compiled=compiled.replace('export ', '')
with sync_playwright() as playwright:
  browser=playwright.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage'])
  page=browser.new_page(locale='en-GB')
  page.set_content('''<!doctype html><html lang="de"><head><title>Zeitspur</title></head><body>
    <main id="test"><button aria-label="Einstellungen öffnen">Einstellungen</button>
    <input placeholder="Kategorien durchsuchen">
    <p class="history-title"><span translate="no">Heute</span></p>
    <div class="history-details"><p>Beschreibung</p></div>
    <button class="category-select" data-category="Einstellungen">Einstellungen</button>
    <div><span>Gesamte Historie</span></div></main></body></html>''')
  page.add_script_tag(content=compiled)
  page.evaluate('''() => {setUiLanguage('en'); translateUi(document.querySelector('#test'))}''')
  assert page.locator('html').get_attribute('lang')=='en'
  assert page.get_by_role('button',name='Open settings').is_visible()
  assert page.locator('input').get_attribute('placeholder')=='Search categories'
  assert page.locator('[translate="no"]').inner_text()=='Heute'
  assert page.locator('.category-select').inner_text()=='Einstellungen'
  assert page.get_by_text('Entire history').is_visible()
  page.close()
  browser.close()
print('PASS: browser UI localization, English labels, user data stays unchanged')
