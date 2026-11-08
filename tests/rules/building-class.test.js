// เทสต์ตัวจำแนกอาคารขนาดใหญ่ / อาคารสูง — ทดสอบผ่าน classifyBuilding เท่านั้น (ข้อความตัวบทตรวจจากข้อมูลกฎ)
// ค่าที่คาดหวังมาจากกฎ status 'verified' เท่านั้น · กฎ 'needs-review' ไม่ล็อกตัวเลขเกณฑ์
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { classifyBuilding } from '../../src/rules/classify.js';
import { RULES } from '../../src/rules/building-class-rules.js';

const LAWS = JSON.parse(readFileSync('D:/ai/building-law-chatbot/output/laws.json', 'utf8'));
const BYLAW_TXT = readFileSync('D:/ai/b-law/bkk-bylaw-2544.txt', 'utf8');
const SLIDES_MD = readFileSync(new URL('../../ข้อความสไลด์-คำต่อคำ.md', import.meta.url), 'utf8');

/** อาคารทุกชั้นเท่ากัน: พื้นที่ต่อชั้น = area ตร.ม. สูงรวม = floors × floorHeight (หลังคาแบน ไม่มีดาดฟ้า) */
function bld(over = {}) {
  const { area = 100, ...rest } = over;
  return { floors: 4, floorHeight: 3, footprint: { width: area, depth: 1 }, roof: { type: 'flat' }, ...rest };
}
const byId = (results, id) => {
  const r = results.find((x) => x.id === id);
  assert.ok(r, `ไม่พบผลของ ${id}`);
  return r;
};
const isLarge = (p) => byId(classifyBuilding(p), 'large').is;
const isHigh = (p) => byId(classifyBuilding(p), 'high').is;
const rule = (id) => RULES.find((r) => r.id === id);

// ---------------------------------------------------------------- อาคารขนาดใหญ่: พื้นที่รวมเกิน 2,000
test('พื้นที่รวมพอดี 2,000 ตร.ม. (ชั้นเตี้ย) → ไม่เป็น · 2,000.01 → เป็น · 1,999.99 → ไม่เป็น', () => {
  // 1 ชั้น สูง 3 ม. (ไม่ถึง 15 ม. จึงเหลือแต่เกณฑ์พื้นที่)
  assert.equal(isLarge(bld({ floors: 1, area: 2000 })), false);
  assert.equal(isLarge(bld({ floors: 1, area: 2000.01 })), true);
  assert.equal(isLarge(bld({ floors: 1, area: 1999.99 })), false);
});
test('พื้นที่รวมนับทุกชั้น: 4 ชั้น × 500 = 2,000 ไม่เป็น · 4 ชั้น × 500.01 → เป็น', () => {
  assert.equal(isLarge(bld({ floors: 4, area: 500 })), false);
  assert.equal(isLarge(bld({ floors: 4, area: 500.01 })), true);
});
test('floorAreas: ใช้พื้นที่แต่ละชั้นแทน footprint · จำนวนชั้น = ความยาวอาร์เรย์', () => {
  const p = { floors: 99, floorHeight: 3, footprint: { width: 1, depth: 1 }, floorAreas: [1000, 1000, 1], roof: { type: 'flat' } };
  const r = byId(classifyBuilding(p), 'large-by-area');
  assert.equal(r.actual, 2001);
  assert.equal(r.is, true);
  assert.equal(byId(classifyBuilding(p), 'high').actual, 9); // 3 ชั้น × 3 ม.
});

