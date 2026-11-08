# สร้างรูปประกอบบทที่ 1 (8 รูป: ภาพรวม + 7 วัตถุประสงค์) จากฉาก 3 มิติ → assets/lessons/01/*.webp
# ใช้: python scripts/make-l1-figures.py [โฟลเดอร์ PNG ต้นฉบับ (ไม่บังคับ)]   · รันซ้ำได้ ผลเหมือนเดิม
# ทำงาน: เปิด vite dev (พอร์ต 5199) → Edge headless เปิด figure-scene.html → ถ่ายเฉพาะ canvas → บีบเป็น WebP < 150 KB
import sys, subprocess, time, pathlib, urllib.request, io, os
from playwright.sync_api import sync_playwright
from PIL import Image
ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / 'assets' / 'lessons' / '01'; OUT.mkdir(parents=True, exist_ok=True)
RAW = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else None
if RAW: RAW.mkdir(parents=True, exist_ok=True)
PORT = 5199; LIMIT = 150 * 1024
NAMES = {'overview': 'overview', **{str(n): f'obj{n}' for n in range(1, 8)}}

srv = subprocess.Popen([ 'node', str(ROOT / 'node_modules' / 'vite' / 'bin' / 'vite.js'), '--port', str(PORT), '--strictPort', '--host', '127.0.0.1'], cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
try:
    for _ in range(60):
        try: urllib.request.urlopen(f'http://127.0.0.1:{PORT}/figure-scene.html', timeout=1); break
        except Exception: time.sleep(0.5)
    logs = []
    with sync_playwright() as p:
        b = p.chromium.launch(channel='msedge', args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
        ctx = b.new_context(viewport={'width': 1200, 'height': 675}, color_scheme='light', device_scale_factor=1)
        pg = ctx.new_page()
        pg.on('console', lambda m: logs.append(f'{m.type}: {m.text}') if m.type in ('error', 'warning') else None)
        pg.on('pageerror', lambda e: logs.append(f'pageerror: {e}'))
        pg.goto(f'http://127.0.0.1:{PORT}/figure-scene.html'); pg.wait_for_function('window.__figReady === true', timeout=60000)
        pg.wait_for_timeout(500); pg.evaluate("window.__fig.show('1')"); pg.wait_for_timeout(6000)  # รอโมเดล polyfork โหลดครบก่อนถ่ายจริง
        for key, name in NAMES.items():
            pg.evaluate('(k)=>window.__fig.show(k)', key); pg.wait_for_timeout(1200)
            png = pg.locator('#view canvas').screenshot()
            if RAW: (RAW / f'{name}.png').write_bytes(png)
            im = Image.open(io.BytesIO(png)).convert('RGB')
            q = 82
            while True:
                buf = io.BytesIO(); im.save(buf, 'WEBP', quality=q, method=6)
                if buf.tell() <= LIMIT or q <= 40: break
                q -= 6
            (OUT / f'{name}.webp').write_bytes(buf.getvalue())
            print(f'{name}.webp  {im.size[0]}x{im.size[1]}  {buf.tell()/1024:.0f} KB  q={q}')
        b.close()
    print('\n'.join(logs) or 'no console errors/warnings')
finally:
    srv.terminate()
