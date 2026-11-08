// เทสต์ตัวตรวจกฎ — ทดสอบผ่าน checkRules เท่านั้น
// ค่าที่คาดหวังมาจากกฎที่เทียบตัวบทแล้ว (status 'verified') เท่านั้น
// กฎ 'needs-review' ไม่ล็อกตัวเลขเกณฑ์ — รอเจ้าของงานตัดสิน (ที่ว่างตัดสินแล้ว 8 พ.ย. 2569 เป็น verified)

import test from 'node:test';
import assert from 'node:assert/strict';
import { checkRules } from '../../src/rules/check.js';
import { RULES } from '../../src/rules/setback-rules.js';

const EPS = 1e-9;

/**
 * ฉากพื้นฐาน: ที่ดิน 20×40, ถนน 8, ไม่มีคลอง, อาคาร x=5 z=5 กว้าง 10 ลึก 10 สูง 8 · พักอาศัย
 * (ซ้าย 5 · ขวา 5 · หลัง 25 — ไกลเขตทุกด้าน)
 */
function scene(over = {}) {
  return {
    lot: { width: 20, depth: 40 },
    road: { width: 8 },
    canal: null,
    building: { x: 5, z: 5, width: 10, depth: 10, floors: 2, height: 8, use: 'residential' },
    ...over,
    ...(over.building ? { building: { ...{ x: 5, z: 5, width: 10, depth: 10, floors: 2, height: 8, use: 'residential' }, ...over.building } } : {}),
  };
}
const byId = (results, id) => {
  const r = results.find((x) => x.id === id);
  assert.ok(r, `ไม่พบผลของกฎ ${id}`);
  return r;
};
const near = (a, b) => Math.abs(a - b) < EPS;

/** ฉากที่ปรับให้ "ระยะถึงคลอง" = gap พอดี: ลึก 40, อาคาร z=10 → ขอบหลัง = 10+depth */
const canalScene = (canalWidth, gap) =>
  scene({ canal: { width: canalWidth }, building: { z: 10, depth: 30 - gap } });

// ---------------------------------------------------------------- คลอง (ข้อ 42)
test('คลองกว้าง 9.99 ม. → ต้องร่น 3 ม.', () => {
  const r = byId(checkRules(canalScene(9.99, 3)), 'canal-setback');
  assert.equal(r.required, 3);
  assert.equal(r.pass, true);
});

test('คลองกว้าง 10 ม. พอดี → ต้องร่น 6 ม. (ไม่ใช่ 3)', () => {
  const r = byId(checkRules(canalScene(10, 3)), 'canal-setback');
  assert.equal(r.required, 6);
  assert.equal(r.pass, false); // ห่าง 3 ม. ไม่พอสำหรับคลองกว้าง 10 ม.
});

test('คลองกว้าง 12 ม. ร่น 6 ม. · ห่างพอดี 6 ม. = ผ่าน', () => {
  const r = byId(checkRules(canalScene(12, 6)), 'canal-setback');
  assert.equal(r.required, 6);
  assert.ok(near(r.actual, 6));
  assert.equal(r.pass, true);
});

test('คลองกว้าง 8 ม. ร่น 3 ม.: ชิดเส้นพอดีผ่าน · เกิน 1 ซม. ไม่ผ่าน', () => {
  assert.equal(byId(checkRules(canalScene(8, 3)), 'canal-setback').pass, true);
  const over = byId(checkRules(canalScene(8, 2.99)), 'canal-setback');
  assert.equal(over.pass, false);
  assert.equal(over.required, 3);
});

test('คลองกว้าง 10 ม.: ชิดเส้น 6 ม. พอดีผ่าน · เกิน 1 ซม. ไม่ผ่าน', () => {
  assert.equal(byId(checkRules(canalScene(10, 6)), 'canal-setback').pass, true);
  assert.equal(byId(checkRules(canalScene(10, 5.99)), 'canal-setback').pass, false);
});