// ---------------------------------------------------------------- อาคารขนาดใหญ่: สูงตั้งแต่ 15.00 และพื้นที่ 1,000–2,000
test('สูงพอดี 15.00 ม. และพื้นที่ 1,500 → เป็น · สูง 14.99 ม. → ไม่เป็น · สูง 15.01 → เป็น', () => {
  assert.equal(isLarge(bld({ floors: 5, floorHeight: 3, area: 300 })), true); // 15.00 ม. · 1,500 ตร.ม.
  assert.equal(isLarge(bld({ floors: 1, floorHeight: 14.99, area: 1500 })), false);
  assert.equal(isLarge(bld({ floors: 1, floorHeight: 15.0, area: 1500 })), true);
  assert.equal(isLarge(bld({ floors: 1, floorHeight: 15.01, area: 1500 })), true);
});
test('เกณฑ์ความสูงขอบเขต 1 ซม.: 14.99 ไม่ถึง · 15.00 ถึง (ผล large-by-height)', () => {
  const lo = byId(classifyBuilding(bld({ floors: 1, floorHeight: 14.99, area: 1500 })), 'large-by-height');
  const hi = byId(classifyBuilding(bld({ floors: 1, floorHeight: 15, area: 1500 })), 'large-by-height');
  assert.equal(lo.is, false); assert.equal(hi.is, true);
  assert.equal(hi.required, rule('large').params.heightMin);
});
test('สูง ≥ 15 ม. แต่พื้นที่รวมพอดี 1,000 → ไม่เป็น · 1,000.01 → เป็น', () => {
  assert.equal(isLarge(bld({ floors: 5, floorHeight: 3, area: 200 })), false); // 1,000 ตร.ม.
  assert.equal(isLarge(bld({ floors: 5, floorHeight: 3, area: 200.01 })), true); // 1,000.05
  assert.equal(isLarge(bld({ floors: 1, floorHeight: 15, area: 1000.01 })), true);
  assert.equal(isLarge(bld({ floors: 1, floorHeight: 15, area: 1000 })), false);
});
test('พื้นที่ 1,000 ถึง 2,000 แต่เตี้ยกว่า 15 ม. → ไม่เป็น', () => {
  assert.equal(isLarge(bld({ floors: 4, floorHeight: 3.7, area: 400 })), false); // 14.8 ม. · 1,600 ตร.ม.
});
test('ตัวอย่างสไลด์ 12: ชั้นละ 450/450/450/300/200 + ดาดฟ้า 120 สูง 14.90 → ไม่เป็น ทั้งนับและไม่นับดาดฟ้า', () => {
  const p = { floors: 5, floorHeight: 14.9 / 5, footprint: { width: 1, depth: 1 }, floorAreas: [450, 450, 450, 300, 200], roofDeckArea: 120, roof: { type: 'flat' } };
  const withDeck = byId(classifyBuilding({ ...p, countRoofDeck: true }), 'large-by-area');
  const without = byId(classifyBuilding({ ...p, countRoofDeck: false }), 'large-by-area');
  assert.equal(withDeck.actual, 1970); // ตรงกับสไลด์ 12
  assert.equal(without.actual, 1850);
  assert.equal(isLarge({ ...p, countRoofDeck: true }), false);
  assert.equal(isLarge({ ...p, countRoofDeck: false }), false);
  assert.equal(byId(classifyBuilding(p), 'high').actual, 14.9);
});
test('ผลสรุป large = (พื้นที่รวม > 2,000) หรือ (สูง ≥ 15 และ พื้นที่รวม > 1,000) ทุกคู่ค่า', () => {
  const lp = rule('large').params;
  for (const h of [3, 14.99, 15, 15.01, 40]) {
    for (const total of [500, 1000, 1000.01, 1500, 2000, 2000.01, 5000]) {
      const want = total > lp.areaOverAlways || (h >= lp.heightMin && total > lp.areaOverWithHeight);
      assert.equal(isLarge({ floors: 1, floorHeight: h, footprint: { width: total, depth: 1 }, roof: { type: 'flat' } }), want, `h=${h} total=${total}`);
    }
  }
});

