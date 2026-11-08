# ถ่ายภาพหน้าจอทุกบทใน lessons/ ด้วย Edge headless แบบตัดเน็ต (file://)
# ใช้ ?debug เพื่อเปิด window.__cu (บทระยะร่น) / window.__l1 (บทที่ 1) — ในไฟล์จริงไม่มีถ้าไม่ใส่ ?debug
# ใช้: python scripts/shots.py [โฟลเดอร์ผลลัพธ์]   (ภาพบทที่ 1 อยู่ในโฟลเดอร์ย่อย l1/)
import sys, pathlib
from playwright.sync_api import sync_playwright
ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else ROOT / 'shots'); OUT.mkdir(parents=True, exist_ok=True)
URL = (ROOT / 'lessons' / 'ระยะร่น.html').as_uri() + '?debug'
logs = []
with sync_playwright() as p:
    b = p.chromium.launch(channel='msedge', args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
    def page(w, h, scheme='light', mobile=False):
        ctx = b.new_context(viewport={'width': w, 'height': h}, offline=True, color_scheme=scheme, device_scale_factor=1, is_mobile=mobile, has_touch=mobile)
        pg = ctx.new_page()
        pg.on('console', lambda m: logs.append(f'[{w}x{h}] {m.type}: {m.text}') if m.type in ('error', 'warning') else None)
        pg.on('pageerror', lambda e: logs.append(f'[{w}x{h}] pageerror: {e}'))
        pg.on('requestfailed', lambda r: logs.append(f'[{w}x{h}] requestfailed: {r.url[:80]}'))
        pg.goto(URL); pg.wait_for_timeout(2500)
        return pg
    def setv(pg, **kw):
        pg.evaluate('(kw)=>{Object.assign(window.__cu.state,kw);window.__cu.refresh()}', kw); pg.wait_for_timeout(400)
    def go(pg, i):
        pg.evaluate('(i)=>window.__cu.goStep(i)', i); pg.wait_for_timeout(500)
    def top(pg):
        pg.click('#vtop'); pg.wait_for_timeout(500)
    def shot(pg, name, full=False):
        pg.screenshot(path=str(OUT / name), full_page=full); print('saved', name)

    pg = page(1280, 800)
    shot(pg, '01-step1.png'); shot(pg, '01b-step1-full.png', full=True)
    go(pg, 1); top(pg)
    shot(pg, '02a-step2-canal9.5-top.png', full=True)
    setv(pg, canal=10); shot(pg, '02b-step2-canal10-top.png', full=True)
    pg.click('#v3d'); pg.wait_for_timeout(500); shot(pg, '02c-step2-canal10-3d.png')
    go(pg, 2); top(pg)
    shot(pg, '03a-step3-h8.5-top.png', full=True)
    setv(pg, height=9); shot(pg, '03b-step3-h9-top.png')
    setv(pg, height=9.5); shot(pg, '03c-step3-h9.5-top.png', full=True)
    go(pg, 3); shot(pg, '04-step4-top.png', full=True)
    go(pg, 4); shot(pg, '05a-step5-top.png', full=True)
    setv(pg, canal=12, height=9.5, bx=2.5, bw=11); shot(pg, '05b-step5-fail-top.png')
    pg.click('#v3d'); pg.wait_for_timeout(500); shot(pg, '05c-step5-3d.png')
    pg.evaluate('document.querySelector("#others").scrollIntoView()'); pg.wait_for_timeout(300); shot(pg, '05d-other-rules.png')
    pg.evaluate('window.scrollTo(0,0)')
    pg.click('#rules .lawbtn >> nth=0'); pg.wait_for_timeout(400); shot(pg, '06-lawbox.png')
    pg.close()
    pg = page(390, 844, mobile=True)
    go(pg, 1); top(pg); setv(pg, canal=10)
    shot(pg, '07-mobile-step2.png'); shot(pg, '07b-mobile-step2-full.png', full=True)
    pg.close()
    pg = page(1280, 800, scheme='dark'); go(pg, 4); shot(pg, '08-dark-step5.png'); pg.close()
    # ตรวจว่าไม่มี __cu เมื่อไม่ใส่ ?debug
    ctx = b.new_context(viewport={'width': 800, 'height': 600}, offline=True)
    pg = ctx.new_page(); pg.goto((ROOT / 'lessons' / 'ระยะร่น.html').as_uri()); pg.wait_for_timeout(1500)
    print('__cu without ?debug:', pg.evaluate('typeof window.__cu'))
    # ---------- บทที่ 1 ----------
    L1 = (ROOT / 'lessons' / '01-วัตถุประสงค์.html').as_uri() + '?debug'
    O1 = OUT / 'l1'; O1.mkdir(parents=True, exist_ok=True)
    def page1(w, h, scheme='light', mobile=False, url=L1):
        ctx = b.new_context(viewport={'width': w, 'height': h}, offline=True, color_scheme=scheme, device_scale_factor=1, is_mobile=mobile, has_touch=mobile)
        pg = ctx.new_page()
        pg.on('console', lambda m: logs.append(f'[L1 {w}x{h}] {m.type}: {m.text}') if m.type in ('error', 'warning') else None)
        pg.on('pageerror', lambda e: logs.append(f'[L1 {w}x{h}] pageerror: {e}'))
        pg.on('requestfailed', lambda r: logs.append(f'[L1 {w}x{h}] requestfailed: {r.url[:80]}'))
        pg.goto(url); pg.wait_for_timeout(2500)
        return pg
    def s1(pg, name, full=False):
        pg.wait_for_timeout(1100); pg.screenshot(path=str(O1 / name), full_page=full); print('saved l1/' + name)
    def js(pg, code, *a):
        return pg.evaluate(code, *a)
    pg = page1(1280, 800)
    s1(pg, '01a-step1-nolayer.png')
    for lid, nm in [('zoning', '01b-step1-zoning'), ('eia', '01c-step1-eia'), ('control', '01d-step1-control')]:
        pg.click(f'[data-l="{lid}"]'); pg.wait_for_timeout(900)
        s1(pg, nm + '.png')
        pg.click(f'[data-l="{lid}"]')
    for lid in ('zoning', 'eia', 'control'): pg.click(f'[data-l="{lid}"]')
    pg.wait_for_timeout(900)
    s1(pg, '01e-step1-all3-full.png', full=True)
    js(pg, '()=>window.__l1.goStep(1)'); s1(pg, '02a-step2-start.png')
    for n in (1, 3, 4, 7, 5):
        js(pg, '(n)=>window.__l1.selectObjective(n)', n); s1(pg, f'02-step2-obj{n}.png')
    s1(pg, '02z-step2-full.png', full=True)
    js(pg, '()=>window.__l1.goStep(2)'); s1(pg, '03a-step3-start.png')
    js(pg, '()=>window.__l1.pickPart("stair")'); s1(pg, '03b-step3-stair-picked.png')
    pg.click('[data-a="3"]'); s1(pg, '03c-step3-correct.png')
    pg.click('[data-a="2"]'); s1(pg, '03d-step3-wrong-2.png')
    js(pg, '()=>window.__l1.pickPart("parking")'); pg.click('[data-a="5"]'); s1(pg, '03e-step3-wrong-5.png')
    pg.click('#vtop'); s1(pg, '03f-step3-top.png')
    pg.click('#v3d'); pg.wait_for_timeout(500)
    js(pg, '()=>window.__l1.goStep(2)'); pg.wait_for_timeout(1200)
    box = pg.locator('#view canvas').bounding_box()
    pg.mouse.click(box['x'] + box['width'] * 0.5, box['y'] + box['height'] * 0.5); pg.wait_for_timeout(600)
    print('click-center picked part =', js(pg, '()=>window.__l1.st.quizPart'))
    pg.evaluate('document.querySelector("#lawsrc").scrollIntoView()'); s1(pg, '04-lawsrc.png')
    pg.click('#lawbtn'); s1(pg, '04b-lawbox-art8.png'); pg.keyboard.press('Escape')
    pg.evaluate('document.querySelector("#review").scrollIntoView()'); s1(pg, '04c-review.png')
    pg.close()
    pg = page1(390, 844, mobile=True)
    s1(pg, '05a-mobile-step1.png'); s1(pg, '05a2-mobile-step1-full.png', full=True)
    js(pg, '()=>window.__l1.goStep(1)'); js(pg, '()=>window.__l1.selectObjective(3)'); s1(pg, '05b-mobile-step2-obj3.png'); s1(pg, '05b2-mobile-step2-full.png', full=True)
    js(pg, '()=>window.__l1.goStep(2)'); js(pg, '()=>window.__l1.pickPart("window")'); pg.click('[data-a="4"]'); s1(pg, '05c-mobile-step3.png'); s1(pg, '05c2-mobile-step3-full.png', full=True)
    pg.close()
    pg = page1(1280, 800, scheme='dark'); js(pg, '()=>window.__l1.goStep(1)'); js(pg, '()=>window.__l1.selectObjective(1)'); s1(pg, '06-dark-step2-obj1-xray.png'); pg.close()
    IDX = (ROOT / 'lessons' / 'index.html').as_uri()
    pg = page1(1280, 800, url=IDX); pg.screenshot(path=str(O1 / '07-index.png'), full_page=True); print('saved l1/07-index.png')
    pg.click('li.done a >> nth=0'); pg.wait_for_timeout(2000); print('index -> lesson link opened:', pg.url.split('/')[-1])
    pg.close()
    pg = page1(390, 844, mobile=True, url=IDX); pg.screenshot(path=str(O1 / '07b-index-mobile.png'), full_page=True); pg.close()
    pg = page1(1280, 800); js(pg, '()=>window.__l1.goStep(1)'); js(pg, '()=>window.__l1.selectObjective(1)')
    pg.click('#detail a'); pg.wait_for_timeout(2000); print('lesson01 -> setback link opened:', pg.title()); pg.close()
    ctx = b.new_context(viewport={'width': 800, 'height': 600}, offline=True)
    pg = ctx.new_page(); pg.goto((ROOT / 'lessons' / '01-วัตถุประสงค์.html').as_uri()); pg.wait_for_timeout(1500)
    print('__l1 without ?debug:', pg.evaluate('typeof window.__l1'))
    b.close()
print('\n'.join(logs) or 'no console errors/warnings')
