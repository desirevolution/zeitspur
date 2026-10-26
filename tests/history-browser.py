"""Browser integration without localhost networking; serve the actual dist files through route.fulfill."""
from pathlib import Path
from urllib.parse import urlparse, unquote
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[1]/'dist'
TYPES={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.webmanifest':'application/manifest+json','.svg':'image/svg+xml','.png':'image/png'}

with sync_playwright() as p:
  browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage'])
  for width,height in [(1100,800),(390,844),(320,500)]:
    context=browser.new_context(viewport={'width':width,'height':height},locale='de-DE')
    page=context.new_page()
    errors=[]
    page.on('pageerror',lambda e: errors.append(str(e)))
    def serve(route):
      path=unquote(urlparse(route.request.url).path).lstrip('/') or 'index.html'
      filepath=(ROOT/path).resolve()
      if not filepath.is_relative_to(ROOT) or not filepath.is_file():
        route.fulfill(status=404,body='Not found')
      else:
        route.fulfill(status=200,body=filepath.read_bytes(),content_type=TYPES.get(filepath.suffix,'application/octet-stream'))
    page.route('https://zeitspur.test/**',serve)
    page.goto('https://zeitspur.test/',wait_until='domcontentloaded')
    page.get_by_role('button',name='Start').wait_for(timeout=10000)
    page.evaluate('''async () => {
      const db=await new Promise((resolve,reject)=>{
        const r=indexedDB.open('zeitspur-v1',1);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);
      });
      const tx=db.transaction('sessions','readwrite');const store=tx.objectStore('sessions');
      const now=new Date();
      for (let n=0;n<15;n++) {
        const date=new Date(now.getFullYear(),now.getMonth(),now.getDate()-n*7,12);
        const start=date.getTime()-2*3600000;
        store.put({id:'test-'+n,status:'completed',startedAt:start,stoppedAt:start+3600000,
          segments:[{start,end:start+3600000}],category:'Entwicklung',description:'Historien-Test '+n,
          createdAt:start,updatedAt:start,revision:1});
      }
      await new Promise((resolve,reject)=>{tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error)});
      db.close();
    }''')
    page.reload(wait_until='domcontentloaded')
    page.locator('.week-heading').first.wait_for(timeout=10000)
    assert page.locator('.week-heading').count()>=2
    assert page.locator('.week-heading').first.get_attribute('aria-expanded')=='true'
    assert page.locator('.month-heading').count()>=1
    assert page.locator('.month-heading').first.get_attribute('aria-expanded')=='false'
    assert page.locator('.day-head').first.get_attribute('aria-expanded')=='true'
    week=page.locator('.week-heading').first
    week.click()
    assert week.get_attribute('aria-expanded')=='false'
    week.click()
    assert week.get_attribute('aria-expanded')=='true'
    m=page.locator('.month-heading').first
    m.click()
    assert m.get_attribute('aria-expanded')=='true'
    page.locator('.month-content').first.locator('.week-heading').first.click()
    assert page.locator('.month-content').first.locator('.week-heading').first.get_attribute('aria-expanded')=='true'
    assert page.evaluate('document.documentElement.scrollWidth <= innerWidth + 1'),f'horizontal overflow at {width}'
    assert not errors,errors
    print(f'PASS: {width}x{height} actual app week/month toggles, default collapse, no overflow')
    context.close()
  browser.close()