// ---------------------------------------------------------------- อาคารสูง
test('อาคารสูง: สูงพอดี 23.00 ม. → เป็น · 22.99 ม. → ไม่เป็น · 23.01 → เป็น', () => {
  assert.equal(isHigh(bld({ floors: 1, floorHeight: 23 })), true);
  assert.equal(isHigh(bld({ floors: 1, floorHeight: 22.99 })), false);
  assert.equal(isHigh(bld({ floors: 1, floorHeight: 23.01 })), true);
});
test('อาคารสูง: 8 ชั้น สูงรวม 22.95 ม. (ภาพสไลด์ 14) → ยังไม่เป็น · เกณฑ์ที่คืนตรงกับข้อมูลกฎ', () => {
  const r = byId(classifyBuilding(bld({ floors: 8, floorHeight: 22.95 / 8 })), 'high');
  assert.equal(r.is, false);
  assert.ok(Math.abs(r.actual - 22.95) < 1e-9);
  assert.equal(r.required, rule('high').params.heightMin);
});
test('ความสูงรวมจากจำนวนชั้น × ความสูงต่อชั้น ไม่คลาดเพราะเลขทศนิยม: 10 ชั้น × 2.3 = 23.00 → เป็น', () => {
  assert.equal(isHigh(bld({ floors: 10, floorHeight: 2.3 })), true); // 10 × 2.3 = 23 พอดี (ใน float อาจได้ 22.999…)
  assert.equal(isHigh(bld({ floors: 3, floorHeight: 7.65 })), false); // 22.95
  assert.equal(isHigh(bld({ floors: 3, floorHeight: 7.6667 })), true); // 23.0001 → ปัดเป็น 23.00 ซม. ละเอียด 1 ซม.
});

// ---------------------------------------------------------------- วิธีวัดความสูง: หลังคาจั่ว/ปั้นหยาวัดถึงยอดผนัง ไม่ใช่ยอดหลังคา
test('หลังคาจั่ว: ยอดจั่วสูงแค่ไหนก็ไม่เปลี่ยนความสูงที่วัด (วัดถึงยอดผนังของชั้นสูงสุด)', () => {
  const flat = byId(classifyBuilding(bld({ floors: 7, floorHeight: 3.2 })), 'high'); // 22.4
  const g0 = byId(classifyBuilding(bld({ floors: 7, floorHeight: 3.2, roof: { type: 'gable', ridgeHeight: 0 } })), 'high');
  const g9 = byId(classifyBuilding(bld({ floors: 7, floorHeight: 3.2, roof: { type: 'gable', ridgeHeight: 9 } })), 'high');
  assert.equal(g0.actual, flat.actual); assert.equal(g9.actual, flat.actual);
  assert.equal(g9.is, false); // ยอดหลังคาอยู่ที่ 31.4 ม. แต่ไม่ใช่ที่วัด
  assert.equal(g9.geometry.measuredTo, 'top-of-wall');
  assert.equal(flat.geometry.measuredTo, 'roof-deck');
});
test('หลังคาจั่วไม่มีดาดฟ้า: ใส่พื้นที่ดาดฟ้าแล้วก็ไม่นับ', () => {
  const p = bld({ floors: 1, area: 1999, roofDeckArea: 500, countRoofDeck: true, roof: { type: 'gable', ridgeHeight: 3 } });
  assert.equal(byId(classifyBuilding(p), 'large-by-area').actual, 1999);
});