test('ทศนิยม float: ระยะที่ควรเป็น 6 พอดีแต่คำนวณได้ 5.999999999999999 ต้องผ่าน', () => {
  // 36.3 - (0.1+0.2 + 30) = 5.9999999999999964 ใน float (น้อยกว่า 6 นิดเดียว)
  const s = scene({ lot: { width: 20, depth: 36.3 }, canal: { width: 12 }, building: { z: 0.1 + 0.2, depth: 30 } });
  const r = byId(checkRules(s), 'canal-setback');
  assert.ok(r.actual < 6, 'ฉากนี้ต้องให้ float ต่ำกว่า 6 จริง'); 
  assert.ok(Math.abs(r.actual - 6) < EPS);
  assert.equal(r.pass, true);
});

test('ไม่มีคลอง → กฎคลองใช้ไม่ได้ (pass = null)', () => {
  const r = byId(checkRules(scene()), 'canal-setback');
  assert.equal(r.pass, null);
});

test('geometry ของคลอง: เส้นร่นจากคลองระยะเท่าที่กฎกำหนด', () => {
  const r = byId(checkRules(canalScene(12, 7)), 'canal-setback');
  assert.deepEqual(r.geometry, { kind: 'setbackLine', from: 'canal', distance: 6 });
  const n = byId(checkRules(canalScene(5, 7)), 'canal-setback');
  assert.deepEqual(n.geometry, { kind: 'setbackLine', from: 'canal', distance: 3 });
});

test('ข้อความผลตามรูปแบบ "ต้องการ 6 ม. · มีอยู่ 4.5 ม."', () => {
  const r = byId(checkRules(canalScene(12, 4.5)), 'canal-setback');
  assert.match(r.message, /^ต้องการ 6 ม\. · มีอยู่ 4\.5 ม\./);
});

// ---------------------------------------------------------------- ผนังมีช่องเปิด (ข้อ 50)
/** ฉากให้ระยะซ้าย = left (ขวา/หลังไกลเขต) สูง = height */
const wallScene = (height, left) =>
  scene({ building: { x: left, width: 10, height } });

test('สูง 9 ม. พอดี → ต้องห่างเขต 2 ม. · สูง 9.01 ม. → 3 ม.', () => {
  assert.equal(byId(checkRules(wallScene(9, 5)), 'wall-opening-distance').required, 2);
  assert.equal(byId(checkRules(wallScene(9.01, 5)), 'wall-opening-distance').required, 3);
  assert.equal(byId(checkRules(wallScene(8.99, 5)), 'wall-opening-distance').required, 2);
});

test('สูง 9 ม.: ห่าง 2 ม. พอดีผ่าน · ห่าง 1.99 ม. ไม่ผ่าน', () => {
  assert.equal(byId(checkRules(wallScene(9, 2)), 'wall-opening-distance').pass, true);
  assert.equal(byId(checkRules(wallScene(9, 1.99)), 'wall-opening-distance').pass, false);
});

test('สูง 9.01 ม.: ห่าง 3 ม. พอดีผ่าน · ห่าง 2.99 ม. ไม่ผ่าน (2 ม. ไม่พอ)', () => {
  assert.equal(byId(checkRules(wallScene(9.01, 3)), 'wall-opening-distance').pass, true);
  assert.equal(byId(checkRules(wallScene(9.01, 2.99)), 'wall-opening-distance').pass, false);
  assert.equal(byId(checkRules(wallScene(9.01, 2)), 'wall-opening-distance').pass, false);
});

test('สูงเกิน 9 แต่ไม่ถึง 23 ม. ใช้ 3 ม. (22.99) · ตั้งแต่ 23 ม. ข้อ 50 ไม่กำหนด', () => {
  assert.equal(byId(checkRules(wallScene(22.99, 5)), 'wall-opening-distance').required, 3);
  const r = byId(checkRules(wallScene(23, 5)), 'wall-opening-distance');
  assert.equal(r.pass, null);
});

test('ใช้ด้านที่ใกล้เขตที่สุด (ซ้าย/ขวา) และบอกด้านใน geometry', () => {
  // ซ้าย 5, ขวา = 20-(5+14) = 1 → ขวาใกล้สุด
  const s = scene({ building: { x: 5, width: 14, height: 8 } });
  const r = byId(checkRules(s), 'wall-opening-distance');
  assert.ok(near(r.actual, 1));
  assert.equal(r.pass, false);
  assert.deepEqual(r.geometry, { kind: 'setbackLine', from: 'boundary-right', distance: 2 });
});

