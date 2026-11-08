// ฉากของบท "อาคารขนาดใหญ่ · อาคารสูง": พื้นเรียบ + อาคารหลังเดียวแยกชั้น + เส้นวัดความสูง + เส้นเกณฑ์ลอย (+ คนหนึ่งคนไว้กะสเกล)
// ฟังก์ชันที่ฉาก (src/scene/index.js) เรียกผ่าน hooks · แสดงผลอย่างเดียว — วาดจากผลของ classifyBuilding ไม่คำนวณกฎซ้ำ
// พิกัดฉาก (เมตร): x ตามแนวหน้าอาคาร · y สูง · z ลึกจากหน้าอาคาร → พิกัด three = (x, y, -z)
//
// params (ส่งผ่าน updateScene): { lot, road, canal, building:{x,z,width,depth,floors,height},
//         shape:{ areas[], depth, floorHeight, roofType:'flat'|'gable', ridge, deckArea, countDeck } }
// opts: { dark, mode:'3d'|'side', colorBy:'area'|'height', roofStructures:boolean }
import * as THREE from 'three';
import { makeModel, modelSize } from '../../scene/models.js';
import { makeLabel } from '../../scene/overlay.js';
import { fmt } from '../../rules/classify.js';

const RED = 0xe5384a, BLUE = 0x2f7fd6;
const PAL = {
  light: { wallA: 0xdfe4ea, wallB: 0xcfd6de, slab: 0x8c96a3, orangeA: 0xff9a47, orangeB: 0xffb677, over: 0xe5384a, overB: 0xef6b78, deck: 0xffcf9a, deckOff: 0xb9bfc7, roof: 0x8a5a44, struct: 0x9aa3ae },
  dark: { wallA: 0x6e7783, wallB: 0x5f6873, slab: 0x3d4550, orangeA: 0xe07a2c, orangeB: 0xf09a55, over: 0xd8404f, overB: 0xe5606d, deck: 0xc9945a, deckOff: 0x4a525c, roof: 0x7a4e3a, struct: 0x707984 },
};

// ---------- พื้นฉาก: พื้นเรียบอย่างเดียว (ไม่มีถนน คลอง ตึกแถว ต้นไม้ รถ) ----------
export function buildStatic(group, params, { colors }) {
  const { lot } = params;
  const mk = (w, d, t, y, color) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, t, d), new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.95, metalness: 0 }));
    m.position.set(lot.width / 2, y, -lot.depth / 2);
    return m;
  };
  group.add(mk(1600, 1600, 0.4, -0.2, colors.ground));
  group.add(mk(lot.width, lot.depth, 0.05, 0.025, colors.lot));
}

// ---------- กล้อง ----------
const geom = (p) => {
  const b = p.building;
  return { b, H: b.height, cx: b.x + b.width / 2, cz: b.z + b.depth / 2, ridge: p.shape.roofType === 'gable' ? p.shape.ridge : 0, levelMax: p.levelMax || 0 };
};
export function fit3d(params, aspect) {
  const { b, H, cx, cz, ridge, levelMax } = geom(params);
  const top = Math.max(H + ridge, levelMax); // เส้นเกณฑ์ลอยที่แสดงอยู่ต้องอยู่ในภาพด้วย
  const span = Math.max(top * 1.1, b.width * 1.5, b.depth * 1.5, 30);
  const k = Math.max(1, 1.1 / aspect); // จอแคบ (มือถือ) ถอยกล้องให้เห็นอาคารครบ
  return {
    pos: { x: cx + span * 0.8 * k, y: top * 0.35 + span * 0.32 * k, z: cz - span * 1.45 * k },
    target: { x: cx, y: top * 0.4, z: cz },
  };
}
export function sideBounds(params) {
  const { b, H, ridge, levelMax } = geom(params);
  return { x0: b.x - 14, x1: b.x + b.width + 26, y0: -2, y1: Math.max(H + ridge, levelMax, 16) + 6 };
}
export const CAMERA = { maxDistance: 900, far: 2500 };

// ---------- อาคาร ----------
const box = (x0, x1, y0, y1, z0, z1, mat) => {
  const m = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0), mat);
  m.position.set((x0 + x1) / 2, (y0 + y1) / 2, -(z0 + z1) / 2);
  return m;
};
const edges = (mesh, color = 0x1d232b) => {
  const e = new THREE.LineSegments(new THREE.EdgesGeometry(mesh.geometry), new THREE.LineBasicMaterial({ color }));
  e.position.copy(mesh.position);
  return e;
};

