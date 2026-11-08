// นิยามขั้นของบทตัวอย่าง "ระยะร่นและที่ว่างรอบอาคาร" — เป็นข้อมูลล้วน
// ตัวเลขของกฎในคำอธิบายดึงจาก RULES (params) ทั้งหมด ห้ามพิมพ์เลขกฎลงในข้อความตรงๆ
//
// ขั้น = { id, title, explain, focusRuleId, showRules, sliders, initial, slides }
//   focusRuleId : กฎที่เน้นในฉาก (null = ไม่เน้นข้อใดข้อหนึ่ง)
//   showRules   : [id,...] กฎที่แสดงผล/วาดในฉากในขั้นนี้ · 'all' = ทุกกฎ
//   sliders     : คีย์ตัวเลื่อน (นิยามช่วงค่าอยู่ใน main.js)
//   initial     : SceneParams บางส่วน ที่ตั้งเมื่อเข้าขั้น · null = คงค่าที่ผู้เรียนปรับไว้
//   slides      : เลขสไลด์ต้นฉบับ
import { RULES } from '../rules/setback-rules.js';

const P = (id) => RULES.find((r) => r.id === id).params;
const canal = P('canal-setback');
const wall = P('wall-opening-distance');
const open = P('open-area-residential');
const slidesOf = (id) => RULES.find((r) => r.id === id).slides;
// ค่าตั้งต้นที่ "ใกล้เกณฑ์" เพื่อให้เห็นเส้นกระโดดเมื่อเลื่อนผ่านเกณฑ์: ต่ำกว่าเกณฑ์ครึ่งเมตร
const JUST_BELOW = 0.5;

export const STEPS = [
  {
    id: 'intro',
    title: 'แนะนำฉาก',
    explain: 'ฉากนี้คือที่ดินแปลงหนึ่ง ด้านหน้าติดถนน ด้านหลังติดคลอง ก้อนสีส้มคืออาคารหลักที่เราจะเลื่อนปรับขนาดและตำแหน่ง ส่วนตึกแถวและต้นไม้รอบๆ เป็นแค่ฉากประกอบ ลองลากหมุนดู หรือกดปุ่ม "มองจากด้านบน" เพื่ออ่านระยะเป็นเมตร แล้วกด "ถัดไป" เพื่อดูกฎทีละข้อ',
    focusRuleId: null,
    showRules: [],
    sliders: [],
    initial: {},
    slides: [52],
  },
  {
    id: 'canal',
    title: 'ร่นจากคลอง',
    explain: `อาคารที่สร้างใกล้คลอง ต้องร่นแนวอาคารให้ห่างจากเขตคลอง คลองแคบ (กว้างน้อยกว่า ${canal.canalWidthThreshold} ม.) ร่น ${canal.setbackNarrow} ม. ส่วนคลองกว้าง (${canal.canalWidthThreshold} ม. ขึ้นไป) ร่น ${canal.setbackWide} ม. ลองเลื่อนความกว้างคลองจาก ${canal.canalWidthThreshold - JUST_BELOW} ม. ไปเป็น ${canal.canalWidthThreshold} ม. แล้วดูเส้นร่นกระโดดจาก ${canal.setbackNarrow} ม. เป็น ${canal.setbackWide} ม. ส่วนตำแหน่ง z คือระยะที่อาคารห่างจากถนน เลื่อนแล้วจะเห็นอาคารล้ำเข้าแถบร่นหรือไม่`,
    focusRuleId: 'canal-setback',
    showRules: ['canal-setback'],
    sliders: ['canal', 'bz'],
    initial: { canal: { width: canal.canalWidthThreshold - JUST_BELOW }, building: { z: 14 } },
    slides: slidesOf('canal-setback'),
  },
  {
    id: 'wall',
    title: 'ผนังมีช่องเปิดห่างเขตที่ดิน',
    explain: `ผนังที่มีหน้าต่าง ประตู หรือช่องระบายอากาศ ต้องอยู่ห่างเขตที่ดินข้างเคียง อาคารสูงไม่เกิน ${wall.lowMaxHeight} ม. ห่าง ${wall.lowSetback} ม. ถ้าสูงเกิน ${wall.lowMaxHeight} ม. แต่ไม่ถึง ${wall.midUpperExclusive} ม. ต้องห่าง ${wall.midSetback} ม. ลองเลื่อนความสูงข้าม ${wall.lowMaxHeight} ม. แล้วดูเส้นกระโดดจาก ${wall.lowSetback} ม. เป็น ${wall.midSetback} ม. (ฉากนี้สมมติว่าผนังทุกด้านมีช่องเปิด)`,
    focusRuleId: 'wall-opening-distance',
    showRules: ['wall-opening-distance'],
    sliders: ['height', 'bx', 'bw'],
    initial: { building: { x: 2.5, width: 11, z: 14, depth: 12, height: wall.lowMaxHeight - JUST_BELOW } },
    slides: slidesOf('wall-opening-distance'),
  },
  {
    id: 'open',
    title: 'ที่ว่างของอาคารพักอาศัย',
    explain: `อาคารพักอาศัยต้องมีที่ว่าง (พื้นที่ที่ไม่มีหลังคาหรือสิ่งก่อสร้างปิด) อย่างน้อย ${open.minPercent}% ลองขยายความกว้างและความลึกของอาคารจนที่ว่างต่ำกว่าเกณฑ์ ข้อควรระวัง: ตัวบทแต่ละฉบับเขียนไม่ตรงกันว่า ${open.minPercent}% นี้นับเทียบกับ "พื้นที่ที่ดิน" หรือ "พื้นที่ชั้นที่ใหญ่ที่สุดของอาคาร" อาคารพักอาศัยต้องผ่านทั้งสองแบบ จึงแสดงผลทั้งสองแบบไว้`,
    focusRuleId: 'open-area-residential',
    showRules: ['open-area-residential'],
    sliders: ['bw', 'bd'],
    initial: { building: { x: 2.5, z: 5, width: 11, depth: 20, height: 7 } },
    slides: slidesOf('open-area-residential'),
  },
  {
    id: 'all',
    title: 'ลองทุกค่า',
    explain: 'ปรับได้ทุกค่าพร้อมกัน แล้วดูว่าอาคารหลักผ่านทุกกฎหรือไม่ กดที่กฎในรายการผลเพื่อเน้นเฉพาะข้อนั้นในฉาก (กดซ้ำเพื่อยกเลิก) ตัวเลขที่มีป้าย "จุดที่ต้องตรวจ" ยังไม่ยืนยันกับตัวบท',
    focusRuleId: null,
    showRules: 'all',
    sliders: ['canal', 'height', 'bz', 'bx', 'bw', 'bd'],
    initial: null,
    slides: [...new Set([52, ...slidesOf('open-area-residential'), ...slidesOf('wall-opening-distance'), ...slidesOf('canal-setback')])].sort((a, b) => a - b),
  },
];
