# ถ่ายภาพหน้าจอ lessons/ระยะร่น.html ด้วย Chromium headless แบบตัดเน็ต (file://)
# ใช้ ?debug เพื่อเปิด window.__cu (ในไฟล์จริงไม่มีถ้าไม่ใส่ ?debug)
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
    b.close()
print('\n'.join(logs) or 'no console errors/warnings')