test('ไม่มีคลอง: ขอบหลังเป็นเขตที่ดินข้างเคียง ต้องตรวจด้วย', () => {
  // หลัง = 40-(5+34) = 1
  const s = scene({ building: { depth: 34, height: 8 } });
  const r = byId(checkRules(s), 'wall-opening-distance');
  assert.equal(r.pass, false);
  assert.equal(r.geometry.from, 'boundary-back');
});

test('มีคลอง: ขอบหลังคือเขตคลอง ไม่นับเป็นเขตที่ดินข้างเคียงของข้อ 50', () => {
  const s = scene({ canal: { width: 12 }, building: { depth: 34, height: 8 } });
  const r = byId(checkRules(s), 'wall-opening-distance');
  assert.equal(r.pass, true); // ซ้าย/ขวา ห่าง 5 ม.
  assert.notEqual(r.geometry.from, 'boundary-back');
});

// ---------------------------------------------------------------- ที่ว่าง (verified · ต้องผ่านทั้งแบบ A และ B)
// แบบ A = ข้อบัญญัติ กทม. 2544 ข้อ 52 (1): ที่ว่าง >= 30% ของที่ดิน · แบบ B = ฉบับที่ 55 ข้อ 33 (1): ที่ว่าง >= 30% ของชั้นใหญ่สุด
// หมายเหตุ: ในฉากกล่องเดียว "ผ่าน A แต่ไม่ผ่าน B" เกิดไม่ได้ (ถ้าที่ว่าง >= 30% ของที่ดิน แล้วฐานอาคาร <= 70% ของที่ดิน → 30% ของฐาน <= 21% ของที่ดิน < ที่ว่าง)
const openScene = (lotW, lotD, bw, bd) =>
  scene({ lot: { width: lotW, depth: lotD }, building: { x: 0, z: 0, width: bw, depth: bd } });

test('ที่ว่าง: กฎเป็น verified ไม่ติดธง needsReview และหักพื้นที่อาคารออกจากที่ดิน', () => {
  // ที่ดิน 10×10 = 100 ตร.ม. อาคาร 5×10 = 50 → ว่าง 50%
  const r = byId(checkRules(openScene(10, 10, 5, 10)), 'open-area-residential');
  assert.equal(r.needsReview, false);
  assert.equal(RULES.find((x) => x.id === 'open-area-residential').status, 'verified');
  assert.equal(r.unit, '%');
  assert.equal(r.geometry.kind, 'openArea');
  assert.ok(near(r.geometry.ratio, 0.5), `ratio=${r.geometry.ratio}`);
  assert.ok(near(r.actual, 50));
  assert.equal(r.pass, true);
});

test('ที่ว่าง: อาคารไม่ใช่พักอาศัย → กฎของสไลด์ 53 ใช้ไม่ได้', () => {
  const r = byId(checkRules(scene({ building: { use: 'other' } })), 'open-area-residential');
  assert.equal(r.pass, null);
});

test('ที่ว่าง: ผลแบบ B (alt) แนบมาด้วย และฟิลด์ผลหลักยังครบ', () => {
  const r = byId(checkRules(scene()), 'open-area-residential');
  assert.equal(r.alt.basis, 'largestFloor');
  assert.equal(typeof r.alt.pass, 'boolean');
  for (const k of ['id', 'title', 'pass', 'required', 'actual', 'unit', 'message', 'source', 'slides', 'needsReview', 'geometry']) {
    assert.ok(k in r, `ขาดฟิลด์ ${k}`);
  }
  assert.equal(r.required, 30);
});

