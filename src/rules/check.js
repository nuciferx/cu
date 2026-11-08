// ตัวตรวจกฎ — รับค่าฉาก คืนผลรายกฎ · ไม่รู้จักภาพหรือหน้าจอเลย
// ตัวเลขของกฎอยู่ใน setback-rules.js ที่เดียว (อ่านผ่าน rule.params) — ไฟล์นี้มีแต่ตรรกะ
//
// SceneParams (หน่วยเมตร · x = ความกว้างที่ดินตามแนวถนน, z = ความลึกจากถนนไปคลอง)
//   lot: { width, depth }  ·  road: { width }  ·  canal: { width } | null
//   building: { x, z, width, depth, floors, height, use: 'residential' | 'other' }
//
// ระยะวัดจากขอบอาคารถึงเขต: เขตคลอง = ขอบหลังที่ดิน (z = lot.depth), เขตถนน = ขอบหน้า (z = 0)

import { RULES } from './setback-rules.js';

/** ค่าคลาดเคลื่อนทศนิยม (float) ที่ยอมให้ตอนเทียบกับเกณฑ์ */
export const EPS = 1e-9;

const atLeast = (actual, required) => actual + EPS >= required;

/** ตัวเลขสั้นๆ สำหรับข้อความ: 6 → "6", 4.5 → "4.5", 4.4999999 → "4.5" */
const fmt = (n) => String(Number(Number(n).toFixed(2)));

/** ระยะจากขอบอาคารถึงแต่ละเขตที่ดิน */
function gaps({ lot, building: b }) {
  return {
    'boundary-left': b.x,
    'boundary-right': lot.width - (b.x + b.width),
    road: b.z,
    'boundary-back': lot.depth - (b.z + b.depth),
  };
}

function base(rule) {
  return {
    id: rule.id,
    title: rule.title,
    pass: null,
    required: null,
    actual: null,
    unit: 'm',
    message: '',
    source: rule.source,
    slides: rule.slides,
    needsReview: rule.status === 'needs-review',
    geometry: null,
  };
}

function notApplicable(rule, why) {
  return { ...base(rule), message: `ใช้ไม่ได้กับฉากนี้ · ${why}` };
}

// ---------- ร่นแนวอาคารจากคลอง (ข้อ 42) ----------
function canalSetback(rule, scene) {
  const { canal } = scene;
  if (!canal) return notApplicable(rule, 'ไม่มีคลอง');
  const p = rule.params;
  const wide = !(canal.width < p.canalWidthThreshold - EPS); // 10 ม. พอดี = กว้าง
  const required = wide ? p.setbackWide : p.setbackNarrow;
  const actual = gaps(scene)['boundary-back'];
  const pass = atLeast(actual, required);
  return {
    ...base(rule),
    pass,
    required,
    actual,
    message: `ต้องการ ${fmt(required)} ม. · มีอยู่ ${fmt(actual)} ม. (คลองกว้าง ${fmt(canal.width)} ม.)`,
    geometry: { kind: 'setbackLine', from: 'canal', distance: required },
  };
}

// ---------- ผนังมีช่องเปิดถึงเขตที่ดินข้างเคียง (ข้อ 50 วรรคหนึ่ง) ----------
// สมมติว่าผนังทุกด้านที่หันเข้าหาที่ดินข้างเคียงมีช่องเปิด (ฉากไม่มีข้อมูลช่องเปิด)
function wallOpeningDistance(rule, scene) {
  const p = rule.params;
  const h = scene.building.height;
  let required;
  if (h <= p.lowMaxHeight + EPS) required = p.lowSetback;
  else if (h < p.midUpperExclusive - EPS) required = p.midSetback;
  else return notApplicable(rule, `สูง ${fmt(h)} ม. — ข้อ 50 ไม่กำหนดสำหรับอาคารสูง ${fmt(p.midUpperExclusive)} ม. ขึ้นไป`);

  const g = gaps(scene);
  // ด้านที่เป็นเขตที่ดินข้างเคียง: ซ้าย ขวา และหลัง (ถ้าไม่มีคลอง) · ด้านถนนและด้านคลองใช้กฎอื่น
  const sides = ['boundary-left', 'boundary-right'];
  if (!scene.canal) sides.push('boundary-back');
  let from = sides[0];
  for (const s of sides) if (g[s] < g[from]) from = s;
  const actual = g[from];
  return {
    ...base(rule),
    pass: atLeast(actual, required),
    required,
    actual,
    message: `ต้องการ ${fmt(required)} ม. · มีอยู่ ${fmt(actual)} ม. (ด้านที่ใกล้เขตที่สุด)`,
    geometry: { kind: 'setbackLine', from, distance: required },
  };
}

