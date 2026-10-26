"""Self-contained Chromium smoke test without requiring a localhost connection.
Requires Python Playwright and a Chromium executable.
"""
from pathlib import Path
from urllib.parse import urlparse, unquote
import mimetypes
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent / 'dist'
URL = 'https://tracker.test/'


def serve(route):
    path = unquote(urlparse(route.request.url).path).lstrip('/') or 'index.html'
    file = (ROOT / path).resolve()
    if not file.is_relative_to(ROOT.resolve()) or not file.is_file():
        route.fulfill(status=404, body='Not found')
        return
    kind = mimetypes.guess_type(str(file))[0] or 'application/octet-stream'
    if file.suffix == '.js': kind = 'application/javascript'
    route.fulfill(status=200, body=file.read_bytes(), content_type=kind)


def test():
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox', '--disable-dev-shm-usage'])
        context = browser.new_context(viewport={'width': 390, 'height': 844}, service_workers='block')
        page = context.new_page()
        page.route('https://tracker.test/**', serve)
        page.goto(URL, wait_until='domcontentloaded', timeout=15000)
        page.locator('button[data-action="start"]').wait_for(timeout=8000)
        page.evaluate('''async () => {
          const db = await new Promise((resolve, reject) => {const request=indexedDB.open('zeitspur-v1'); request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});
          const items = ['Design','Support','Planung','Testing','Meeting','Entwicklung','Recherche']
           .map((name,i)=>({name,lastUsedAt:1000+i}));
          await new Promise((resolve,reject)=>{const tx=db.transaction('settings','readwrite');tx.objectStore('settings').put({key:'categories',value:items});tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});
          db.close();
        }''')
        page.reload(wait_until='domcontentloaded')
        page.locator('button[data-action="start"]').click()
        page.locator('button[data-action="stop"]').click()
        editor = page.locator('#editor-dialog')
        editor.wait_for(state='visible', timeout=8000)
        options = editor.locator('#category-options [data-action="use-category"]')
        assert options.count() == 5, f'Quick list count: {options.count()}'
        assert 'Recherche' in options.all_text_contents()
        assert 'Design' not in options.all_text_contents()
        editor.locator('#category').fill('Ganz neu')
        assert options.count() == 5, 'Entering new text hides quick categories'
        editor.locator('#category-expand').click()
        assert editor.locator('#category-search').is_visible()
        assert options.count() == 7
        editor.locator('#category-search').fill('design')
        assert options.all_text_contents() == ['Design']
        options.first.click()
        assert editor.locator('#category').input_value() == 'Design'
        assert not editor.locator('#category-search').is_visible(), 'Selection should collapse category list'
        editor.locator('[data-action="close-editor"]').first.click()
        page.locator('[data-action="edit"]').first.click()
        assert editor.locator('#category-search').is_visible(), 'Expanded preference was not restored'
        editor.locator('[data-action="close-editor"]').first.click()
        page.locator('[data-action="settings"]').click()
        settings = page.locator('#settings-dialog')
        settings.locator('#settings-category-search').fill('design')
        assert settings.locator('.category-manage-row').count() == 1
        settings.locator('[data-action="remove-stored-category"]').click()
        page.locator('#confirm-dialog #confirm-accept').click()
        assert settings.locator('.category-manage-row').count() == 0
        settings.locator('[data-action="close-settings"]').first.click()
        page.locator('[data-action="edit"]').first.click()
        editor.locator('#category').fill('Design')
        editor.locator('#description').fill('Test: Kategorie wieder anlegen')
        editor.locator('#editor-form button[type="submit"]').click()
        page.locator('[data-action="settings"]').click()
        settings.locator('#settings-category-search').fill('design')
        assert settings.locator('.category-manage-row').count() == 1, 'Category not re-added on save'
        context.close()
        browser.close()
        print('PASS: mobile browser category quick picks, full search, selection collapse, saved expansion, settings removal, re-add')


if __name__ == '__main__':
    test()