test('ที่ว่างแบบ A: 30% พอดีผ่าน · 29.9% ไม่ผ่าน (ที่ดิน 100 ตร.ม.)', () => {
  const at = byId(checkRules(openScene(10, 10, 7, 10)), 'open-area-residential'); // ฐาน 70 → ว่าง 30
  assert.ok(near(at.actual, 30));
  assert.equal(at.pass, true);
  const below = byId(checkRules(openScene(10, 10, 7.01, 10)), 'open-area-residential'); // ฐาน 70.1 → ว่าง 29.9
  assert.ok(Math.abs(below.actual - 29.9) < 1e-6);
  assert.equal(below.pass, false);
});

test('ที่ว่างแบบ B (alt): ขอบเกณฑ์ 30% ของชั้นใหญ่สุดพอดีผ่าน · เกิน 0.1 ตร.ม. ไม่ผ่าน', () => {
  // ที่ดิน 130 · ฐาน 100 → ว่าง 30 = 30% ของ 100 พอดี (B ผ่าน แต่ A = 23% ไม่ผ่าน)
  const at = byId(checkRules(openScene(13, 10, 10, 10)), 'open-area-residential');
  assert.ok(near(at.alt.requiredArea, 30));
  assert.ok(near(at.alt.actualArea, 30));
  assert.equal(at.alt.pass, true);
  // ฐาน 100.1 → ว่าง 29.9 < 30.03
  const over = byId(checkRules(openScene(13, 10, 10.01, 10)), 'open-area-residential');
  assert.equal(over.alt.pass, false);
});

test('ที่ว่าง: ผ่าน B แต่ไม่ผ่าน A → pass = false (ต้องผ่านทั้งสองแบบ)', () => {
  // ที่ดิน 130 ฐาน 100: B ผ่านพอดี แต่ A ได้ 23.08%
  const r = byId(checkRules(openScene(13, 10, 10, 10)), 'open-area-residential');
  assert.equal(r.alt.pass, true);
  assert.ok(r.actual < 30);
  assert.equal(r.pass, false);
});

test('ที่ว่าง: ผ่านทั้ง A และ B → pass = true · ไม่ผ่านทั้งสอง → false', () => {
  assert.equal(byId(checkRules(openScene(10, 10, 5, 10)), 'open-area-residential').pass, true);
  const none = byId(checkRules(openScene(10, 10, 9, 10)), 'open-area-residential'); // ว่าง 10%
  assert.equal(none.alt.pass, false);
  assert.equal(none.pass, false);
});

test('ที่ว่าง: message บอกทั้งแบบ A และแบบ B', () => {
  const r = byId(checkRules(openScene(13, 10, 10, 10)), 'open-area-residential');
  assert.match(r.message, /A .*30%.*23\.08%.*ไม่ผ่าน/);
  assert.match(r.message, /B .*30 ตร\.ม\..*ผ่าน/);
});

// ---------------------------------------------------------------- ที่มาและสถานะ
test('ทุกผลจาก checkRules มี source.law และ source.clause ไม่ว่าง', () => {
  const scenes = [scene(), canalScene(12, 7), canalScene(5, 2), scene({ building: { use: 'other', height: 30 } })];
  for (const s of scenes) {
    for (const r of checkRules(s)) {
      assert.ok(r.source && r.source.law && r.source.law.trim(), `${r.id} ไม่มี source.law`);
      assert.ok(r.source.clause && r.source.clause.trim(), `${r.id} ไม่มี source.clause`);
      assert.ok(Array.isArray(r.slides) && r.slides.length > 0, `${r.id} ไม่มีเลขสไลด์`);
    }
  }
});

test('ทุกกฎใน RULES (รวม inScene:false) มีที่มา สถานะ และโน้ตครบ', () => {
  const ids = new Set();
  for (const rule of RULES) {
    assert.ok(!ids.has(rule.id), `id ซ้ำ ${rule.id}`);
    ids.add(rule.id);
    assert.ok(rule.source.law.trim() && rule.source.clause.trim(), `${rule.id} ที่มาไม่ครบ`);
    assert.ok(['verified', 'needs-review'].includes(rule.status), `${rule.id} สถานะผิด`);
    assert.equal(typeof rule.inScene, 'boolean');
    assert.ok(rule.slides.length > 0 && rule.explain && rule.title && rule.reviewNote);
    if (rule.status === 'verified') {
      assert.ok(rule.source.text.trim().length > 20, `${rule.id} verified แต่ไม่มีข้อความตัวบท`);
    }
  }
});

