// สร้าง lessons/index.html (สารบัญบท) จาก src/content/catalog.js — ลิงก์แบบ relative ใช้ได้กับ file://
import { writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export async function makeIndex(root) {
  const { CATALOG } = await import(pathToFileURL(resolve(root, 'src/content/catalog.js')).href);
  const item = (title, slides, file, sub) => {
    const done = file && existsSync(resolve(root, 'lessons', file));
    const inner = `<span class="no">สไลด์ ${esc(slides)}</span><span class="tt">${esc(title)}</span>${sub ? `<span class="sub">${esc(sub)}</span>` : ''}<span class="st">${done ? 'เปิดบท' : 'ยังไม่ทำ'}</span>`;
    return done ? `<li class="done"><a href="${encodeURI(file)}">${inner}</a></li>` : `<li class="todo" aria-disabled="true"><div>${inner}</div></li>`;
  };
  const rows = CATALOG.map((c) => {
    const extra = (c.extra || []).map((e) => item(e.title, e.slides, e.file, 'บทตัวอย่าง (รูปแบบอ้างอิงของบทอื่น)')).join('');
    return `<li class="catwrap"><p class="cat">หมวด ${c.cat}</p><ul>${item(c.title, c.slides, c.file, c.note && !c.extra ? c.note : '')}${extra}</ul></li>`;
  }).join('\n');
  const html = `<!doctype html>
<html lang="th"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>สารบัญบท — การควบคุมอาคารของกรุงเทพมหานคร</title>
<style>
:root{--bg:#f4f5f7;--fg:#1b1f27;--muted:#5a6270;--card:#fff;--line:#d7dbe2;--accent:#e8650a}
@media (prefers-color-scheme:dark){:root{--bg:#11151b;--fg:#e8ebf0;--muted:#9aa3b2;--card:#1a2029;--line:#2e3643;--accent:#ff8a3d}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--fg);font-family:"Noto Sans Thai","Leelawadee UI","Sarabun",Tahoma,system-ui,sans-serif;line-height:1.55}
main{max-width:820px;margin:0 auto;padding:16px}h1{font-size:1.4rem;margin:8px 0 2px}.lead{color:var(--muted);margin:0 0 14px;font-size:.92rem}
ul{list-style:none;margin:0;padding:0}.catwrap{margin:0 0 12px}.cat{margin:0 0 4px;font-weight:700;font-size:.85rem;color:var(--muted)}
li.done a,li.todo div{display:grid;grid-template-columns:auto 1fr auto;gap:2px 12px;align-items:center;border:1px solid var(--line);border-radius:12px;padding:10px 14px;background:var(--card);color:inherit;text-decoration:none;margin-bottom:6px}
li.done a{border-left:6px solid var(--accent)}li.done a:hover,li.done a:focus-visible{border-color:var(--accent);outline:2px solid var(--accent)}
li.todo div{opacity:.5;filter:grayscale(1);border-style:dashed}
.no{font-size:.8rem;color:var(--muted);white-space:nowrap}.tt{font-weight:600}.sub{grid-column:2;font-size:.82rem;color:var(--muted)}.st{font-size:.8rem;font-weight:700;color:var(--accent);grid-row:1;grid-column:3}li.todo .st{color:var(--muted)}
@media(max-width:520px){li.done a,li.todo div{grid-template-columns:1fr auto}.no{grid-column:1}.tt{grid-column:1/-1;grid-row:2}.sub{grid-column:1/-1}.st{grid-row:1;grid-column:2}}
</style></head><body><main>
<h1>การควบคุมอาคารของกรุงเทพมหานคร</h1>
<p class="lead">สื่อสอนจากสไลด์บรรยาย 14 ต.ค. 2568 (159 สไลด์) · แบ่งเป็น 13 หมวด · บทที่ทำแล้วกดเปิดได้ บทที่ยังไม่ทำแสดงเป็นสีเทา · ทุกบทเปิดได้โดยไม่ต้องต่ออินเทอร์เน็ต</p>
<ul>
${rows}
</ul></main></body></html>`;
  const out = resolve(root, 'lessons', 'index.html');
  writeFileSync(out, html, 'utf8');
  console.log('lessons/index.html');
}