/** ช่วงในแนวกว้างของแต่ละชั้น: ชิดขอบขวาร่วมกัน (เหมือนภาพสไลด์ 12 ที่ชั้นบนร่นเข้าทางซ้าย) */
export function floorSpans(params) {
  const { b } = geom(params);
  const d = params.shape.depth;
  const x1 = b.x + b.width;
  return params.shape.areas.map((a) => ({ x0: x1 - a / d, x1, z0: b.z, z1: b.z + d }));
}

export function buildBuilding(group, params, opts = {}) {
  const P = PAL[opts.dark ? 'dark' : 'light'];
  const { b, H, ridge } = geom(params);
  const sh = params.shape;
  const spans = floorSpans(params);
  const fh = sh.floorHeight, slabT = Math.min(0.3, fh * 0.12);
  const area = results(opts).find((r) => r.id === 'large-by-area');
  const crossing = area?.geometry.crossing ?? null;
  const byArea = opts.colorBy === 'area';

  spans.forEach((s, i) => {
    const y0 = i * fh;
    let colA = i % 2 ? P.wallB : P.wallA, colSlab = P.slab;
    if (byArea) {
      const over = crossing !== null && crossing !== 'deck' && i >= crossing;
      colA = over ? (i % 2 ? P.overB : P.over) : (i % 2 ? P.orangeB : P.orangeA);
      colSlab = over ? P.over : P.orangeA;
    }
    const wall = box(s.x0, s.x1, y0 + slabT, y0 + fh, s.z0, s.z1, new THREE.MeshStandardMaterial({ color: colA, flatShading: true, roughness: 0.85, metalness: 0.02 }));
    group.add(wall, edges(wall));
    const slab = box(s.x0 - 0.15, s.x1 + 0.15, y0, y0 + slabT, s.z0 - 0.15, s.z1 + 0.15, new THREE.MeshStandardMaterial({ color: colSlab, flatShading: true, roughness: 0.9 }));
    group.add(slab, edges(slab));
  });

  const top = spans[spans.length - 1];
  if (sh.roofType === 'gable') {
    group.add(gableRoof(top, H, ridge, P.roof));
  } else {
    // พื้นดาดฟ้า: แผ่นบางบนยอดอาคาร · ถ้ามีพื้นที่ดาดฟ้า วาดเป็นแผ่นสีตามว่านับหรือไม่นับ
    const roofSlab = box(top.x0 - 0.15, top.x1 + 0.15, H, H + slabT, top.z0 - 0.15, top.z1 + 0.15, new THREE.MeshStandardMaterial({ color: byArea && sh.deckArea > 0 && sh.countDeck ? (crossing === 'deck' ? P.over : P.orangeA) : P.slab, flatShading: true, roughness: 0.9 }));
    group.add(roofSlab, edges(roofSlab));
    if (sh.deckArea > 0) {
      const dw = Math.min(sh.deckArea / sh.depth, top.x1 - top.x0);
      const deckColor = sh.countDeck ? (crossing === 'deck' ? P.over : P.deck) : P.deckOff;
      const deck = box(top.x1 - dw, top.x1, H + slabT, H + slabT + 0.12, top.z0, top.z1, new THREE.MeshStandardMaterial({ color: deckColor, flatShading: true, roughness: 0.9 }));
      group.add(deck, edges(deck));
    }
    if (opts.roofStructures) {
      // ภาพสไลด์ 14: ห้องเครื่องลิฟต์ + ถังเก็บน้ำ อยู่เหนือพื้นดาดฟ้า
      const sm = new THREE.MeshStandardMaterial({ color: P.struct, flatShading: true, roughness: 0.9 });
      const lift = box(top.x0 + 1, top.x0 + 4.5, H + slabT, H + slabT + 2.6, top.z0 + 1, top.z0 + 4.5, sm);
      const tank = box(top.x0 + 6, top.x0 + 9, H + slabT, H + slabT + 3.4, top.z0 + 1, top.z0 + 4, sm);
      group.add(lift, edges(lift), tank, edges(tank));
    }
  }

  // คนกะสเกล: ยืนหน้าอาคารด้านซ้าย สูง 1.7 ม.
  const size = modelSize('suburban-resident');
  if (size) {
    const s = 1.7 / size.y;
    const person = makeModel('suburban-resident', { x: b.x - 6, z: b.z - 1.5, scale: s });
    if (person) group.add(person);
  }
}

const results = (opts) => opts.results || [];

