# ถ่ายภาพหน้าจอบทที่ 2 (อาคารขนาดใหญ่ · อาคารสูง) ด้วย Edge headless แบบตัดเน็ต (file://) + ตรวจ console
# ใช้: python scripts/shots-l2.py <โฟลเดอร์ผลลัพธ์>
import sys, pathlib
from playwright.sync_api import sync_playwright
ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = pathlib.Path(sys.argv[1]); OUT.mkdir(parents=True, exist_ok=True)
L2 = (ROOT / 'lessons' / '02-อาคารขนาดใหญ่-อาคารสูง.html').as_uri() + '?debug'
logs = []
with sync_playwright() as p:
    b = p.chromium.launch(channel='msedge', args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
    def page(w, h, scheme='light', mobile=False, url=L2):
        ctx = b.new_context(viewport={'width': w, 'height': h}, offline=True, color_scheme=scheme, device_scale_factor=1, is_mobile=mobile, has_touch=mobile)
        pg = ctx.new_page()
        pg.on('console', lambda m: logs.append(f'[{w}x{h}] {m.type}: {m.text}') if m.type in ('error', 'warning') else None)
        pg.on('pageerror', lambda e: logs.append(f'[{w}x{h}] pageerror: {e}'))
        pg.on('requestfailed', lambda r: logs.append(f'[{w}x{h}] requestfailed: {r.url[:80]}'))
        pg.goto(url); pg.wait_for_timeout(3000)
        return pg
    def setv(pg, **kw):
        pg.evaluate('(kw)=>{Object.assign(window.__cu2.state,kw);window.__cu2.refresh()}', kw); pg.wait_for_timeout(900)
    def go(pg, i):
        pg.evaluate('(i)=>window.__cu2.goStep(i)', i); pg.wait_for_timeout(1000)
    def side(pg): pg.click('#vside'); pg.wait_for_timeout(700)
    def d3(pg): pg.click('#v3d'); pg.wait_for_timeout(700)
    def shot(pg, name, full=False):
        pg.screenshot(path=str(OUT / name), full_page=full); print('saved', name)
    def txt(pg, sel): return pg.inner_text(sel).replace('\n', ' | ')

    pg = page(1280, 800)
    shot(pg, '01-step1-slide12.png'); shot(pg, '01b-step1-full.png', full=True)
    print('step1 rules:', txt(pg, '#rules'))
    side(pg); shot(pg, '01c-step1-side.png')
    d3(pg)
    setv(pg, deck=150, countDeck=True); print('deck150 counted:', txt(pg, '#meter-area .mhead'), '|', txt(pg, '#rules li >> nth=0')); shot(pg, '02a-step1-deck150-counted-notover.png')
    setv(pg, deck=155); print('deck155 counted:', txt(pg, '#meter-area .mhead'), '|', txt(pg, '#rules li >> nth=0')); shot(pg, '02b-step1-deck155-counted-over.png')
    setv(pg, countDeck=False); print('deck155 not counted:', txt(pg, '#meter-area .mhead'), '|', txt(pg, '#rules li >> nth=0')); shot(pg, '02c-step1-deck155-notcounted.png')
    go(pg, 1)
    print('step2 initial:', txt(pg, '#rules li >> nth=0')); shot(pg, '03a-step2-14.5m.png'); side(pg); shot(pg, '03a2-step2-side.png'); d3(pg)
    setv(pg, floorH=2.99); print('h14.95:', txt(pg, '#rules li >> nth=0')); shot(pg, '03b-step2-14.95m-notyet.png')
    setv(pg, floorH=3.0); print('h15.00:', txt(pg, '#rules li >> nth=0')); shot(pg, '03c-step2-15.00m-yes.png'); side(pg); shot(pg, '03d-step2-15.00m-side.png'); d3(pg)
    setv(pg, floorH=3.0, bw=13.3); print('area 997.5, h15:', txt(pg, '#rules li >> nth=0')); shot(pg, '03e-step2-area-below1000.png')
    go(pg, 2); shot(pg, '04a-step3-gable.png'); side(pg); shot(pg, '04a2-step3-gable-side.png'); d3(pg)
    setv(pg, ridge=9); print('ridge9:', txt(pg, '#rules')); shot(pg, '04b-step3-ridge9.png')
    setv(pg, roofType='flat'); shot(pg, '04c-step3-flat.png')
    go(pg, 3); print('step4 initial:', txt(pg, '#rules li >> nth=0')); shot(pg, '05a-step4-22.95.png'); side(pg); shot(pg, '05a2-step4-22.95-side.png'); d3(pg)
    setv(pg, floorH=23/8); print('h23.00:', txt(pg, '#rules li >> nth=0')); shot(pg, '05b-step4-23.00-yes.png'); side(pg); shot(pg, '05b2-step4-23.00-side.png'); d3(pg)
    go(pg, 4); shot(pg, '06a-step5.png'); shot(pg, '06b-step5-full.png', full=True)
    setv(pg, floors=30, floorH=3.5, bw=40, bd=30); shot(pg, '06c-step5-30floors.png'); side(pg); shot(pg, '06d-step5-30floors-side.png')
    pg.evaluate('document.querySelector("#rules .lawbtn").click()'); pg.wait_for_timeout(500); shot(pg, '07-lawbox.png'); pg.keyboard.press('Escape')
    pg.evaluate('document.querySelector("#others").scrollIntoView()'); pg.wait_for_timeout(300); shot(pg, '07b-review-points.png')
    pg.close()
    pg = page(390, 844, mobile=True)
    shot(pg, '08-mobile-step1.png'); shot(pg, '08b-mobile-step1-full.png', full=True)
    print('mobile horizontal overflow:', pg.evaluate('document.documentElement.scrollWidth > document.documentElement.clientWidth'))
    go(pg, 3); side(pg); shot(pg, '08c-mobile-step4-side.png')
    pg.close()
    pg = page(1280, 800, scheme='dark'); shot(pg, '09-dark-step1.png'); go(pg, 3); shot(pg, '09b-dark-step4.png'); pg.close()
    # ไม่มี __cu2 เมื่อไม่ใส่ ?debug
    ctx = b.new_context(viewport={'width': 800, 'height': 600}, offline=True)
    pg = ctx.new_page(); pg.goto((ROOT / 'lessons' / '02-อาคารขนาดใหญ่-อาคารสูง.html').as_uri()); pg.wait_for_timeout(1500)
    print('__cu2 without ?debug:', pg.evaluate('typeof window.__cu2')); pg.close()
    # สารบัญ + บทอื่นยังเปิดได้
    IDX = (ROOT / 'lessons' / 'index.html').as_uri()
    pg = page(1280, 800, url=IDX); shot(pg, '10-index.png', full=True)
    hrefs = pg.evaluate('[...document.querySelectorAll("li.done a")].map(a=>a.getAttribute("href"))'); print('index links:', hrefs)
    pg.close()
    pg = page(1280, 800, url=(ROOT / 'lessons' / 'ระยะร่น.html').as_uri() + '?debug'); shot(pg, '11-setback-lesson.png')
    pg.evaluate('window.__cu.goStep(4)'); pg.wait_for_timeout(600); shot(pg, '11b-setback-step5.png')
    pg.click('#vtop'); pg.wait_for_timeout(600); shot(pg, '11c-setback-top.png'); pg.close()
    pg = page(1280, 800, url=(ROOT / 'lessons' / '01-วัตถุประสงค์.html').as_uri()); shot(pg, '12-lesson01.png'); pg.close()
    pg = page(1280, 800, url=L2); pg.click('#toc'); pg.wait_for_timeout(800); print('toc ->', pg.url.split('/')[-1]); pg.close()
    b.close()
print('\n'.join(logs) or 'no console errors/warnings')
