from playwright.sync_api import sync_playwright
from pathlib import Path
import os

URL=os.getenv('TIMETRACKER_TEST_URL', 'http://127.0.0.1:8080/')
SHOTS = Path(__file__).parent / 'screenshots'
SHOTS.mkdir(exist_ok=True)
with sync_playwright() as p:
    browser=p.chromium.launch(headless=True,executable_path=os.getenv('CHROMIUM_BIN') or None)
    context=browser.new_context(viewport={'width':1200,'height':900},device_scale_factor=1)
    page=context.new_page()
    errors=[]
    page.on('pageerror',lambda error: errors.append(str(error)))
    page.goto(URL,wait_until='networkidle')
    page.get_by_role('button',name='Start').wait_for()
    page.screenshot(path=str(SHOTS / 'desktop-start.png'),full_page=True)
    page.get_by_role('button',name='Start').click()
    page.wait_for_timeout(1400)
    assert page.locator('.timer-display').inner_text() != '00:00:00', 'running clock not updating'
    page.reload(wait_until='networkidle')
    assert page.get_by_role('button',name='Pause').is_visible(), 'timer not restored'
    page.get_by_role('button',name='Pause').click()
    frozen=page.locator('.timer-display').inner_text()
    page.wait_for_timeout(1300)
    assert frozen == page.locator('.timer-display').inner_text(), 'paused timer changed'
    # Another tab cannot start because same active state is displayed.
    second=context.new_page()
    second.goto(URL,wait_until='networkidle')
    assert second.get_by_role('button',name='Weiter').is_visible(), 'second tab not synchronized'
    page.get_by_role('button',name='Weiter').click()
    page.wait_for_timeout(1100)
    page.get_by_role('button',name='Stop').click()
    page.locator('#editor-dialog[open]').wait_for()
    page.get_by_role('button',name='Später').click()
    page.get_by_text('Offene Einträge').wait_for()
    page.get_by_role('button',name='Start').click()
    page.get_by_role('button',name='Stop').click()
    page.locator('#editor-dialog[open]').wait_for()
    page.locator('#category').fill('Entwicklung')
    page.locator('#description').fill('Backend API geprüft')
    page.get_by_role('button',name='Speichern').click()
    page.get_by_text('Backend API geprüft').wait_for()
    page.reload(wait_until='networkidle')
    assert page.get_by_text('Backend API geprüft').is_visible()
    assert page.get_by_text('Offene Einträge').is_visible()
    page.screenshot(path=str(SHOTS / 'desktop-history.png'),full_page=True)
    assert errors == [], f'JS errors: {errors}'
    # Test PWA navigation offline after worker and cache install.
    page.wait_for_function("navigator.serviceWorker.controller !== null",timeout=10000)
    context.set_offline(True)
    page.reload(wait_until='domcontentloaded')
    assert page.get_by_text('Backend API geprüft').is_visible(), 'offline page did not load'
    context.set_offline(False)
    # POC 0.5: category selection is isolated from management and removal needs confirmation.
    row = page.locator('.history-row').filter(has_text='Backend API geprüft')
    row.get_by_role('button', name='Eintrag bearbeiten').click()
    editor = page.locator('#editor-dialog')
    assert editor.locator('.category-select').count() >= 1, 'category suggestions missing'
    assert editor.locator('.category-chip').count() == 0, 'old split tap targets still present'
    editor.get_by_role('button', name='Vorschläge verwalten').click()
    assert editor.locator('.category-manage-row').first.is_visible()
    editor.locator('[data-action="hide-category"]').first.click()
    confirm = page.locator('#confirm-dialog')
    confirm.wait_for(state='visible')
    assert 'Zeiterfassungen bleiben erhalten' in confirm.inner_text()
    confirm.get_by_role('button', name='Abbrechen').click()
    assert editor.locator('.category-manage-row').count() >= 1, 'cancel should keep suggestion'
    editor.locator('[data-action="hide-category"]').first.click()
    confirm.get_by_role('button', name='Vorschlag entfernen').click()
    editor.locator('.category-manage-row').first.wait_for(state='detached')
    editor.get_by_role('button', name='Schließen').click()
    assert page.get_by_text('Backend API geprüft').is_visible(), 'existing entries must be preserved'
    row.get_by_role('button', name='Eintrag löschen').click()
    confirm.wait_for(state='visible')
    confirm.get_by_role('button', name='Abbrechen').click()
    assert page.get_by_text('Backend API geprüft').is_visible(), 'cancel delete failed'
    page.get_by_role('button', name='Einstellungen öffnen').click()
    assert page.get_by_role('button', name='Herunterladen').is_visible()
    assert page.locator('#delete-preset').input_value() == 'all', 'delete should default to full history'
    page.locator('[data-range-for="delete"][data-range-preset="custom"]').click()
    assert page.locator('[data-action="delete-range"]').is_disabled()
    today=page.evaluate('(()=>{const d=new Date();return [d.getFullYear(),String(d.getMonth()+1).padStart(2,"0"),String(d.getDate()).padStart(2,"0")].join("-")})()')
    page.locator('#delete-from').fill(today)
    page.locator('#delete-to').fill(today)
    assert page.locator('[data-action="delete-range"]').is_enabled()
    page.locator('[data-action="delete-range"]').click()
    confirm.wait_for(state='visible')
    confirm.get_by_role('button', name='Abbrechen').click()
    assert page.get_by_text('Backend API geprüft').is_visible()
    page.get_by_role('button', name='Schließen').click()
    mobile=browser.new_context(viewport={'width':390,'height':844},device_scale_factor=1,is_mobile=True,has_touch=True)
    mobile_page=mobile.new_page()
    mobile_page.goto(URL,wait_until='networkidle')
    mobile_page.screenshot(path=str(SHOTS / 'mobile-start.png'),full_page=True)
    mobile_page.get_by_role('button', name='Einstellungen öffnen').click()
    settings_box = mobile_page.locator('#settings-dialog').bounding_box()
    assert settings_box is not None and settings_box['width'] > 370 and settings_box['height'] > 800, 'mobile settings not fullscreen'
    assert mobile_page.locator('#delete-preset').input_value() == 'all', 'mobile delete default incorrect'
    mobile_page.screenshot(path=str(SHOTS / 'mobile-settings.png'),full_page=True)
    mobile_page.locator('#settings-dialog').get_by_role('button', name='Schließen').click()
    mobile_page.get_by_role('button',name='Start').click()
    mobile_page.get_by_role('button',name='Stop').click()
    mobile_page.locator('#editor-dialog[open]').wait_for()
    dialogbox=mobile_page.locator('#editor-dialog').bounding_box()
    assert dialogbox['width'] > 370 and dialogbox['height'] > 800, 'mobile editor not fullscreen'
    mobile_page.screenshot(path=str(SHOTS / 'mobile-editor.png'),full_page=True)
    assert mobile_page.evaluate('document.documentElement.scrollWidth <= innerWidth+1'), 'horizontal overflow'
    print('PASS: timer, reload, pause, second tab, pending, history, persistence, offline SW, mobile fullscreen editor, JS console')
    browser.close()