// ---------- ที่ว่างอาคารพักอาศัย ----------
// เจ้าของงานตัดสิน 8 พ.ย. 2569: ต้องผ่านทั้งสองแบบ → pass = A && B
//   แบบ A: ข้อบัญญัติ กทม. 2544 ข้อ 52 (1) — ที่ว่าง >= 30% ของพื้นที่ที่ดิน (required/actual ของผลหลัก)
//   แบบ B: กฎกระทรวง ฉบับที่ 55 ข้อ 33 (1) — ที่ว่าง >= 30% ของพื้นที่ชั้นที่ใหญ่ที่สุด (alt)
//   ฉากอาคารเป็นกล่อง ทุกชั้นเท่ากัน = กว้าง×ลึก · ที่ว่าง = พื้นที่ที่ดิน − พื้นที่ฐานอาคาร
function openAreaResidential(rule, scene) {
  const { lot, building: b } = scene;
  if (b.use !== 'residential') {
    return { ...notApplicable(rule, 'สไลด์ 53 ระบุเฉพาะอาคารพักอาศัย'), unit: '%' };
  }
  const p = rule.params;
  const lotArea = lot.width * lot.depth;
  const footprint = b.width * b.depth;
  const ratio = Math.max(0, (lotArea - footprint) / lotArea); // 0..1
  const actual = ratio * 100;
  const passA = atLeast(actual, p.minPercent);

  // แบบ B: เทียบกับพื้นที่ชั้นที่ใหญ่ที่สุดของอาคาร (ฉากไม่มีพื้นที่แต่ละชั้น จึงถือชั้นใหญ่สุด = พื้นที่ฐานอาคาร)
  const altRequiredArea = (p.minPercent / 100) * footprint;
  const altActualArea = Math.max(0, lotArea - footprint);
  const passB = atLeast(altActualArea, altRequiredArea);
  const word = (ok) => (ok ? 'ผ่าน' : 'ไม่ผ่าน');
  return {
    ...base(rule),
    unit: '%',
    pass: passA && passB,
    required: p.minPercent,
    actual,
    message:
      `ต้องผ่านทั้งสองแบบ · A (ข้อบัญญัติ กทม. ข้อ 52(1) เทียบที่ดิน): ต้องการ ${fmt(p.minPercent)}% · มีอยู่ ${fmt(actual)}% ${word(passA)}` +
      ` · B (ฉบับที่ 55 ข้อ 33(1) เทียบชั้นใหญ่สุด): ต้องการ ${fmt(altRequiredArea)} ตร.ม. · มีอยู่ ${fmt(altActualArea)} ตร.ม. ${word(passB)}`,
    geometry: { kind: 'openArea', ratio },
    alt: {
      basis: 'largestFloor',
      law: 'กฎกระทรวง ฉบับที่ 55 ข้อ 33 (1)',
      requiredArea: altRequiredArea,
      actualArea: altActualArea,
      pass: passB,
    },
  };
}

const EVALUATORS = {
  'canal-setback': canalSetback,
  'wall-opening-distance': wallOpeningDistance,
  'open-area-residential': openAreaResidential,
};

/**
 * ตรวจฉากกับกฎที่ตรวจในฉากได้ (inScene === true) · กฎที่ inScene:false ไม่คืนผล (เป็นเนื้อหาอ่านอย่างเดียว)
 * @param {object} scene SceneParams
 * @param {import('./setback-rules.js').Rule[]} [rules]
 * @returns {object[]} RuleResult[]
 */
export function checkRules(scene, rules = RULES) {
  const out = [];
  for (const rule of rules) {
    if (!rule.inScene) continue;
    const fn = EVALUATORS[rule.id];
    out.push(fn ? fn(rule, scene) : notApplicable(rule, 'ยังไม่มีตัวตรวจสำหรับกฎนี้'));
  }
  return out;
}
