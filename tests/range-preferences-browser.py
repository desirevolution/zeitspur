"""Browser regression using in-memory HTTPS routing; no live network/server needed."""
from pathlib import Path
from urllib.parse import urlparse, unquote
from mimetypes import guess_type
from playwright.sync_api import sync_playwright, Error as PlaywrightError

root = Path(__file__).resolve().parents[1] / 'dist'
origin = 'https://zeitspur.test'

def serve(route):
    raw = unquote(urlparse(route.request.url).path)
    target = (root / raw.lstrip('/')).resolve() if raw != '/' else root / 'index.html'
    if not target.is_relative_to(root.resolve()) or not target.is_file():
        route.fulfill(status=404, body='Not found')
        return
    mime = guess_type(target.name)[0] or 'application/octet-stream'
    if target.suffix == '.js': mime = 'text/javascript'
    route.fulfill(status=200, body=target.read_bytes(), content_type=mime)

with sync_playwright() as pw:
    browser = pw.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox','--disable-dev-shm-usage'])
    context = browser.new_context(viewport={'width': 390, 'height': 740}, locale='de-DE', service_workers='block')
    context.route('https://zeitspur.test/**', serve)
    page = context.new_page()
    try:
        page.goto(origin + '/', wait_until='domcontentloaded')
    except PlaywrightError as error:
        if 'ERR_BLOCKED_BY_ADMINISTRATOR' in str(error):
            print('SKIP: Browser-Navigation durch Testumgebung gesperrt (ERR_BLOCKED_BY_ADMINISTRATOR)')
            context.close()
            browser.close()
            raise SystemExit(0)
        raise
    page.get_by_role('button', name='Einstellungen öffnen').click()

    def selected(prefix):
        return page.locator(f'#{prefix}-preset').input_value()

    assert selected('export') == 'all'
    assert selected('delete') == 'all'
    page.locator('[data-range-for="export"][data-range-preset="week"]').click()
    page.locator('[data-range-for="delete"][data-range-preset="custom"]').click()
    page.locator('#delete-from').fill('2026-10-01')
    page.locator('#delete-to').fill('2026-10-20')
    assert selected('export') == 'week'
    assert selected('delete') == 'custom'
    page.locator('[data-action="close-settings"]').click()
    page.get_by_role('button', name='Einstellungen öffnen').click()
    assert selected('export') == 'week'
    assert selected('delete') == 'custom'
    assert page.locator('#delete-from').input_value() == '2026-10-01'
    assert page.locator('#delete-to').input_value() == '2026-10-20'
    page.locator('[data-action="close-settings"]').click()
    page.reload(wait_until='domcontentloaded')
    page.get_by_role('button', name='Einstellungen öffnen').click()
    assert selected('export') == 'week'
    assert selected('delete') == 'custom'
    assert page.locator('#delete-from').input_value() == '2026-10-01'
    assert page.locator('#delete-to').input_value() == '2026-10-20'
    page.locator('[data-action="close-settings"]').click()

    # A different browser profile has its own default preferences.
    second = browser.new_context(viewport={'width': 390, 'height': 740}, locale='de-DE', service_workers='block')
    second.route('https://zeitspur.test/**', serve)
    other = second.new_page()
    other.goto(origin + '/', wait_until='domcontentloaded')
    other.get_by_role('button', name='Einstellungen öffnen').click()
    assert other.locator('#export-preset').input_value() == 'all'
    assert other.locator('#delete-preset').input_value() == 'all'
    print('PASS: real Chromium UI, independent remembered presets, custom dates, reload, separate browser profiles')
    second.close()
    context.close()
    browser.close()