// ---------------------------------------------------------------- ดาดฟ้า (จุดที่ต้องตรวจ): ค่าตั้งต้นไม่นับ · ผลของทั้งสองแบบแสดงคู่กัน
test('ดาดฟ้า: ค่าตั้งต้นไม่นับ · นับเมื่อ countRoofDeck · ดาดฟ้าทำให้เกิน 2,000 ได้เมื่อนับ', () => {
  const p = bld({ floors: 1, area: 1900, roofDeckArea: 101 });
  assert.equal(byId(classifyBuilding(p), 'large-by-area').actual, 1900);
  assert.equal(isLarge(p), false);
  const q = { ...p, countRoofDeck: true };
  assert.equal(byId(classifyBuilding(q), 'large-by-area').actual, 2001);
  assert.equal(isLarge(q), true);
  assert.equal(isLarge({ ...q, roofDeckArea: 100 }), false); // 2,000 พอดี ยังไม่เกิน
});
test('ดาดฟ้า: มีดาดฟ้า = ติดป้ายจุดที่ต้องตรวจที่ผลพื้นที่ · ผลสรุปติดป้ายเมื่อนับ/ไม่นับแล้วผลต่างกัน · ไม่มีดาดฟ้าไม่ติดป้าย', () => {
  const none = classifyBuilding(bld({ floors: 1, area: 1900 }));
  assert.ok(none.every((r) => r.needsReview === false), 'ไม่มีดาดฟ้าต้องไม่มีป้าย');
  const p = bld({ floors: 1, area: 1900, roofDeckArea: 101 });
  const rs = classifyBuilding(p);
  assert.equal(byId(rs, 'large-by-area').needsReview, true);
  assert.ok(byId(rs, 'large-by-area').reviewNote.length > 20);
  assert.equal(byId(rs, 'large').needsReview, true);
  assert.deepEqual(byId(rs, 'large').alt, { withDeck: true, withoutDeck: false, differs: true });
  const same = classifyBuilding(bld({ floors: 1, area: 100, roofDeckArea: 10 }));
  assert.equal(byId(same, 'large-by-area').needsReview, true);
  assert.equal(byId(same, 'large').needsReview, false); // ผลเหมือนกันทั้งสองแบบ
  assert.equal(byId(same, 'high').needsReview, false);
});
test('alt ของ large-by-area บอกพื้นที่รวมทั้งสองแบบ (สไลด์ 12 = 1,970 · ตัวบทฉบับที่ 33 = 1,850)', () => {
  const p = { floors: 5, floorHeight: 2.98, footprint: { width: 1, depth: 1 }, floorAreas: [450, 450, 450, 300, 200], roofDeckArea: 120, roof: { type: 'flat' } };
  const r = byId(classifyBuilding(p), 'large-by-area');
  assert.equal(r.alt.withDeck, 1970); assert.equal(r.alt.withoutDeck, 1850);
});
test('geometry.crossing: ชั้นแรกที่ทำให้พื้นที่สะสมเกิน 2,000', () => {
  const g = (areas, extra = {}) => byId(classifyBuilding({ floors: 1, floorHeight: 3, footprint: { width: 1, depth: 1 }, floorAreas: areas, roof: { type: 'flat' }, ...extra }), 'large-by-area').geometry.crossing;
  assert.equal(g([1000, 1000, 1]), 2); // ชั้น 3 (ดัชนี 2)
  assert.equal(g([1000, 1000]), null);
  assert.equal(g([1000, 1000], { roofDeckArea: 5, countRoofDeck: true }), 'deck');
  assert.equal(g([2001]), 0);
});

// ---------------------------------------------------------------- ผลทุกตัวมีที่มา
test('ทุกผลมี source.law / source.clause / source.text และเลขสไลด์', () => {
  for (const r of classifyBuilding(bld())) {
    assert.ok(r.source?.law && r.source?.clause && r.source?.text, `${r.id}: ไม่มี source`);
    assert.ok(Array.isArray(r.slides) && r.slides.length > 0, `${r.id}: ไม่มีเลขสไลด์`);
    assert.ok(['large-by-area', 'large-by-height', 'large', 'high'].includes(r.id));
    assert.equal(typeof r.is, 'boolean');
    assert.ok(r.title && r.message, `${r.id}: ไม่มีชื่อหรือข้อความ`);
  }
});
test('ผลอาคารขนาดใหญ่อ้างสไลด์ 12 · อาคารสูงอ้างสไลด์ 14', () => {
  const rs = classifyBuilding(bld());
  for (const id of ['large-by-area', 'large-by-height', 'large']) assert.deepEqual(byId(rs, id).slides, [12]);
  assert.deepEqual(byId(rs, 'high').slides, [14]);
});