test('สถานะ needsReview ของผล ตรงกับ status ของกฎ', () => {
  const results = checkRules(canalScene(12, 7));
  for (const r of results) {
    const rule = RULES.find((x) => x.id === r.id);
    assert.equal(r.needsReview, rule.status === 'needs-review', r.id);
  }
});

test('กฎที่ตรวจในฉากได้ทุกข้อ มีตัวตรวจจริง (ไม่ตกไป "ยังไม่มีตัวตรวจ")', () => {
  for (const r of checkRules(canalScene(12, 7))) {
    assert.ok(!r.message.includes('ยังไม่มีตัวตรวจ'), r.id);
  }
  const inScene = RULES.filter((x) => x.inScene).map((x) => x.id);
  assert.deepEqual(checkRules(canalScene(12, 7)).map((r) => r.id), inScene);
});

test('กฎ inScene:false ไม่ถูกคืนจาก checkRules (เป็นเนื้อหาอ่านอย่างเดียว)', () => {
  const ids = checkRules(canalScene(12, 7)).map((r) => r.id);
  for (const rule of RULES.filter((x) => !x.inScene)) assert.ok(!ids.includes(rule.id), rule.id);
});

test('ฉากตัวอย่างสไลด์: ที่ดิน 16×30 ถนน 8 คลอง 12 อาคาร x=2 z=5 กว้าง 12 ลึก 18 สูง 9 2 ชั้น', () => {
  const s = {
    lot: { width: 16, depth: 30 },
    road: { width: 8 },
    canal: { width: 12 },
    building: { x: 2, z: 5, width: 12, depth: 18, floors: 2, height: 9, use: 'residential' },
  };
  const rs = checkRules(s);
  const canal = byId(rs, 'canal-setback');
  assert.equal(canal.required, 6);
  assert.ok(near(canal.actual, 7));
  assert.equal(canal.pass, true);
  const wall = byId(rs, 'wall-opening-distance');
  assert.equal(wall.required, 2);
  assert.ok(near(wall.actual, 2)); // ซ้าย 2 · ขวา 16-14 = 2 → ชิดเส้นพอดี
  assert.equal(wall.pass, true);
  const open = byId(rs, 'open-area-residential');
  assert.ok(near(open.actual, 55)); // 1 - 216/480
});

// ---------------------------------------------------------------- ข้อความตัวบท (D2: แก้สระ/วรรณยุกต์ที่เพี้ยนจากการถอด PDF แล้ว)
const allSources = RULES.flatMap((r) => [r.source, ...(r.alternateSources || [])].map((s, i) => ({ id: i ? `${r.id}#${i}` : r.id, s })));
const TONE = '[\\u0E48-\\u0E4B]';
// คำเพี้ยนที่เจอใน laws.json (ไม่มีวรรณยุกต์/ ํา แทน ำ)
const BROKEN = [
  /ทีว่าง/, /\u0E4D/, /นัน(?!ท)/, /ตังแต่/, /ขึน(?!้)/, /พืนที/, /ชัน(?!\u0E49)/, /หนึง/, /เขือน/, /รัว(?!\u0E49)/, /ทังนี/, /อืน(?!\u0E48)/,
  /ดังนี(?!\u0E49)/, /ทั้งนี(?!\u0E49)/, /ใช้บังคับนี/, new RegExp(`ซึง(?!${TONE})`), new RegExp(`ที(?![${'\\u0E48-\\u0E4B'}])`), /นําสาธารณะ/,
];

test('ทุก source.text (และ alternateSources) ไม่มีคำเพี้ยนที่รู้จัก', () => {
  for (const { id, s } of allSources) {
    for (const re of BROKEN) assert.ok(!re.test(s.text), `${id}: พบคำเพี้ยน ${re} ใน "${s.text.slice(0, 40)}..."`);
  }
});