function gableRoof(top, H, ridge, color) {
  const { x0, x1, z0, z1 } = top;
  const zm = (z0 + z1) / 2, yr = H + Math.max(ridge, 0.01);
  const v = (x, y, z) => [x, y, -z];
  // ฐาน 4 มุม + สันหลังคา 2 จุด (สันยาวตามแนวกว้าง)
  const A = v(x0, H, z0), B = v(x1, H, z0), C = v(x1, H, z1), D = v(x0, H, z1), R0 = v(x0, yr, zm), R1 = v(x1, yr, zm);
  const tri = (a, b, c) => [...a, ...b, ...c];
  const pos = [...tri(A, B, R1), ...tri(A, R1, R0), ...tri(D, R1, C), ...tri(D, R0, R1), ...tri(A, R0, D), ...tri(B, C, R1)];
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.85, side: THREE.DoubleSide }));
  const grp = new THREE.Group();
  grp.add(m, new THREE.LineSegments(new THREE.EdgesGeometry(g, 20), new THREE.LineBasicMaterial({ color: 0x1d232b })));
  return grp;
}

// ---------- ส่วนซ้อนทับ: เส้นวัดความสูง · เส้นเกณฑ์ลอย · ไม้บรรทัด · ป้ายชั้น ----------
const flatBox = (x0, x1, y0, y1, z0, z1, color, opacity = 1) => {
  const m = new THREE.Mesh(new THREE.BoxGeometry(Math.max(x1 - x0, 1e-3), Math.max(y1 - y0, 1e-3), Math.max(z1 - z0, 1e-3)),
    new THREE.MeshBasicMaterial({ color, transparent: opacity < 1, opacity, depthTest: opacity >= 1, depthWrite: false }));
  m.position.set((x0 + x1) / 2, (y0 + y1) / 2, -(z0 + z1) / 2);
  m.renderOrder = 6;
  return m;
};
const ring = (g, y, x0, x1, z0, z1, t, color) => {
  g.add(flatBox(x0, x1, y - t / 2, y + t / 2, z0 - t / 2, z0 + t / 2, color), flatBox(x0, x1, y - t / 2, y + t / 2, z1 - t / 2, z1 + t / 2, color),
    flatBox(x0 - t / 2, x0 + t / 2, y - t / 2, y + t / 2, z0, z1, color), flatBox(x1 - t / 2, x1 + t / 2, y - t / 2, y + t / 2, z0, z1, color));
};

