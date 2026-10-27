"""Optional Playwright UI regression, run after `npm run build:standalone`.
Requires local navigation support and a Chromium installation.
"""
from playwright.sync_api import sync_playwright
from pathlib import Path
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from threading import Thread
import os

root = Path(__file__).resolve().parent.parent / 'dist'
class StaticFiles(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(root), **kwargs)
    def log_message(self, *_):
        pass
server = ThreadingHTTPServer(('127.0.0.1', 0), StaticFiles)
Thread(target=server.serve_forever, daemon=True).start()
base = f'http://127.0.0.1:{server.server_port}/'

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, executable_path=os.getenv('CHROMIUM_BIN') or None, args=['--no-sandbox'])
    issues = []
    for width in (1100, 390, 320):
        context = browser.new_context(viewport={'width': width, 'height': 840}, locale='de-DE', timezone_id='Europe/Berlin', service_workers='block')
        page = context.new_page()
        page.on('pageerror', lambda x: issues.append(str(x)))
        page.goto(base, wait_until='load')
        page.keyboard.press('n')
        dialog = page.locator('#editor-dialog')
        dialog.wait_for(state='visible')
        begin = dialog.locator('#entry-start-time')
        end = dialog.locator('#entry-end-time')
        assert dialog.locator('#period-net').is_visible()
        begin.fill('930')
        begin.blur()
        assert begin.input_value() == '09:30'
        begin.fill('09:00')
        end.fill('08:00')
        assert dialog.locator('#entry-range-error').is_visible()
        dialog.locator('#entry-end-day').select_option('next')
        assert dialog.locator('#entry-range-error').is_hidden()
        dialog.locator('#entry-end-day').select_option('same')
        end.fill('10:30')
        dialog.locator('input[name="period-mode"][value="duration"]').check()
        assert dialog.locator('#entry-duration').input_value() == '90'
        dialog.locator('#entry-duration').fill('120')
        assert dialog.locator('#period-gross').inner_text() == '2 h 00 min'
        dialog.locator('input[name="period-mode"][value="end"]').check()
        assert end.input_value() == '11:00'
        dialog.get_by_role('button', name='Pause hinzufügen').click()
        row = dialog.locator('[data-pause-row]').first
        assert row.locator('.pause-start').count() == 1
        assert dialog.locator('#period-break-total').inner_text() == '15 min'
        row.locator('.pause-end').fill(row.locator('.pause-start').input_value())
        assert row.locator('.pause-row-error').is_visible()
        assert dialog.get_by_role('button',name='Speichern').is_disabled()
        row.get_by_role('button', name='Pause entfernen').click()
        dialog.locator('#category').fill('Projekt')
        dialog.locator('#description').fill('Neue Erfassung')
        assert dialog.get_by_role('button', name='Speichern').is_enabled()
        dialog.get_by_role('button', name='Speichern').click()
        dialog.wait_for(state='hidden')
        page.get_by_text('Neue Erfassung').wait_for()
        assert page.evaluate('document.documentElement.scrollWidth <= innerWidth + 1'), f'Overflow at {width}px'
        context.close()
    assert not issues, issues
    browser.close()
    server.shutdown()
print('PASS: responsive editor, shorthand, overnight, duration mode, pauses, invalid block, manual save')