test('ทุก source มี textSource ที่ถูกต้อง (ยกเว้นข้อความ "-" ที่ไม่มีตัวบท)', () => {
  for (const { id, s } of allSources) {
    if (s.text === '-') continue;
    assert.ok(['official-online', 'corrected-from-pdf', 'b-law'].includes(s.textSource), `${id}: textSource=${s.textSource}`);
  }
});

const numbersOf = (t) => (t.match(/\d+(?:\.\d+)?/g) || []).map(Number);
const ruleById = (id) => RULES.find((r) => r.id === id);

test('canal-setback: ตัวเลขใน params (10/3/6) อยู่ในข้อความตัวบท และมี 12 ม. (แหล่งน้ำใหญ่) ครบ', () => {
  const rule = ruleById('canal-setback');
  const nums = numbersOf(rule.source.text);
  for (const v of [rule.params.canalWidthThreshold, rule.params.setbackNarrow, rule.params.setbackWide]) assert.ok(nums.includes(v), `ไม่พบ ${v}`);
  assert.deepEqual(nums, [42, 10, 3, 10, 6, 12]);
});

test('wall-opening-distance: ตัวเลข 9/2/23 ใน params อยู่ในข้อความตัวบท', () => {
  const rule = ruleById('wall-opening-distance');
  const nums = numbersOf(rule.source.text);
  for (const v of [rule.params.lowMaxHeight, rule.params.lowSetback, rule.params.midUpperExclusive]) assert.ok(nums.includes(v), `ไม่พบ ${v}`);
  for (const v of [rule.params.midSetback, 3]) assert.ok(nums.includes(v), `ไม่พบ ${v}`);
  assert.deepEqual(nums, [50, 1, 9, 2, 2, 9, 23, 3, 1, 2, 50, 15, 1, 2, 1.8]);
});

// ข้อ 50 เติมครบแล้ว (คัดจาก laws.json id gk55_50 เฉพาะข้อ 50) — เลข 2, 3, 9, 23 ต้องอยู่ในข้อความและตรง params
for (const id of ['wall-opening-distance', 'wall-opening-floors-wording']) {
  test(`${id}: ข้อความข้อ 50 ครบ มีเลข 2, 3, 9, 23`, () => {
    const t = ruleById(id).source.text;
    const nums = numbersOf(t);
    for (const v of [2, 3, 9, 23]) assert.ok(nums.includes(v), `ไม่พบ ${v}`);
    assert.ok(t.includes('อยู่ห่างเขตที่ดินไม่น้อยกว่า 3 เมตร'));
    assert.ok(t.endsWith('ด้านนั้นด้วย'));
    assert.ok(!t.includes('ข้อ 51'));
  });
}
test('wall-opening-distance: ตัวเลขใน params ตรงกับข้อความข้อ 50', () => {
  const rule = ruleById('wall-opening-distance');
  const p = rule.params;
  const t = rule.source.text;
  assert.ok(t.includes(`ไม่เกิน ${p.lowMaxHeight} เมตร`) && t.includes(`ไม่น้อยกว่า ${p.lowSetback} เมตร`));
  assert.ok(t.includes(`เกิน ${p.lowMaxHeight} เมตร แต่ไม่ถึง ${p.midUpperExclusive} เมตร`) && t.includes(`ไม่น้อยกว่า ${p.midSetback} เมตร`));
});
test('source.text ที่ textSource = corrected-from-pdf ไม่มีช่องว่างกลางคำที่เกิดจากการตัดบรรทัด', () => {
  const GAPS = ['แหล่ง น้ำ', 'แต่ ถ้า', 'แนว อาคาร', 'ห่าง จาก', 'สูง จาก', 'เคียง ด้าน', 'ที่ ก่อ', 'ของ อาคาร', 'เพื่อ เชื่อม', 'ตาราง เมตร', 'อาคาร พาณิชย์', 'ใด ชั้น'];
  for (const { id, s } of allSources) {
    if (s.textSource !== 'corrected-from-pdf') continue;
    for (const g of GAPS) assert.ok(!s.text.includes(g), `${id}: พบช่องว่างกลางคำ "${g}"`);
  }
});