// ---------------------------------------------------------------- ข้อความตัวบท
const norm = (s) => s.replace(/\u0E4D\u0E32/g, '\u0E33').replace(/[\u0E31\u0E34-\u0E3A\u0E47-\u0E4E\s]/g, '');
const allSources = RULES.flatMap((r) => [{ id: r.id, s: r.source }, ...(r.alternateSources || []).map((s) => ({ id: r.id, s }))]);
const ministryRecord = (law, clausePrefix) => LAWS.filter((x) => x.law === law && x.section === clausePrefix).map((x) => norm(x.text)).join('');
const BROKEN = [/ทีว่าง/, /ขึน/, /นํา/, /ตังแต่/, /ทีมี/, /พืนที/, /ชันสูง/, /จัวหรือ/, /ปันหยา/, /ก่อสร้างขึน/];

test('ทุก source มี textSource ถูกต้อง และไม่มีคำเพี้ยนที่รู้จัก', () => {
  for (const { id, s } of allSources) {
    assert.ok(['corrected-from-pdf', 'b-law', 'official-online'].includes(s.textSource), `${id}: textSource=${s.textSource}`);
    for (const re of BROKEN) assert.ok(!re.test(s.text), `${id}: พบคำเพี้ยน ${re} ใน "${s.text.slice(0, 40)}..."`);
  }
});

test('ข้อความตัวบทตรงกับ laws.json / bkk-bylaw-2544.txt เมื่อตัดสระ/วรรณยุกต์/ช่องว่างออกทั้งสองฝั่ง', () => {
  const bylawNorm = norm(BYLAW_TXT);
  for (const { id, s } of allSources) {
    const t = norm(s.text);
    if (s.textSource === 'b-law') {
      assert.ok(bylawNorm.includes(t), `${id} (${s.clause}): ไม่พบใน bkk-bylaw-2544.txt`);
    } else {
      const m = /ข้อ (\d+)/.exec(s.clause);
      const idPrefix = s.law.includes('55') ? 'gk55' : 'gk33';
      const rec = LAWS.find((x) => x.id === `${idPrefix}_${m[1]}`);
      assert.ok(rec, `${id}: ไม่พบ ${idPrefix}_${m[1]} ใน laws.json`);
      assert.ok(norm(rec.text).includes(t), `${id} (${s.clause}): ข้อความไม่ตรงกับ laws.json`);
    }
  }
});

test('ตัวเลขในข้อความตัวบทไม่ถูกเปลี่ยน: เทียบกับ laws.json / bkk-bylaw-2544.txt ตัวต่อตัว', () => {
  const digits = (t) => (t.replace(/(\d),(\d)/g, '$1$2').match(/\d+(?:\.\d+)?/g) || []).map(Number);
  for (const { id, s } of allSources) {
    const hay = s.textSource === 'b-law' ? norm(BYLAW_TXT) : norm(LAWS.find((x) => x.id === `${s.law.includes('55') ? 'gk55' : 'gk33'}_${/ข้อ (\d+)/.exec(s.clause)[1]}`).text);
    const want = digits(s.text);
    const at = hay.indexOf(norm(s.text));
    assert.ok(at >= 0);
    assert.deepEqual(digits(hay.slice(at, at + norm(s.text).length)), want, `${id}: ตัวเลขไม่ตรง`);
  }
});

test('ไม่มีช่องว่างกลางคำที่เกิดจากการตัดบรรทัด (ข้อความที่แก้จาก PDF)', () => {
  const GAPS = ['ตาราง เมตร', 'พื้น ดาดฟ้า', 'อาคาร ขนาด', 'ชั้น สูงสุด', 'ก่อสร้าง ถึง', 'ระดับ พื้นดิน', 'ในหลัง เดียวกัน', 'เมตร ขึ้น', 'ใช้ สอย', 'เข้า ใช้'];
  for (const { id, s } of allSources) {
    if (s.textSource !== 'corrected-from-pdf') continue;
    for (const g of GAPS) assert.ok(!s.text.includes(g), `${id}: พบช่องว่างกลางคำ "${g}"`);
  }
});

