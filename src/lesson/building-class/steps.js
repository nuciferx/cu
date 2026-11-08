// นิยามขั้นของบท "อาคารขนาดใหญ่ · อาคารสูง" (สไลด์ 12, 14) — เป็นข้อมูลล้วน
// ตัวเลขของกฎในคำอธิบายดึงจาก RULES (params) ทั้งหมด ห้ามพิมพ์เลขกฎลงในข้อความตรงๆ · ตัวเลขตัวอย่างจากภาพสไลด์ดึงจาก src/content/lesson02.js
//
// ขั้น = { id, title, explain, showRules, controls, initial, colorBy, roofStructures, meters, slides }
//   showRules : id ของผลจาก classifyBuilding ที่แสดง (และวาดเส้นเกณฑ์ในฉาก) · 'all' = ทุกผล
//   controls  : ตัวปรับค่าที่ขั้นนี้ให้ใช้ (นิยามอยู่ใน main.js)
//   initial   : ค่าตั้งต้นของขั้น (คีย์ของ state ใน main.js) · null = คงค่าที่ผู้เรียนปรับไว้
//   colorBy   : 'area' ระบายสีชั้นตามการนับพื้นที่ · 'height' สีกลางๆ เน้นเส้นวัดความสูง
//   meters    : ตัวนับที่แสดง 'area' | 'height'
import { RULES } from '../../rules/building-class-rules.js';
import { fmt, fmtM } from '../../rules/classify.js';
import { SLIDE12, SLIDE14 } from '../../content/lesson02.js';

const lp = RULES.find((r) => r.id === 'large').params;
const hp = RULES.find((r) => r.id === 'high').params;
const slidesOf = (id) => RULES.find((r) => r.id === id).slides;
const areaSum = SLIDE12.floorAreas.join(' + ');

// ค่าตั้งต้น "ใกล้เกณฑ์" เพื่อให้เห็นผลพลิกเมื่อเลื่อนผ่านเกณฑ์
const FLOORS_2 = 5;
const FLOOR_H_2 = 2.9; // 5 × 2.9 = 14.5 ม. — ต่ำกว่าเกณฑ์ความสูงอาคารขนาดใหญ่ครึ่งเมตร
const PREFIX = { floors: 5, floorH: FLOOR_H_2, bw: 20, bd: 15, deck: 0, countDeck: false, roofType: 'flat', ridge: 4, preset: false };

