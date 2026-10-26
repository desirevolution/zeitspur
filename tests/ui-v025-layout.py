"""0.25 renderer regression: direct actions, pending-card clipping and responsive layout."""
from pathlib import Path
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parents[1]
compiled=(root/'dist/assets/main.js').read_text()
renderer=compiled[compiled.index('function displayListDuration('):compiled.index('function render() {')]
css=(root/'src/styles.css').read_text()
js='''
const iconPaths={
 clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
 settings:'<path d="M4 7h16M4 17h16"/>',
 play:'<path d="m8 5 11 7-11 7z"/>',
 more:'<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
 chevron:'<path d="m6 9 6 6 6-6"/>',
 edit:'<path d="m15 5 4 4M3 21l4.5-1 12-12a2.1 2.1 0 0 0-3-3l-12 12z"/>',
 trash:'<path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14M10 10v7M14 10v7"/>',
 arrow:'<path d="m7 17 10-10M9 7h8v8"/>'};
const icon=(name,size=20)=>`<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${iconPaths[name]||''}</svg>`;
const escapeHtml=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
const intlLocale=()=> 'de-DE';
const tr=s=>s;
const now=Date.now(), midnight=new Date();midnight.setHours(0,0,0,0);
const at=(h,m)=> new Date(midnight.getFullYear(),midnight.getMonth(),midnight.getDate(),h,m).getTime();
const sessions=[
 {id:'p1',status:'pending',startedAt:at(14,3),stoppedAt:at(14,3),segments:[],category:null,description:null},
 {id:'p2',status:'pending',startedAt:at(11,23),stoppedAt:at(11,23),segments:[],category:null,description:null},
 {id:'c1',status:'completed',startedAt:at(12,36),stoppedAt:at(12,36),segments:[],category:'Entwicklung',description:'Backend-Integration geprüft'},
 {id:'c2',status:'completed',startedAt:at(9,0),stoppedAt:at(11,15),segments:[{start:at(9,0),end:at(11,15)}],category:'Konzeption',description:'Neue Ansicht strukturiert'},
];
const state={sessions};
const workingMilliseconds=s=>s.segments.reduce((a,sg)=>a+(sg.end-sg.start),0);
const formatDuration=ms=>`${Math.round(ms/60000)} min`;
const formatTime=t=>new Intl.DateTimeFormat('de-DE',{hour:'2-digit',minute:'2-digit'}).format(t);
const formatClock=ms=>'00:00:00';
const dateKey=t=>{const d=new Date(t);return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-')};
const formatDayLabel=k=>k===dateKey(now)?'Heute':k;
const expandedDays=new Set(),collapsedDays=new Set(),expandedWeeks=new Set(),collapsedWeeks=new Set(),expandedMonths=new Set();
const thisMonday=new Date(midnight);thisMonday.setDate(thisMonday.getDate()-(thisMonday.getDay()+6)%7);
const currentWeekKey=dateKey(thisMonday.getTime());
function groupSessionsByDay(list) {
 window.__historySessions=list.map(s=>s.id);
 const entries=list.map(s=>({session:s,dayMs:workingMilliseconds(s)}));
 return entries.length ? [{key:dateKey(now),durationMs:entries.reduce((a,e)=>a+e.dayMs,0),entries}] : [];
}
function buildHistorySections(days){return {currentWeekKey,lastWeekKey:'-',recentWeeks:days.length?[{key:currentWeekKey,start:thisMonday.getTime(),end:new Date(thisMonday.getFullYear(),thisMonday.getMonth(),thisMonday.getDate()+7).getTime(),endKey:dateKey(now),durationMs:days[0].durationMs,days}]:[],currentMonthWeeks:[],archivedMonths:[]}}
const localWeekBounds=()=>({startKey:currentWeekKey});
'''
html=f'''<!DOCTYPE html><html data-theme="dark"><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>{css}</style></head><body>
<div id="app"></div><script>{js}{renderer}
function renderPage(){{document.querySelector('#app').innerHTML=`<div class="page-wrap"><header class="site-header"><div class="identity"><span class="brand-mark">${{icon('clock',28)}}</span><div class="brand">zeitspur<span class="brand-dot">.</span></div></div><button class="icon-button settings-button" type="button" aria-label="Einstellungen öffnen">${{icon('settings',20)}}</button></header><main>${{renderTimer(undefined)}}${{renderPending()}}${{renderHistory()}}</main></div>`;}}
renderPage();
document.addEventListener('click',e=>{{const b=e.target.closest('button[data-action]');if(b && b.dataset.action==='toggle-week'){{const k=b.dataset.week,expanded=b.getAttribute('aria-expanded')==='true';expandedWeeks.delete(k);collapsedWeeks.delete(k);(expanded?collapsedWeeks:expandedWeeks).add(k);renderPage();}}if(b&&b.dataset.action==='toggle-day'){{const k=b.dataset.day,expanded=b.getAttribute('aria-expanded')==='true';expandedDays.delete(k);collapsedDays.delete(k);(expanded?collapsedDays:expandedDays).add(k);renderPage();}}}});
</script></body></html>'''
shots=root/'tests'/'screenshots';shots.mkdir(exist_ok=True)
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage'])
    for w,h in [(1100,850),(390,844),(320,640)]:
        page=browser.new_page(viewport={'width':w,'height':h},device_scale_factor=1)
        errors=[];page.on('pageerror',lambda e: errors.append(str(e)))
        page.set_content(html)
        assert not errors,errors
        assert page.locator('.pending-item').count()==2
        assert page.locator('.history-row').count()==2
        assert page.evaluate('window.__historySessions')==['c1','c2']
        assert page.get_by_text('Diese Woche').is_visible()
        assert '2026-' not in page.locator('.week-title small').inner_text()[:5]
        assert page.get_by_role('button',name='Eintrag bearbeiten').count()==2
        assert page.locator('.action-menu').count()==0, 'No one-item menus should remain'
        assert page.locator('.pending-item .delete-action').count()==2
        assert page.locator('.history-row .delete-action').count()==2
        assert page.locator('.day-bar .delete-action').count()==1
        assert page.locator('.week-bar .delete-action').count()==1
        assert page.get_by_role('button',name='Eintrag löschen').count()==4
        assert page.get_by_role('button',name='Tag löschen').count()==1
        assert page.get_by_role('button',name='Woche löschen').count()==1
        for parent in page.locator('.pending-item').all():
            row_box=parent.bounding_box()
            delete_box=parent.locator('.delete-action').bounding_box()
            assert row_box and delete_box
            assert row_box['x'] <= delete_box['x']
            assert row_box['y'] <= delete_box['y']
            assert delete_box['x']+delete_box['width'] <= row_box['x']+row_box['width']+1
            assert delete_box['y']+delete_box['height'] <= row_box['y']+row_box['height']+1
            assert parent.locator('.delete-action').is_visible()
        page.screenshot(path=str(shots/f'zeitspur-025-{w}.png'),full_page=True)
        assert page.evaluate('document.documentElement.scrollWidth <= innerWidth+1'),f'Horizontal overflow at {w}px'
        page.locator('.week-heading').first.click()
        assert page.locator('.week-heading').first.get_attribute('aria-expanded')=='false'
        page.locator('.week-heading').first.click()
        assert page.locator('.week-heading').first.get_attribute('aria-expanded')=='true'
        assert not errors,errors
        print(f'PASS: {w}x{h}, pending vs history isolation, direct actions and geometry, toggles, no overflow')
        page.close()
    browser.close()
