"""Browser layout regression on compiled history renderers, without network access."""
from pathlib import Path
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parents[1]
compiled=(root/'dist/assets/main.js').read_text()
renderer=compiled[compiled.index('function displayListDuration('):compiled.index('function renderTimer(')]
css=(root/'src/styles.css').read_text()
helpers='''
const expandedDays=new Set(), collapsedDays=new Set(), expandedWeeks=new Set(),
      collapsedWeeks=new Set(), expandedMonths=new Set();
const icon=(name,size)=>`<svg aria-hidden="true" width="${size}" height="${size}" viewBox="0 0 24 24"><path d="M6 9l6 6 6-6" fill="none" stroke="currentColor"/></svg>`;
const escapeHtml=s=>s;const formatDuration=v=>`${Math.round(v/60000)} min`;
const formatTime=v=>'10:00';const formatDayLabel=k=>k;
const dateKey=v=>new Date(v).toISOString().slice(0,10);const intlLocale=()=> 'de-DE';
const mkWeek=(k,year,month,day)=>({key:k,start:new Date(year,month-1,day).getTime(),end:new Date(year,month-1,day+7).getTime(),endKey:k,
 durationMs:3600000,days:[{key:k,durationMs:3600000,entries:[]} ]});
const current=mkWeek('2026-10-26',2026,10,26), previous=mkWeek('2026-10-19',2026,10,19),
  archived=mkWeek('2026-09-07',2026,9,7);
const groups={currentWeekKey:current.key,lastWeekKey:previous.key,recentWeeks:[current,previous],
 currentMonthWeeks:[],archivedMonths:[{key:'2026-09',weeks:[archived],durationMs:3600000}]};
const state={sessions:[]};const groupSessionsByDay=()=>[1];const buildHistorySections=()=>groups;
function repaint(){document.querySelector('#history').innerHTML=renderHistory();}
document.addEventListener('click',e=>{
  const b=e.target.closest('button[data-action]');if(!b)return;
  if(b.dataset.action==='toggle-week'){
    const k=b.dataset.week;const opened=expandedWeeks.has(k)||(k===groups.currentWeekKey&&!collapsedWeeks.has(k));
    if(opened){expandedWeeks.delete(k);collapsedWeeks.add(k)}else{collapsedWeeks.delete(k);expandedWeeks.add(k)}
    repaint();
  }else if(b.dataset.action==='toggle-month'){
    const k=b.dataset.month;if(expandedMonths.has(k))expandedMonths.delete(k);else expandedMonths.add(k);repaint();
  }
});
'''
html=f'''<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>{css}</style></head>
<body><div style="margin:auto;max-width:720px;padding:20px"><div id="history"></div></div>
<script>{helpers}{renderer}repaint();</script></body></html>'''
with sync_playwright() as p:
  browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage'])
  for w,h in [(1100,800),(390,844),(320,470)]:
    page=browser.new_page(viewport={'width':w,'height':h})
    errors=[]
    page.on('pageerror',lambda e: errors.append(str(e)))
    page.set_content(html)
    assert page.locator('.week-heading').count()==3,errors
    assert page.locator('.week-heading').first.get_attribute('aria-expanded')=='true'
    assert page.locator('.week-heading').nth(1).get_attribute('aria-expanded')=='false'
    assert page.locator('.month-heading').first.get_attribute('aria-expanded')=='false'
    page.locator('.week-heading').first.click()
    assert page.locator('.week-heading').first.get_attribute('aria-expanded')=='false'
    page.locator('.week-heading').first.click()
    assert page.locator('.week-heading').first.get_attribute('aria-expanded')=='true'
    page.locator('.month-heading').first.click()
    assert page.locator('.month-heading').first.get_attribute('aria-expanded')=='true'
    archived_week=page.locator('.month-content .week-heading').first
    archived_week.click()
    assert archived_week.get_attribute('aria-expanded')=='true'
    assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1'), f'horizontal overflow at {w}px'
    assert not errors, errors
    print(f'PASS: {w}x{h} compiled history UI, accessible toggles and no horizontal overflow')
    page.close()
  browser.close()
