// เทสต์ข้อมูลบทที่ 2: ตัวเลขตัวอย่างและข้อความสไลด์ใกล้เคียงต้องอยู่ในข้อความสไลด์จริง · ขั้นอ้างสไลด์ครบ · สารบัญมีบทนี้
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { SLIDE12, SLIDE14, NEARBY } from '../../src/content/lesson02.js';
import { STEPS } from '../../src/lesson/building-class/steps.js';
import { CATALOG } from '../../src/content/catalog.js';

const md = readFileSync(new URL('../../ข้อความสไลด์-คำต่อคำ.md', import.meta.url), 'utf8');
const parts = md.split(/^## สไลด์ (\d+)\s*$/m);
const slide = new Map();
for (let i = 1; i < parts.length; i += 2) slide.set(+parts[i], parts[i + 1].replace(/\s+/g, ''));
const has = (n, q) => slide.get(n).includes(q.replace(/\s+/g, ''));

test('ตัวอย่างสไลด์ 12: พื้นที่ทุกชั้น ดาดฟ้า กันสาด ความสูง และผลรวมอยู่ในสไลด์', () => {
  for (const a of SLIDE12.floorAreas) assert.ok(has(12, `${a}ตร.ม.`), `สไลด์ 12 ไม่มี ${a}`);
  assert.ok(has(12, `ดาดฟ้า${SLIDE12.roofDeckArea}ตร.ม.`));
  for (const c of SLIDE12.canopies) assert.ok(has(12, `${c}ตร.ม.`));
  assert.ok(has(12, '+14.90'));
  assert.equal(SLIDE12.height, 14.9);
  assert.ok(has(12, `${SLIDE12.total.toLocaleString('en-US')}ตร.ม.`));
  assert.equal(SLIDE12.floorAreas.reduce((s, a) => s + a, 0) + SLIDE12.roofDeckArea, SLIDE12.total);
});
test('ตัวอย่างสไลด์ 14: ชั้น 8 และ 22.95 เมตร อยู่ในภาพสไลด์ (บันทึกจากการเปิดรูป slide-014.png)', () => {
  assert.equal(SLIDE14.floors, 8); assert.equal(SLIDE14.height, 22.95);
  assert.ok(has(14, '23เมตร'));
});
test('สไลด์ใกล้เคียง: quote อยู่ในสไลด์นั้นจริง', () => {
  for (const n of NEARBY) assert.ok(has(n.slide, n.quote), `สไลด์ ${n.slide} ไม่มี "${n.quote}"`);
});
test('ทุกขั้นมีเลขสไลด์ ข้อความอธิบาย และกฎที่แสดง · ข้อความไม่มี NaN/undefined', () => {
  assert.ok(STEPS.length >= 3);
  for (const s of STEPS) {
    assert.ok(s.slides.length && s.title && s.explain.length > 40 && s.showRules);
    assert.ok(!/NaN|undefined/.test(s.explain), s.id);
    for (const n of s.slides) assert.ok([12, 14].includes(n));
  }
});
test('สารบัญ: หมวด 3 ชี้ไปบทนี้และบอกว่าทำเฉพาะสไลด์ 12, 14', () => {
  const c = CATALOG.find((x) => x.cat === 3);
  assert.equal(c.file, '02-อาคารขนาดใหญ่-อาคารสูง.html');
  assert.ok(c.note.includes('12') && c.note.includes('14'));
});
