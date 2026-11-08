// เทสต์ข้อมูลบทที่ 1 "วัตถุประสงค์ของกฎหมายควบคุมอาคาร" — ตรวจว่าทุกข้อความมีที่มาจริง
//  - ทุกวัตถุประสงค์/ตัวอย่างมีเลขสไลด์ · quote ต้องอยู่ในข้อความสไลด์ข้อนั้นจริง
//  - ข้อความตัวบทไม่มีคำเพี้ยน และตรงกับ laws.json เมื่อตัดสระ/วรรณยุกต์/ช่องว่างออกทั้งสองฝั่ง
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { OBJECTIVES, LAW_ACT_8, LAW_ACT_77_FRAGMENT, REVIEW_POINTS, ACT8_EXTRA, NO_EXAMPLE } from '../../src/content/objectives.js';
import { LAYERS, PARTS, SCENE_ONLY } from '../../src/content/lesson01.js';
import { CATALOG } from '../../src/content/catalog.js';
import { OVERVIEW_FIGURE, OBJECTIVE_FIGURES, GENERIC_NOTE } from '../../src/content/lesson01-figures.js';

const SLIDES_MD = new URL('../../ข้อความสไลด์-คำต่อคำ.md', import.meta.url);
const TOC_MD = new URL('../../สารบัญเนื้อหา.md', import.meta.url);
const LAWS_JSON = 'D:/ai/building-law-chatbot/output/laws.json';

// ทำให้เทียบได้: นํา → นำ แล้วตัดสระบน/ล่าง วรรณยุกต์ (U+0E31, U+0E34–U+0E3A, U+0E47–U+0E4E) และช่องว่าง/ตัวขึ้นบรรทัด
const norm = (s) => s.replace(/\u0E4D\u0E32/g, '\u0E33').replace(/[\u0E31\u0E34-\u0E3A\u0E47-\u0E4E\s]/g, '');

