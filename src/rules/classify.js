// ตัวจำแนกอาคารขนาดใหญ่ / อาคารสูง — รับขนาดอาคาร คืนผลรายเกณฑ์ · ไม่รู้จักภาพหรือหน้าจอเลย
// ตัวเลขของกฎอยู่ใน building-class-rules.js ที่เดียว (อ่านผ่าน rule.params) — ไฟล์นี้มีแต่ตรรกะ
//
// BuildingParams (หน่วยเมตร / ตารางเมตร)
//   floors        จำนวนชั้นเหนือพื้นดิน (ใช้เมื่อไม่ใส่ floorAreas)
//   floorHeight   ความสูงต่อชั้น (ม.) — ความสูงอาคาร = floors × floorHeight
//   footprint     { width, depth } พื้นต่อชั้น (ทุกชั้นเท่ากัน) ใช้เมื่อไม่ใส่ floorAreas
//   floorAreas?   พื้นที่แต่ละชั้น (ตร.ม.) ใช้แทน footprint ได้ เช่น [450,450,450,300,200] · ความยาวของอาร์เรย์ = จำนวนชั้น
//   roof          { type: 'flat' | 'gable', ridgeHeight? }
//                 flat = มีพื้นดาดฟ้า วัดความสูงถึงพื้นดาดฟ้า · gable = หลังคาทรงจั่ว/ปั้นหยา วัดถึงยอดผนังของชั้นสูงสุด
//                 (ridgeHeight = ส่วนที่ยอดหลังคาสูงเหนือยอดผนัง ใช้วาดอย่างเดียว ไม่เข้าการวัด)
//   roofDeckArea? พื้นที่พื้นดาดฟ้า (ตร.ม.) · มีเฉพาะหลังคา flat
//   countRoofDeck? true = นับพื้นที่ดาดฟ้าเข้าพื้นที่รวม (แบบสไลด์ 12) · false (ค่าตั้งต้น) = ไม่นับ (แบบกฎกระทรวงฉบับที่ 33 ข้อ 1)
//                 ตัวบทกับสไลด์ไม่ตรงกัน = จุดที่ต้องตรวจ ดูกฎ rooftop-deck-counting

import { RULES, ruleById } from './building-class-rules.js';

/** ปัดเมตร → เซนติเมตร (จำนวนเต็ม) กันเลขทศนิยมคลาด เช่น 5 × 2.98 */
const cm = (m) => Math.round(m * 100);
/** ปัดตร.ม. → หน่วย 0.01 ตร.ม. (จำนวนเต็ม) */
const a100 = (a) => Math.round(a * 100);

/** ตัวเลขสั้นๆ ในข้อความ: 14.9 → "14.9" · 1850 → "1,850" · 15 → "15" */
export const fmt = (n) => Number(Number(n).toFixed(2)).toLocaleString('en-US');
/** ความสูงเป็นเมตร 2 ตำแหน่งเสมอ เหมือนที่ตัวบทเขียน: 15 → "15.00" · 14.9 → "14.90" */
export const fmtM = (n) => Number(n).toFixed(2);

function base(rule, id, title) {
  return {
    id, title,
    is: false,
    required: null, actual: null, unit: '',
    message: '',
    source: rule.source,
    slides: rule.slides,
    needsReview: rule.status === 'needs-review',
    geometry: null,
  };
}

/** ค่าที่วัดได้จากอาคาร (ไม่ตัดสินอะไร) */
export function measure(p) {
  const areas = Array.isArray(p.floorAreas) && p.floorAreas.length
    ? p.floorAreas.map((a) => Math.max(0, +a || 0))
    : Array.from({ length: Math.max(1, Math.floor(p.floors || 1)) }, () => Math.max(0, p.footprint.width * p.footprint.depth));
  const floors = areas.length;
  const roofType = p.roof?.type === 'gable' ? 'gable' : 'flat';
  const deckArea = roofType === 'flat' ? Math.max(0, p.roofDeckArea || 0) : 0;
  const floorsTotal = areas.reduce((s, a) => s + a, 0);
  const countDeck = !!p.countRoofDeck && deckArea > 0;
  const height = floors * p.floorHeight; // ถึงพื้นดาดฟ้า (flat) หรือยอดผนังชั้นสูงสุด (gable) — ไม่รวมยอดจั่ว
  return {
    areas, floors, roofType, deckArea, floorsTotal,
    maxFloor: Math.max(...areas),
    total: floorsTotal + (countDeck ? deckArea : 0),
    totalWithDeck: floorsTotal + deckArea,
    totalWithoutDeck: floorsTotal,
    countDeck,
    height,
    measuredTo: roofType === 'gable' ? 'top-of-wall' : 'roof-deck',
  };
}