export const STEPS = [
  {
    id: 'large-area',
    title: 'อาคารขนาดใหญ่ (1): พื้นที่รวมทุกชั้น',
    explain: `อาคารที่มีพื้นที่รวมกันทุกชั้นเกิน ${fmt(lp.areaOverAlways)} ตร.ม. เป็นอาคารขนาดใหญ่ ฉากแรกคือตัวอย่างในสไลด์ 12: ชั้นละ ${areaSum} ตร.ม. (กันสาดไม่นับ) บวกดาดฟ้า ${fmt(SLIDE12.roofDeckArea)} ตร.ม. สไลด์รวมดาดฟ้าด้วยได้ ${fmt(SLIDE12.total)} ตร.ม. แต่ตัวบทของกฎกระทรวงฉบับที่ 33 บอกว่าพื้นที่อาคารไม่รวมพื้นดาดฟ้า (ได้ ${fmt(SLIDE12.total - SLIDE12.roofDeckArea)} ตร.ม.) จึงมีป้าย "จุดที่ต้องตรวจ" ลองเลื่อนพื้นที่ดาดฟ้า และกดนับ/ไม่นับดาดฟ้า ดูตัวนับวิ่งผ่านเส้น ${fmt(lp.areaOverAlways)} ตร.ม. หรือเลื่อนจำนวนชั้นกับขนาดพื้น (จะเปลี่ยนเป็นทุกชั้นเท่ากัน)`,
    showRules: ['large', 'large-by-area', 'large-by-height'],
    controls: ['preset', 'floors', 'bw', 'bd', 'deck', 'countDeck'],
    initial: { floors: SLIDE12.floorAreas.length, floorH: SLIDE12.height / SLIDE12.floorAreas.length, bw: SLIDE12.floorAreas[0] / SLIDE12.depth, bd: SLIDE12.depth, deck: SLIDE12.roofDeckArea, countDeck: false, roofType: 'flat', ridge: 4, preset: true },
    colorBy: 'area',
    roofStructures: false,
    meters: ['area'],
    slides: slidesOf('large'),
  },
  {
    id: 'large-height',
    title: 'อาคารขนาดใหญ่ (2): สูงตั้งแต่เกณฑ์ และพื้นที่ปานกลาง',
    explain: `อีกทางหนึ่ง: ถ้าอาคารสูงตั้งแต่ ${fmtM(lp.heightMin)} ม. ขึ้นไป และมีพื้นที่รวมเกิน ${fmt(lp.areaOverWithHeight)} แต่ไม่เกิน ${fmt(lp.areaMaxWithHeight)} ตร.ม. ก็เป็นอาคารขนาดใหญ่ ฉากนี้พื้นที่รวม ${fmt(PREFIX.bw * PREFIX.bd * FLOORS_2)} ตร.ม. สูง ${fmtM(FLOORS_2 * FLOOR_H_2)} ม. (ต่ำกว่าเกณฑ์) ลองเลื่อนความสูงต่อชั้นจาก ${fmtM(FLOOR_H_2)} ไปเป็น ${fmtM(lp.heightMin / FLOORS_2)} ม. ให้สูงรวมถึง ${fmtM(lp.heightMin)} ม. แล้วดูเส้นเกณฑ์สีแดงลอยในฉากกับป้ายพลิกเป็น "เป็น" ลองลดพื้นที่ลงต่ำกว่า ${fmt(lp.areaOverWithHeight)} ตร.ม. ดูว่าป้ายกลับเป็น "ยังไม่เป็น" ได้อีก`,
    showRules: ['large', 'large-by-area', 'large-by-height'],
    controls: ['floors', 'floorH', 'bw', 'bd'],
    initial: { ...PREFIX },
    colorBy: 'height',
    roofStructures: false,
    meters: ['area', 'height'],
    slides: slidesOf('large'),
  },
  {
    id: 'measure',
    title: 'วิธีวัดความสูง: หลังคาแบน กับหลังคาจั่ว',
    explain: `ตัวบทกำหนดวิธีวัดความสูงของอาคารขนาดใหญ่และอาคารสูงเหมือนกัน: วัดจากระดับพื้นดินที่ก่อสร้างถึงพื้นดาดฟ้า ส่วนอาคารทรงจั่วหรือปั้นหยาให้วัดถึงยอดผนังของชั้นสูงสุด (ไม่ใช่ยอดหลังคา) ฉากนี้เป็นหลังคาจั่ว ยอดจั่วสูงเหนือยอดผนัง ${PREFIX.ridge} ม. แต่เส้นวัดสีน้ำเงินหยุดที่ยอดผนัง ลองเลื่อนความสูงของยอดจั่วขึ้นลง ตัวเลขความสูงไม่เปลี่ยน แล้วสลับเป็นหลังคาแบนเพื่อเทียบ`,
    showRules: ['large-by-height', 'high'],
    controls: ['roofType', 'ridge', 'floors', 'floorH'],
    initial: { ...PREFIX, floorH: 2.98, roofType: 'gable', ridge: PREFIX.ridge },
    colorBy: 'height',
    roofStructures: false,
    meters: ['height'],
    slides: [...new Set([...slidesOf('large'), ...slidesOf('high')])].sort((a, b) => a - b),
  },
  {
    id: 'high',
    title: 'อาคารสูง: สูงตั้งแต่เกณฑ์ขึ้นไป',
    explain: `อาคารสูงคืออาคารที่สูงตั้งแต่ ${fmtM(hp.heightMin)} ม. ขึ้นไป วัดจากพื้นดินที่ก่อสร้างถึงพื้นดาดฟ้า ภาพสไลด์ 14 เป็นอาคาร ${SLIDE14.floors} ชั้น สูง ${fmtM(SLIDE14.height)} ม. (ยังไม่ถึง ${fmtM(hp.heightMin)} ม.) มีห้องเครื่องลิฟต์และถังน้ำอยู่บนดาดฟ้า ลองเพิ่มความสูงต่อชั้นหรือเพิ่มชั้นให้ผ่านเส้นเกณฑ์สีแดง ตัวบทวัดถึงพื้นดาดฟ้า ไม่ได้พูดถึงสิ่งที่ตั้งเหนือพื้นดาดฟ้า (จุดที่ต้องตรวจ)`,
    showRules: ['high'],
    controls: ['floors', 'floorH', 'roofType', 'ridge'],
    initial: { ...PREFIX, floors: SLIDE14.floors, floorH: SLIDE14.height / SLIDE14.floors, bw: 20, bd: 15, roofType: 'flat' },
    colorBy: 'height',
    roofStructures: true,
    meters: ['height'],
    slides: slidesOf('high'),
  },
  {
    id: 'all',
    title: 'ลองทั้งสองเรื่อง',
    explain: 'ปรับได้ทุกค่าพร้อมกัน ดูว่าอาคารหลังนี้เป็นอาคารขนาดใหญ่หรือไม่ และเป็นอาคารสูงหรือไม่ — เป็นได้ทั้งสองอย่าง หรือเป็นอย่างเดียว หรือไม่เป็นเลย ตัวเลขที่มีป้าย "จุดที่ต้องตรวจ" ยังไม่ยืนยันกับตัวบท',
    showRules: 'all',
    controls: ['floors', 'floorH', 'bw', 'bd', 'roofType', 'ridge', 'deck', 'countDeck'],
    initial: null,
    colorBy: 'area',
    roofStructures: true,
    meters: ['area', 'height'],
    slides: [...new Set([...slidesOf('large'), ...slidesOf('high')])].sort((a, b) => a - b),
  },
];