const slideText = new Map();
{
  const md = readFileSync(SLIDES_MD, 'utf8');
  const parts = md.split(/^## สไลด์ (\d+)\s*$/m);
  for (let i = 1; i < parts.length; i += 2) slideText.set(+parts[i], norm(parts[i + 1]));
}
const inSlides = (quote, slides) => slides.some((n) => slideText.get(n)?.includes(norm(quote)));

test('อ่านข้อความสไลด์ได้ครบ 159 สไลด์', () => assert.equal(slideText.size, 159));

test('มี 7 วัตถุประสงค์ เลขข้อ 1–7 เรียงกัน และชื่อตรงกับข้อความสไลด์ 2', () => {
  assert.deepEqual(OBJECTIVES.map((o) => o.n), [1, 2, 3, 4, 5, 6, 7]);
  for (const o of OBJECTIVES) assert.ok(slideText.get(2).includes(norm(`${o.n}.${o.name}`)), `สไลด์ 2 ไม่มี "${o.n}.${o.name}"`);
});

test('ทุกวัตถุประสงค์มีสี ไอคอน คำอธิบาย และสีไม่ซ้ำกัน', () => {
  for (const o of OBJECTIVES) { assert.match(o.color, /^#[0-9a-f]{6}$/i); assert.ok(o.icon.startsWith('<svg')); assert.ok(o.plain.length > 10); }
  assert.equal(new Set(OBJECTIVES.map((o) => o.color)).size, 7);
});

test('ทุกวัตถุประสงค์มีเลขสไลด์ (ข้อความอ้างสไลด์ 2) และมีตัวอย่าง หรือระบุว่ายังไม่มีตัวอย่าง', () => {
  for (const o of OBJECTIVES) {
    assert.ok(slideText.has(2));
    if (o.examples.length === 0) assert.equal(NO_EXAMPLE, 'ยังไม่มีตัวอย่างในสไลด์ชุดนี้', `ข้อ ${o.n}`);
  }
  assert.deepEqual(OBJECTIVES.filter((o) => !o.examples.length).map((o) => o.n), [5, 6]);
});

test('ทุกตัวอย่างมีเลขสไลด์ (1–159) และ quote อยู่ในสไลด์นั้นจริง', () => {
  const all = [...OBJECTIVES.flatMap((o) => o.examples.map((e) => ({ id: `ข้อ ${o.n}`, e }))), ...LAYERS.flatMap((l) => l.facts.map((e) => ({ id: `ชั้น ${l.id}`, e })))];
  assert.ok(all.length >= 15);
  for (const { id, e } of all) {
    assert.ok(Array.isArray(e.slides) && e.slides.length > 0, `${id}: ไม่มีเลขสไลด์ — ${e.text.slice(0, 30)}`);
    for (const n of e.slides) assert.ok(Number.isInteger(n) && n >= 1 && n <= 159, `${id}: เลขสไลด์ ${n}`);
    assert.ok(e.quote, `${id}: ไม่มี quote`);
    assert.ok(inSlides(e.quote, e.slides), `${id}: ไม่พบ "${e.quote}" ในสไลด์ ${e.slides}`);
  }
});

test('ตัวเลขทุกตัวในข้อความตัวอย่างต้องปรากฏในสไลด์ที่อ้าง', () => {
  const all = [...OBJECTIVES.flatMap((o) => o.examples), ...LAYERS.flatMap((l) => l.facts)];
  for (const e of all) {
    const pool = e.slides.map((n) => slideText.get(n)).join('');
    for (const m of e.text.replace(/\(.*?\)/g, '').match(/\d[\d,.]*/g) || []) {
      const num = m.replace(/[.,]+$/, '');
      assert.ok(pool.includes(num.replace(/,/g, '')) || pool.includes(num), `ตัวเลข ${num} ไม่อยู่ในสไลด์ ${e.slides}: ${e.text.slice(0, 40)}`);
    }
  }
});

test('ส่วนของอาคาร: อ้างข้อที่มีจริง · เลขสไลด์ถูกต้อง · ทุกข้อที่มีตัวอย่างมีส่วนให้ชี้', () => {
  const objs = new Set(OBJECTIVES.map((o) => o.n));
  for (const p of PARTS) {
    assert.ok(objs.has(p.objective), p.id);
    assert.ok(p.slides.length && p.slides.every((n) => slideText.has(n)), p.id);
    assert.ok(p.why.length > 20);
  }
  for (const o of OBJECTIVES) for (const id of o.parts || [o.part]) assert.ok(id === 'overall' || PARTS.some((p) => p.id === id), `ข้อ ${o.n} → ${id}`);
  for (const o of OBJECTIVES.filter((x) => x.examples.length)) assert.ok(PARTS.some((p) => p.objective === o.n), `ข้อ ${o.n} ไม่มีส่วนอาคารให้จับคู่`);
  assert.ok(SCENE_ONLY.length >= 1);
});

// ---------- รูปประกอบ ----------
const FIG_DIR = new URL('../../assets/lessons/01/', import.meta.url);
test('ทุกวัตถุประสงค์มีรูปประกอบ + รูปภาพรวม · ไฟล์มีอยู่จริง · กว้าง ~1200 px · เล็กกว่า 150 KB', () => {
  assert.deepEqual(Object.keys(OBJECTIVE_FIGURES).map(Number), OBJECTIVES.map((o) => o.n));
  for (const [id, f] of [['ภาพรวม', OVERVIEW_FIGURE], ...OBJECTIVES.map((o) => [`ข้อ ${o.n}`, OBJECTIVE_FIGURES[o.n]])]) {
    const path = new URL(f.file, FIG_DIR);
    assert.ok(existsSync(path), `${id}: ไม่พบไฟล์ ${f.file}`);
    const buf = readFileSync(path);
    assert.ok(buf.length < 150 * 1024, `${id}: ไฟล์ใหญ่เกิน 150 KB (${buf.length})`);
    assert.equal(buf.toString('latin1', 0, 4), 'RIFF', `${id}: ไม่ใช่ WebP`);
    assert.equal(buf.toString('latin1', 8, 12), 'WEBP', `${id}: ไม่ใช่ WebP`);
    assert.ok(f.alt.length > 15 && f.caption.length > 10, `${id}: ไม่มี alt/คำบรรยาย`);
  }
});

test('ข้อที่ไม่มีตัวอย่างในสไลด์ (5, 6) ต้องบอกใต้รูปว่าเป็นภาพประกอบทั่วไป · ข้ออื่นไม่ติดป้ายนี้', () => {
  assert.equal(GENERIC_NOTE, 'ภาพประกอบทั่วไป — สไลด์ชุดนี้ยังไม่มีตัวอย่าง');
  for (const o of OBJECTIVES) assert.equal(!!OBJECTIVE_FIGURES[o.n].generic, o.examples.length === 0, `ข้อ ${o.n}`);
});

test('หน้าบทที่ 1 ไม่โหลด three.js / ฉาก 3 มิติ (เป็นหน้าอ่านล้วน)', () => {
  const imports = readFileSync(new URL('../../src/lesson/objectives/main.js', import.meta.url), 'utf8').match(/^import .*$/gm) || [];
  assert.ok(imports.length >= 5);
  for (const line of imports) assert.ok(!/three|scene|building\.js/.test(line), line);
});

// ---------- ตัวบท ----------
const TONE = '[\u0E48-\u0E4B]';
const BROKEN = [/ทีว่าง/, /\u0E4D/, /นัน(?!ท)/, /ตังแต่/, /ขึน(?!้)/, /พืนที/, /ชัน(?!\u0E49)/, /หนึง/, /เขือน/, /รัว(?!\u0E49)/, /ทังนี/, /อืน(?!\u0E48)/,
  /ดังนี(?!\u0E49)/, /ทั้งนี(?!\u0E49)/, /ใช้บังคับนี/, new RegExp(`ซึง(?!${TONE})`), new RegExp(`ที(?![${'\u0E48-\u0E4B'}])`), /นําสาธารณะ/,
  /นํา/, /ทีมี/, /เพือ(?!\u0E48)/, /การอืน/, /จําเป็น/, /ประโยชน์แห่งความมันคง/];

for (const [name, law] of [['ม.8', LAW_ACT_8], ['ม.77 ส่วนที่ยก', LAW_ACT_77_FRAGMENT]]) {
  test(`ข้อความตัวบท ${name}: ไม่มีคำเพี้ยนที่รู้จัก`, () => {
    for (const re of BROKEN) assert.ok(!re.test(law.text), `พบคำเพี้ยน ${re}`);
    assert.ok(['official-online', 'corrected-from-pdf', 'b-law'].includes(law.textSource));
  });
  test(`ข้อความตัวบท ${name}: ตรงกับ laws.json เมื่อตัดสระ/วรรณยุกต์/ช่องว่าง (ไม่เปลี่ยนคำ ตัวเลข เลขมาตรา)`, { skip: !existsSync(LAWS_JSON) }, () => {
    const row = JSON.parse(readFileSync(LAWS_JSON, 'utf8')).find((x) => x.id === law.lawsJsonId);
    assert.ok(row, law.lawsJsonId);
    assert.equal(row.law, law.law);
    const a = norm(law.text), b = norm(row.text);
    if (name === 'ม.8') assert.equal(a, b);
    else assert.ok(b.includes(a), 'ข้อความที่ยกไม่อยู่ในมาตรา');
  });
}

test('ม.8: ทุกข้อเทียบ (act8.word) ตรงกับข้อความจริง · ข้อ 5 ไม่พบ · เรื่องที่มีเฉพาะมาตรา 8 อยู่ในตัวบท', () => {
  const t = norm(LAW_ACT_8.text);
  for (const o of OBJECTIVES) {
    if (o.act8.match === 'ไม่พบ') {
      assert.equal(o.act8.word, null);
      for (const w of ['เรียบร้อย', 'สวยงาม']) assert.ok(!t.includes(norm(w)), `ม.8 มี "${w}" แล้ว — ต้องทบทวนข้อ ${o.n}`);
    } else assert.ok(t.includes(norm(o.act8.word)), `ข้อ ${o.n}: ม.8 ไม่มี "${o.act8.word}"`);
  }
  for (const w of ACT8_EXTRA) { assert.ok(t.includes(norm(w))); assert.ok(!OBJECTIVES.some((o) => norm(o.name).includes(norm(w))), `${w} อยู่ในสไลด์ 2 แล้ว?`); }
});

test('จุดที่ต้องตรวจมีครบ: ข้อ 5 · เรื่องเกินในมาตรา 8 · ข้อ 2 · ข้อ 4 · การจับคู่ของผู้จัดทำ', () => {
  assert.ok(REVIEW_POINTS.length >= 5);
  for (const r of REVIEW_POINTS) assert.ok(r.title && r.detail);
});

// ---------- สารบัญบท ----------
test('สารบัญบท: 13 หมวดตรงกับตารางภาพรวมใน สารบัญเนื้อหา.md (เลขหมวด + ช่วงสไลด์)', () => {
  const toc = readFileSync(TOC_MD, 'utf8');
  const rows = [...toc.matchAll(/^\| (\d+) \| .*? \| ([\d–]+) \|$/gm)].map((m) => [+m[1], m[2]]);
  assert.equal(CATALOG.length, 13);
  for (const c of CATALOG) { const r = rows.find((x) => x[0] === c.cat); assert.ok(r, `หมวด ${c.cat}`); assert.equal(c.slides, r[1], `หมวด ${c.cat}`); }
});