// ---------------------------------------------------------------- ตัวเลขในข้อมูลกฎ ตรงกับตัวบท · ตรงกับข้อความผลที่ตัวจำแนกคืน
const digitsOf = (t) => (t.replace(/(\d),(\d)/g, '$1$2').match(/\d+(?:\.\d+)?/g) || []).map(Number);
test('large: ตัวเลข params (2,000 / 15.00 / 1,000) อยู่ในข้อความตัวบททั้งสองฉบับ และตรงกับสไลด์ 12', () => {
  const lp = rule('large').params;
  for (const s of [rule('large').source, ...rule('large').alternateSources]) {
    const nums = digitsOf(s.text);
    for (const v of [lp.areaOverAlways, lp.heightMin, lp.areaOverWithHeight]) assert.ok(nums.includes(v), `${s.clause}: ไม่พบ ${v}`);
  }
  assert.ok(rule('large').source.text.includes(`แต่ไม่เกิน ${lp.areaMaxWithHeight.toLocaleString('en-US')} ตารางเมตร`));
  const slide12 = SLIDES_MD.split(/^## สไลด์ 12\s*$/m)[1].split(/^## สไลด์ 13/m)[0];
  for (const v of ['2,000', '15.00', '1,000']) assert.ok(slide12.includes(v), `สไลด์ 12 ไม่มี ${v}`);
});
test('high: ตัวเลข 23.00 อยู่ในข้อความตัวบทและตรงกับสไลด์ 14', () => {
  const hp = rule('high').params;
  assert.ok(digitsOf(rule('high').source.text).includes(hp.heightMin));
  assert.ok(digitsOf(rule('high').alternateSources[0].text).includes(hp.heightMin));
  const slide14 = SLIDES_MD.split(/^## สไลด์ 14\s*$/m)[1].split(/^## สไลด์ 15/m)[0];
  assert.ok(slide14.includes('23 เมตร'));
});
test('ตัวเลขในข้อความของผลตรงกับตัวเลขในข้อมูลกฎ (เกณฑ์) และค่าที่วัดได้', () => {
  const lp = rule('large').params, hp = rule('high').params;
  const rs = classifyBuilding(bld({ floors: 5, floorHeight: 3, area: 300 }));
  const nums = (id) => digitsOf(byId(rs, id).message);
  assert.ok(nums('large-by-area').includes(lp.areaOverAlways) && nums('large-by-area').includes(1500));
  for (const v of [lp.heightMin, lp.areaOverWithHeight, lp.areaMaxWithHeight, 15, 1500]) assert.ok(nums('large-by-height').includes(v), `large-by-height: ไม่มี ${v}`);
  assert.ok(nums('high').includes(hp.heightMin) && nums('high').includes(15));
  assert.ok(byId(rs, 'large').message.includes('เป็นอาคารขนาดใหญ่'));
  assert.ok(byId(classifyBuilding(bld({ floors: 1, area: 10 })), 'large').message.includes('ยังไม่เป็น'));
});
test('ชื่อผลในหน้าใช้เลขจากข้อมูลกฎ ไม่ใช่เลขที่พิมพ์ตาย', () => {
  const lp = rule('large').params;
  const rs = classifyBuilding(bld());
  assert.ok(byId(rs, 'large-by-area').title.includes(lp.areaOverAlways.toLocaleString('en-US')));
  assert.ok(byId(rs, 'high').title.includes(String(rule('high').params.heightMin)));
});

// ---------------------------------------------------------------- เนื้อหาจุดที่ต้องตรวจ
test('กฎ needs-review (อ่านอย่างเดียว) มีที่มา เลขสไลด์ และหมายเหตุ · กฎ inScene ไม่ใช่ needs-review', () => {
  for (const r of RULES) {
    assert.ok(r.source?.law && r.source?.clause && r.source?.text);
    assert.ok(r.slides.length > 0 && r.reviewNote.length > 20);
    if (r.status === 'needs-review') assert.equal(r.inScene, false, r.id);
  }
  assert.ok(RULES.some((r) => r.id === 'rooftop-deck-counting' && r.status === 'needs-review'));
});