const overAlways = (m, rp) => a100(m.total) > a100(rp.areaOverAlways) || a100(m.maxFloor) > a100(rp.areaOverAlways);
const overWithHeight = (m, rp, total = m.total) =>
  cm(m.height) >= cm(rp.heightMin) && a100(total) > a100(rp.areaOverWithHeight) && a100(total) <= a100(rp.areaMaxWithHeight);
const isLarge = (m, rp, total = m.total) => a100(total) > a100(rp.areaOverAlways) || overWithHeight(m, rp, total);

/** ชั้นแรกที่ทำให้พื้นที่สะสมเกินเกณฑ์ (0 เริ่มที่ชั้น 1) · 'deck' = ดาดฟ้าเป็นตัวทำให้เกิน · null = ไม่เกิน */
function crossingFloor(m, limit) {
  let sum = 0;
  for (let i = 0; i < m.areas.length; i++) {
    sum += m.areas[i];
    if (a100(sum) > a100(limit)) return i;
  }
  if (m.countDeck && a100(sum + m.deckArea) > a100(limit)) return 'deck';
  return null;
}

/**
 * @param {object} params BuildingParams
 * @param {import('./building-class-rules.js').Rule[]} [rules]
 * @returns {object[]} Result[] : large-by-area · large-by-height · large (สรุป) · high
 */
