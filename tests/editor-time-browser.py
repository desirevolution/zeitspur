from playwright.sync_api import sync_playwright
from pathlib import Path
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from threading import Thread
import os
root=Path(__file__).resolve().parent.parent / 'dist'
class StaticFiles(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(root), **kwargs)
    def log_message(self, fmt, *args):
        pass

server = ThreadingHTTPServer(('127.0.0.1', 0), StaticFiles)
Thread(target=server.serve_forever, daemon=True).start()
base = f'http://127.0.0.1:{server.server_port}/'

with sync_playwright() as p:
    browser=p.chromium.launch(headless=True,executable_path=os.getenv('CHROMIUM_BIN') or None, args=['--no-sandbox'])
    context=browser.new_context(viewport={'width':1100,'height':850}, timezone_id='Europe/Berlin', service_workers='block')
    page=context.new_page()
    issues=[]
    page.on('pageerror',lambda x:issues.append(str(x)))
    page.goto(base, wait_until='load')
    page.get_by_role('button',name='Start',exact=True).wait_for(timeout=10000)
    page.get_by_role('button',name='Start',exact=True).click()
    page.wait_for_timeout(800)
    page.get_by_role('button',name='Stop',exact=True).click()
    dialog=page.locator('#editor-dialog')
    dialog.wait_for(state='visible')
    start=dialog.locator('#entry-start-time')
    end=dialog.locator('#entry-end-time')
    start.fill('12:00')
    end.fill('11:00')
    assert dialog.locator('#entry-range-error').is_visible(), 'Missing inline error for inverted work time'
    assert 'Beginn darf nicht' in dialog.locator('#entry-range-error').inner_text()
    assert dialog.get_by_role('button', name='Abschließen').is_disabled()
    assert dialog.locator('#editor-requirements').is_visible(), 'Visible fixed footer should describe invalid range'
    end.fill('13:00')
    assert dialog.locator('#entry-range-error').is_hidden(), 'Error must disappear when corrected'
    assert dialog.get_by_role('button',name='Abschließen').is_enabled()
    dialog.locator('details.pause-editor').evaluate('(el) => el.open=true')
    dialog.get_by_role('button',name='+ Pause hinzufügen').click()
    rows=dialog.locator('[data-pause-row]')
    assert rows.count()==1
    pause_start=rows.first.locator('.pause-start')
    pause_end=rows.first.locator('.pause-end')
    p_start = pause_start.input_value()
    p_end = pause_end.input_value()
    assert p_start != p_end
    pause_end.fill(p_start)
    assert rows.first.locator('.pause-row-error').is_visible(), 'Break error not visible'
    assert dialog.get_by_role('button',name='Abschließen').is_disabled(), 'Invalid break should block save'
    pause_end.fill(p_end)
    assert rows.first.locator('.pause-row-error').is_hidden()
    assert dialog.get_by_role('button',name='Abschließen').is_enabled()
    dialog.locator('#category').fill('Entwicklung')
    dialog.locator('#description').fill('UX Test')
    dialog.get_by_role('button',name='Abschließen').click()
    dialog.wait_for(state='hidden')
    page.get_by_text('UX Test').wait_for()
    # Confirm stored pause uses only local clock inputs again when edited.
    entry=page.locator('.history-row').filter(has_text='UX Test')
    entry.get_by_role('button',name='Eintrag bearbeiten').click()
    dialog.wait_for(state='visible')
    assert dialog.locator('.pause-start').count() == 1
    assert dialog.locator('.pause-start').input_value() == p_start
    assert dialog.locator('.pause-end').input_value() == p_end
    # Move the end before start again in existing session: should be visible immediately.
    dialog.locator('#entry-end-time').fill('11:00')
    assert dialog.locator('#entry-range-error').is_visible()
    assert dialog.get_by_role('button',name='Abschließen').is_disabled()
    dialog.locator('#entry-end-time').fill('13:00')
    assert dialog.locator('#entry-range-error').is_hidden()
    # Over-midnight is valid when date differs, without interpreting clock-only comparison.
    dialog.locator('details.date-editor').evaluate('(el) => el.open=true')
    first_date=dialog.locator('#entry-start-date').input_value()
    from datetime import date, timedelta
    previous=(date.fromisoformat(first_date)-timedelta(days=1)).isoformat()
    dialog.locator('#entry-start-date').fill(previous)
    dialog.locator('#entry-start-time').fill('23:00')
    dialog.locator('#entry-end-time').fill('01:00')
    assert dialog.locator('#entry-range-error').is_hidden(), 'Across-midnight work is valid'
    assert not issues, f'Page errors: {issues}'
    print('PASS: browser work & break constraints, inline warning, fixed-footer hint, edit existing break, overnight')
    # Mobile quick layout check
    mcontext=browser.new_context(viewport={'width':390,'height':844},is_mobile=True,has_touch=True,timezone_id='Europe/Berlin',service_workers='block')
    mobile=mcontext.new_page()
    mobile.goto(base, wait_until='load')
    mobile.get_by_role('button',name='Start',exact=True).click()
    mobile.get_by_role('button',name='Stop',exact=True).click()
    mobile.locator('#editor-dialog').wait_for(state='visible')
    mobile.locator('#entry-end-time').fill('01:00')
    mobile.locator('#entry-start-time').fill('22:00')
    assert mobile.locator('#entry-range-error').is_visible()
    assert mobile.locator('#editor-requirements').is_visible()
    assert mobile.evaluate('document.documentElement.scrollWidth <= window.innerWidth+1')
    print('PASS: mobile range validation and narrow layout')
    browser.close()
    server.shutdown()