export function buildOverlay(group, params, rs, opts = {}) {
  const { b, H, ridge } = geom(params);
  const sh = params.shape;
  const spans = floorSpans(params);
  const u = Math.max(1, (H + ridge) / 18); // ขนาดเส้น/ป้ายโตตามอาคาร ให้อ่านออกเมื่ออาคารสูงมาก
  const t = 0.12 * u, lh = 1.25 * u;
  const dark = !!opts.dark;
  const lab = (text, at, extra = {}) => {
    const l = makeLabel(text, { h: lh, ...extra });
    l.position.set(at[0], at[1], -at[2]);
    group.add(l);
    return l;
  };

  // เส้นเกณฑ์ลอย: วงสี่เหลี่ยมสีแดงรอบอาคารที่ความสูงเกณฑ์ + แผ่นใสบางๆ
  const x0 = b.x - 3, x1 = b.x + b.width + 3, z0 = b.z - 3, z1 = b.z + sh.depth + 3;
  for (const r of rs) {
    if (r.geometry?.kind !== 'height') continue;
    const y = r.geometry.level;
    ring(group, y, x0, x1, z0, z1, t * 1.6, RED);
    group.add(flatBox(x0, x1, y - 0.02, y + 0.02, z0, z1, RED, 0.1));
    const name = r.id === 'high' ? 'เกณฑ์อาคารสูง' : 'เกณฑ์ความสูงอาคารขนาดใหญ่';
    const tl = lab(`${name} ${r.geometry.level.toFixed(2)} ม.`, [x0, y + lh * 0.75, z0], { fg: '#fff', bg: 'rgba(200,40,60,0.92)' });
    tl.position.x = x0 + tl.scale.x / 2; // ป้ายเกณฑ์เริ่มที่มุมซ้ายของวงเส้นแล้วยื่นไปทางขวา (ป้ายความสูงที่วัดอยู่สูงกว่า ไม่ทับกัน)
  }

  // เส้นวัดความสูง: จากพื้นดินที่ก่อสร้างขึ้นไปถึงพื้นดาดฟ้า (หลังคาแบน) หรือยอดผนังชั้นสูงสุด (หลังคาจั่ว/ปั้นหยา)
  const xd = b.x - 2.2, zd = b.z;
  const dimCol = BLUE;
  group.add(flatBox(xd - t / 2, xd + t / 2, 0, H, zd - t / 2, zd + t / 2, dimCol));
  for (const y of [0, H]) group.add(flatBox(xd - 0.9 * u, xd + 0.9 * u, y - t / 2, y + t / 2, zd - t / 2, zd + t / 2, dimCol));
  // เส้นประนำไปที่อาคาร ณ ระดับที่วัด
  group.add(flatBox(xd, spans[spans.length - 1].x0, H - t / 4, H + t / 4, zd - t / 4, zd + t / 4, dimCol, 0.55));
  if (sh.roofType === 'gable') ring(group, H, spans[spans.length - 1].x0, spans[spans.length - 1].x1, b.z, b.z + sh.depth, t, dimCol);
  const to = sh.roofType === 'gable' ? 'ยอดผนังชั้นสูงสุด' : 'พื้นดาดฟ้า';
  lab(`สูง ${H.toFixed(2)} ม. (วัดถึง${to})`, [xd + 1, H + lh * 2.3, zd], { fg: '#fff', bg: 'rgba(30,90,170,0.92)' });
  if (sh.roofType === 'gable' && ridge > 0) lab(`ยอดจั่วสูงเหนือยอดผนัง ${fmt(ridge)} ม. (ไม่นับ)`, [(spans[0].x0 + spans[0].x1) / 2, H + ridge + lh * 0.9, b.z + sh.depth / 2], { fg: '#fff', bg: 'rgba(90,70,50,0.92)' });

  // ไม้บรรทัดข้างเส้นวัด: ขีดทุก 5 / 10 / 20 ม.
  const step = H > 60 ? 20 : H > 30 ? 10 : 5;
  for (let y = step; y <= H + 1e-6; y += step) {
    group.add(flatBox(xd - 0.5 * u, xd + 0.5 * u, y - t / 3, y + t / 3, zd - t / 3, zd + t / 3, dimCol));
    if (Math.abs(y - H) > lh) lab(`${y} ม.`, [xd - 2.6 * u, y, zd], { fg: dark ? '#e8ebf0' : '#1b1f27', bg: dark ? 'rgba(30,40,55,0.8)' : 'rgba(255,255,255,0.8)', h: lh * 0.8 });
  }

  // ป้ายชั้นด้านขวา: เหนือเกณฑ์พื้นที่ แสดงพื้นที่รวมสะสม · ชั้นเยอะ แสดงเฉพาะบางชั้น
  const n = spans.length, fh = sh.floorHeight;
  const every = n > 24 ? 5 : n > 12 ? 2 : 1;
  const byArea = opts.colorBy === 'area';
  let sum = 0;
  const xr = b.x + b.width + 1.2;
  sh.areas.forEach((a, i) => {
    sum += a;
    if ((i + 1) % every !== 0 && i !== n - 1 && i !== 0) return;
    const text = byArea ? `ชั้น ${i + 1} · ${fmt(a)} ตร.ม. (สะสม ${fmt(sum)})` : `ชั้น ${i + 1}`;
    lab(text, [xr + (byArea ? 0 : -0.6), i * fh + fh / 2, b.z + sh.depth / 2], { fg: '#fff', bg: 'rgba(40,48,60,0.88)', h: lh * 0.85 });
  });
  const area = rs.find((r) => r.id === 'large-by-area');
  if (byArea && area) {
    const c = area.geometry.crossing;
    if (typeof c === 'number') lab(`ชั้น ${c + 1} ทำให้รวมเกิน ${fmt(area.geometry.limit)} ตร.ม.`, [xr, c * fh + fh * 0.1, b.z + sh.depth / 2], { fg: '#fff', bg: 'rgba(200,40,60,0.95)', h: lh * 0.85 });
    if (c === 'deck') lab(`ดาดฟ้าทำให้รวมเกิน ${fmt(area.geometry.limit)} ตร.ม.`, [xr, H + lh * 3.4, b.z + sh.depth / 2], { fg: '#fff', bg: 'rgba(200,40,60,0.95)', h: lh * 0.85 });
    if (sh.deckArea > 0) lab(`ดาดฟ้า ${fmt(sh.deckArea)} ตร.ม. · ${sh.countDeck ? 'นับ (ตามสไลด์ 12)' : 'ไม่นับ (ตามกฎกระทรวงฉบับที่ 33)'}`, [xr, H + lh * (c === 'deck' ? 4.4 : 2.4), b.z + sh.depth / 2], { fg: '#fff', bg: 'rgba(110,80,40,0.92)', h: lh * 0.85 });
  }
  if (opts.roofStructures) {
    const top = spans[spans.length - 1];
    lab('ห้องเครื่องลิฟต์ · ถังน้ำ', [top.x0 + 4, H + 4.6 * 1 + lh * 0.6, top.z0 + 2.5], { fg: '#fff', bg: 'rgba(60,70,85,0.9)', h: lh * 0.8 });
  }
  // ป้ายคนกะสเกล
  if (modelSize('suburban-resident')) lab('คนสูง 1.7 ม.', [b.x - 6, 1.7 + lh * 0.8, b.z - 1.5], { fg: '#fff', bg: 'rgba(40,48,60,0.85)', h: lh * 0.7 });
}