export function classifyBuilding(params, rules = RULES) {
  const m = measure(params);
  const large = rules.find((r) => r.id === 'large');
  const high = rules.find((r) => r.id === 'high');
  const lp = large.params, hp = high.params;
  const out = [];

  // ---------- อาคารขนาดใหญ่ ข้อ 1: พื้นที่รวมเกิน 2,000 ----------
  // "พื้นที่รวมกันทุกชั้น หรือ ชั้นหนึ่งชั้นใด" — พื้นที่ชั้นเดียวไม่เคยเกินพื้นที่รวม จึงไม่ทำให้ผลต่าง แต่เช็กทั้งสองตามถ้อยคำ
  const byArea = overAlways(m, lp);
  const aWith = isLarge(m, lp, m.totalWithDeck), aWithout = isLarge(m, lp, m.totalWithoutDeck);
  const deckFlag = m.deckArea > 0; // มีดาดฟ้า = ตัวบทกับสไลด์ต่างกันว่านับหรือไม่ → จุดที่ต้องตรวจ
  out.push({
    ...base(large, 'large-by-area', `พื้นที่รวมทุกชั้นเกิน ${fmt(lp.areaOverAlways)} ตร.ม.`),
    is: byArea, required: lp.areaOverAlways, actual: m.total, unit: 'ตร.ม.',
    message: `ต้องการเกิน ${fmt(lp.areaOverAlways)} ตร.ม. · พื้นที่รวม ${fmt(m.total)} ตร.ม. (${m.floors} ชั้น${m.countDeck ? ` + ดาดฟ้า ${fmt(m.deckArea)}` : ''}) → ${byArea ? 'เกิน' : 'ยังไม่เกิน'}`,
    needsReview: deckFlag,
    reviewNote: deckFlag ? ruleById('rooftop-deck-counting').reviewShort : '',
    geometry: { kind: 'area', areas: m.areas, deckArea: m.deckArea, countDeck: m.countDeck, limit: lp.areaOverAlways, crossing: crossingFloor(m, lp.areaOverAlways) },
    alt: { withDeck: m.totalWithDeck, withoutDeck: m.totalWithoutDeck, large: { withDeck: aWith, withoutDeck: aWithout }, differs: aWith !== aWithout },
  });

  // ---------- อาคารขนาดใหญ่ ข้อ 2: สูงตั้งแต่ 15.00 ม. และพื้นที่เกิน 1,000 แต่ไม่เกิน 2,000 ----------
  const heightOk = cm(m.height) >= cm(lp.heightMin);
  const areaBand = a100(m.total) > a100(lp.areaOverWithHeight) && a100(m.total) <= a100(lp.areaMaxWithHeight);
  const byHeight = heightOk && areaBand;
  out.push({
    ...base(large, 'large-by-height', `สูงตั้งแต่ ${fmtM(lp.heightMin)} ม. และพื้นที่ ${fmt(lp.areaOverWithHeight)}–${fmt(lp.areaMaxWithHeight)} ตร.ม.`),
    is: byHeight, required: lp.heightMin, actual: m.height, unit: 'ม.',
    message: `ความสูง ${fmtM(m.height)} ม. (ต้องการตั้งแต่ ${fmtM(lp.heightMin)} ม. ขึ้นไป → ${heightOk ? 'ถึง' : 'ไม่ถึง'}) · พื้นที่รวม ${fmt(m.total)} ตร.ม. (ต้องเกิน ${fmt(lp.areaOverWithHeight)} แต่ไม่เกิน ${fmt(lp.areaMaxWithHeight)} ตร.ม. → ${areaBand ? 'อยู่ในช่วง' : 'ไม่อยู่ในช่วง'}) → ${byHeight ? 'เข้าเกณฑ์ข้อนี้' : 'ไม่เข้าเกณฑ์ข้อนี้'}`,
    needsReview: deckFlag,
    reviewNote: deckFlag ? ruleById('rooftop-deck-counting').reviewShort : '',
    geometry: { kind: 'height', level: lp.heightMin, measured: m.height, measuredTo: m.measuredTo, areaTotal: m.total, areaMin: lp.areaOverWithHeight, areaMax: lp.areaMaxWithHeight },
    parts: { heightOk, areaBand },
  });

  // ---------- สรุป: เป็นอาคารขนาดใหญ่ไหม ----------
  const isL = byArea || byHeight;
  out.push({
    ...base(large, 'large', 'เป็นอาคารขนาดใหญ่'),
    is: isL, required: null, actual: null, unit: '',
    message: isL
      ? `เป็นอาคารขนาดใหญ่ — เข้าเกณฑ์ ${byArea ? 'ข้อ 1 (พื้นที่รวมเกิน ' + fmt(lp.areaOverAlways) + ' ตร.ม.)' : ''}${byArea && byHeight ? ' และ ' : ''}${byHeight ? 'ข้อ 2 (สูง ≥ ' + fmtM(lp.heightMin) + ' ม. และพื้นที่ ' + fmt(lp.areaOverWithHeight) + '–' + fmt(lp.areaMaxWithHeight) + ' ตร.ม.)' : ''}`
      : `ยังไม่เป็นอาคารขนาดใหญ่ — ไม่เข้าทั้งข้อ 1 และข้อ 2`,
    needsReview: deckFlag && aWith !== aWithout, // ถ้านับ/ไม่นับดาดฟ้าแล้วผลสรุปต่างกัน = ผลขึ้นกับข้อที่ยังไม่ตัดสิน
    reviewNote: deckFlag && aWith !== aWithout ? `ถ้านับดาดฟ้า (แบบสไลด์ 12) ผลคือ "${aWith ? 'เป็น' : 'ไม่เป็น'}" · ถ้าไม่นับ (แบบกฎกระทรวงฉบับที่ 33 ข้อ 1) ผลคือ "${aWithout ? 'เป็น' : 'ไม่เป็น'}" — ${ruleById('rooftop-deck-counting').title}` : '',
    geometry: { kind: 'summary' },
    alt: { withDeck: aWith, withoutDeck: aWithout, differs: aWith !== aWithout },
  });

  // ---------- อาคารสูง ----------
  const isH = cm(m.height) >= cm(hp.heightMin);
  out.push({
    ...base(high, 'high', `เป็นอาคารสูง (สูงตั้งแต่ ${fmtM(hp.heightMin)} ม.)`),
    is: isH, required: hp.heightMin, actual: m.height, unit: 'ม.',
    message: `ความสูง ${fmtM(m.height)} ม. (วัดถึง${m.measuredTo === 'top-of-wall' ? 'ยอดผนังของชั้นสูงสุด' : 'พื้นดาดฟ้า'}) · ต้องการตั้งแต่ ${fmtM(hp.heightMin)} ม. ขึ้นไป → ${isH ? 'เป็นอาคารสูง' : 'ยังไม่เป็นอาคารสูง'}`,
    geometry: { kind: 'height', level: hp.heightMin, measured: m.height, measuredTo: m.measuredTo },
  });

  return out;
}
