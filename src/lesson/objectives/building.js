// อาคารหลักของบทที่ 1 แบบมีรายละเอียดให้ชี้ได้ + ชั้นภาพซ้อน (ผังเมืองรวม · EIA · ควบคุมอาคาร)
// ฟังก์ชันที่ฉาก (src/scene/index.js) เรียกผ่าน hooks: buildBuilding(group, params, opts) / buildOverlay(group, params, results, opts)
// พิกัดฉาก (เมตร): x ตามแนวถนน · y สูง · z ลึกจากถนน → พิกัด three = (x, y, -z)
// opts = { dark, layers:Set<'zoning'|'eia'|'control'>, focus:Set<partId>, xray:boolean }
import * as THREE from 'three';
import { makeModel } from '../../scene/models.js';
import { makeLabel } from '../../scene/overlay.js';
import { objectiveByN } from '../../content/objectives.js';
import { PARTS, partObjective } from '../../content/lesson01.js';

const colorOfPart = (id) => objectiveByN(partObjective(id))?.color || '#ff8a3d';

// ตำแหน่งของแต่ละส่วนในฉาก (ใช้วางจุดกด + เล็งกล้อง) — คำนวณจากขนาดอาคารที่ส่งเข้ามา
export function partAnchors(b) {
  const cx = b.x + b.width / 2, cz = b.z + b.depth / 2, h = b.height, fh = h / b.floors;
  return {
    frame: { at: [b.x + 0.2, h * 0.55, b.z + 0.2], look: [cx, h * 0.45, cz], cam: [cx - 16, h + 5, b.z - 15] },
    entrance: { at: [cx, 1.5, b.z], look: [cx, 1.4, b.z], cam: [cx + 4, 4.5, b.z - 11] },
    stair: { at: [b.x + b.width + 1, fh * 1.4, b.z + 3.6], look: [b.x + b.width + 0.6, fh * 1.3, b.z + 3.4], cam: [b.x + b.width + 6, h + 13, b.z - 9] },
    window: { at: [b.x + b.width * 0.17, fh + 1.7, b.z], look: [cx, fh * 1.4, b.z], cam: [cx - 5, fh * 1.6, b.z - 13] },
    septic: { at: [b.x + 3.2, 1.4, b.z + b.depth + 2.4], look: [b.x + 3.2, 0.5, b.z + b.depth + 2.4], cam: [b.x + 12, 7, b.z + b.depth + 14] },
    parking: { at: [b.x + 1.2, 1.6, 4.5], look: [cx, 0.5, 4.2], cam: [cx + 9, 11, -9] },
    overall: { at: [cx, h + 0.9, cz], look: [cx, h * 0.5, cz], cam: [cx - 20, h + 12, b.z - 22] },
    sign: { at: [cx, h + 2.9, b.z + 0.4], look: [cx, h + 1.2, b.z], cam: [cx + 8, h + 5, b.z - 14] },
  };
}

const cssToHex = (c) => new THREE.Color(c).getHex();

export function buildBuilding(group, params, opts = {}) {
  const b = params.building;
  const dark = !!opts.dark;
  const focus = opts.focus || new Set();
  const xray = focus.has('frame');
  const floors = Math.max(1, b.floors | 0), fh = b.height / floors, H = b.height;
  const x0 = b.x, x1 = b.x + b.width, z0 = b.z, z1 = b.z + b.depth, cx = (x0 + x1) / 2;
  const glowAll = focus.has('overall') || opts.glowBuilding;

  const mats = [];
  // วัสดุ: ถ้าส่วนนั้นถูกเน้น → เรืองด้วยสีของวัตถุประสงค์ข้อนั้น
  const M = (color, part, extra = {}) => {
    const m = new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.85, metalness: 0.02, ...extra });
    const on = part && (focus.has(part) || (part === 'overall' && glowAll));
    if (on) { m.emissive = new THREE.Color(part === 'overall' ? (focus.has('overall') ? (opts.glowColor || '#ff8a3d') : '#14a8f0') : colorOfPart(part)); m.emissiveIntensity = 0.65; }
    mats.push(m);
    return m;
  };
  const box = (xa, xb, ya, yb, za, zb, mat, part, parent = group) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(xb - xa, yb - ya, zb - za), mat);
    m.position.set((xa + xb) / 2, (ya + yb) / 2, -(za + zb) / 2);
    if (part) m.userData.part = part;
    parent.add(m);
    return m;
  };
  const sub = (part) => { const g = new THREE.Group(); g.userData.part = part; group.add(g); return g; };

  const C = dark
    ? { wall: 0x8f8a7e, slab: 0x6d6f74, concrete: 0x9a9ea6, glass: 0x4f86b0, door: 0x6e4a2e, steel: 0x8b93a1, tank: 0x6b7f6b, pave: 0x4c5058, line: 0xdadada, sign: 0xc79a22 }
    : { wall: 0xf1e6d0, slab: 0xb9bcc2, concrete: 0xc1c4ca, glass: 0x7cc0ea, door: 0x8a5a34, steel: 0x6b7280, tank: 0x8fae8f, pave: 0x6d727a, line: 0xffffff, sign: 0xf2b632 };

  // ---------- ผนังทึบ (ส่วน "overall") ----------
  const wallMat = M(C.wall, 'overall', xray ? { transparent: true, opacity: 0.14, depthWrite: false } : {});
  box(x0 + 0.25, x1 - 0.25, 0, H, z0 + 0.25, z1 - 0.25, wallMat, 'overall');

  // ---------- โครงเสา คาน พื้น (ส่วน "frame") ----------
  const frame = sub('frame');
  const fm = M(C.concrete, 'frame');
  const sm = M(C.slab, 'frame');
  const cs = 0.36;
  const xs = [x0 + cs / 2, cx, x1 - cs / 2], zs = [z0 + cs / 2, (z0 + z1) / 2, z1 - cs / 2];
  for (const x of xs) for (const z of zs) box(x - cs / 2, x + cs / 2, 0, H, z - cs / 2, z + cs / 2, fm, 'frame', frame);
  for (let k = 1; k <= floors; k++) {
    const y = k * fh;
    box(x0, x1, y - 0.22, y, z0, z1, sm, 'frame', frame); // พื้น/ดาดฟ้า
    for (const z of zs) box(x0, x1, y - 0.55, y - 0.22, z - 0.13, z + 0.13, fm, 'frame', frame); // คานตามแนว x
    for (const x of xs) box(x - 0.13, x + 0.13, y - 0.55, y - 0.22, z0, z1, fm, 'frame', frame); // คานตามแนว z
  }

  // ---------- หน้าต่าง (ส่วน "window") ----------
  const win = sub('window');
  const gm = M(C.glass, 'window', { roughness: 0.25, metalness: 0.2 });
  const winAt = (cxw, y, face, w = 1.5, h = 1.35) => {
    if (face === 'front') box(cxw - w / 2, cxw + w / 2, y, y + h, z0 + 0.2, z0 + 0.32, gm, 'window', win);
    else if (face === 'back') box(cxw - w / 2, cxw + w / 2, y, y + h, z1 - 0.32, z1 - 0.2, gm, 'window', win);
    else box(x0 + 0.2, x0 + 0.32, y, y + h, cxw - w / 2, cxw + w / 2, gm, 'window', win); // ด้านซ้าย (cxw = z)
  };
  for (let k = 0; k < floors; k++) {
    const y = k * fh + 1.0;
    for (const f of (k === 0 ? [0.17, 0.83] : [0.17, 0.5, 0.83])) winAt(x0 + b.width * f, y, 'front');
    for (const f of [0.17, 0.5, 0.83]) winAt(x0 + b.width * f, y, 'back');
    for (const f of [0.25, 0.5, 0.75]) winAt(z0 + b.depth * f, y, 'left', 1.3);
  }

  // ---------- ทางเข้าอาคาร + ทางเดิน (ส่วน "entrance") ----------
  const ent = sub('entrance');
  box(cx - 0.9, cx + 0.9, 0, 2.5, z0 + 0.2, z0 + 0.34, M(C.door, 'entrance'), 'entrance', ent);
  box(cx - 1.5, cx + 1.5, 2.6, 2.78, z0 - 1.1, z0 + 0.34, M(C.slab, 'entrance'), 'entrance', ent); // กันสาดหน้าประตู
  box(cx - 1.0, cx + 1.0, 0.04, 0.12, 0, z0 + 0.2, M(0xb8b2a6, 'entrance'), 'entrance', ent); // ทางเดินจากทางเท้า

  // ---------- บันไดหนีไฟ ด้านขวา (ส่วน "stair") ----------
  const st = sub('stair');
  const stm = M(C.steel, 'stair');
  const sx0 = x1 + 0.1, sx1 = sx0 + 1.1, zs0 = z0 + 1.2, L = 4.2;
  const flight = (yA, yB, zA, zB, n = 9) => {
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n;
      const y = yA + (yB - yA) * t, z = zA + (zB - zA) * t;
      box(sx0, sx1, y - 0.05, y + 0.05, z - Math.abs(zB - zA) / n / 2, z + Math.abs(zB - zA) / n / 2, stm, 'stair', st);
    }
    // ราวกันตกด้านนอก
    const rise = yB - yA, run = zB - zA, len = Math.hypot(rise, run);
    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, len), stm);
    rail.position.set(sx1 - 0.03, (yA + yB) / 2 + 0.95, -(zA + zB) / 2);
    rail.rotation.x = Math.atan2(rise, Math.abs(run)) * (run >= 0 ? 1 : -1);
    rail.userData.part = 'stair'; st.add(rail);
  };
  const lowAcc = Math.min(floors, 3);
  for (let k = 1; k < lowAcc; k++) {
    const yA = (k - 1) * fh, yB = k * fh;
    const up = k % 2 === 1;
    flight(yA, yB, up ? zs0 : zs0 + L, up ? zs0 + L : zs0);
    const lz = up ? zs0 + L + 0.6 : zs0 - 0.6;
    box(sx0, sx1 + 0.1, yB - 0.07, yB + 0.05, lz - 0.6, lz + 0.6, stm, 'stair', st); // ชานพัก
    box(x1 - 0.25, x1 - 0.12, yB, yB + 2.1, lz - 0.45, lz + 0.45, M(0x8a3b2a, 'stair'), 'stair', st); // ประตูหนีไฟเข้าอาคาร
  }
  // เสารับบันได
  for (const z of [zs0 - 0.1, zs0 + L + 0.1]) box(sx1 - 0.08, sx1, 0, (lowAcc - 1) * fh, z - 0.05, z + 0.05, stm, 'stair', st);

  // ---------- ป้ายบนอาคาร (ส่วน "sign" — ไม่อยู่ในกิจกรรมจับคู่) ----------
  const sg = sub('sign');
  const sgm = M(C.sign, 'sign');
  box(cx - 2.6, cx + 2.6, H + 0.9, H + 2.5, z0 + 0.3, z0 + 0.5, sgm, 'sign', sg);
  for (const dx of [-1.8, 1.8]) box(cx + dx - 0.07, cx + dx + 0.07, H, H + 0.9, z0 + 0.34, z0 + 0.46, M(C.steel), 'sign', sg);

  // ---------- ที่จอดรถ + ทางเข้ารถ (ส่วน "parking") ----------
  const pk = sub('parking');
  const pm = M(C.pave, 'parking'), lm = M(C.line, 'parking');
  const bayZ0 = 1.2, bayZ1 = z0 - 1.6;
  box(x0 - 1.5, x1 + 1.5, 0.05, 0.1, 0, z0 - 1.0, pm, 'parking', pk); // พื้นที่จอด+ทางรถ ผิวลาดยาง
  for (const f of [0, 1]) box(x0 - 1.5 + f * (b.width + 3) - 0.05, x0 - 1.5 + f * (b.width + 3) + 0.05, 0.1, 0.12, 0.2, z0 - 1.0, lm, 'parking', pk);
  const bays = 3, bw = (b.width + 3) / bays;
  for (let i = 1; i < bays; i++) box(x0 - 1.5 + i * bw - 0.04, x0 - 1.5 + i * bw + 0.04, 0.1, 0.12, bayZ0 + 0.4, bayZ1, lm, 'parking', pk);
  // ลูกศรทางเข้า (แถบสี่เหลี่ยมสั้นๆ)
  box(cx - 0.12, cx + 0.12, 0.1, 0.12, 0.2, 1.4, lm, 'parking', pk);
  const car = makeModel('family-crossover', { x: x0 - 1.5 + bw * 0.5, z: (bayZ0 + bayZ1) / 2 + 0.3, rotY: Math.PI, scale: 1 });
  if (car) { car.userData.part = 'parking'; pk.add(car); }

  // ---------- ถังบำบัดน้ำเสีย ด้านหลัง (ส่วน "septic") ----------
  const sp = sub('septic');
  const tm = M(C.tank, 'septic');
  const tz = z1 + 2.4, tx = x0 + 3.2;
  const tank = new THREE.Mesh(new THREE.CylinderGeometry(1.15, 1.15, 0.9, 20), tm);
  tank.position.set(tx, 0.4, -tz); tank.userData.part = 'septic'; sp.add(tank);
  const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.12, 16), M(0x4a4f57, 'septic'));
  lid.position.set(tx, 0.9, -tz); lid.userData.part = 'septic'; sp.add(lid);
  box(tx - 0.08, tx + 0.08, 0.3, 0.45, z1 - 0.25, tz - 1.1, M(0x555b64, 'septic'), 'septic', sp); // ท่อจากอาคาร
  box(tx + 0.7, tx + 0.8, 0.9, 2.4, tz - 0.05, tz + 0.05, M(0x555b64, 'septic'), 'septic', sp); // ท่ออากาศ

  // ---------- ป้ายชื่อของส่วนที่เน้น ----------
  const anchors = partAnchors(b);
  for (const id of focus) {
    const info = PARTS.find((p) => p.id === id);
    if (!info || !anchors[id]) continue;
    const lab = makeLabel(info.label, { fg: '#ffffff', bg: colorOfPart(id), h: 1.5 });
    lab.position.set(anchors[id].at[0], anchors[id].at[1] + 1.4, -anchors[id].at[2]);
    group.add(lab);
  }
  group.userData.mats = mats;
}

// ---------- ชั้นภาพซ้อน ----------
const flatPlane = (group, xa, xb, za, zb, y, color, opacity, order = 1) => {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(xb - xa, zb - za), new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, side: THREE.DoubleSide }));
  m.rotation.x = -Math.PI / 2;
  m.position.set((xa + xb) / 2, y, -(za + zb) / 2);
  m.renderOrder = order;
  group.add(m);
  return m;
};

export function buildOverlay(group, params, _results, opts = {}) {
  const layers = opts.layers || new Set();
  const b = params.building, W = params.lot.width, D = params.lot.depth;
  const cx = b.x + b.width / 2, cz = b.z + b.depth / 2;

  if (layers.has('zoning')) {
    // ระบายสีโซนตามตารางสีสไลด์ 99: ย.1–4 เหลือง · ย.5–7 ส้ม · พ.1–5 แดง (ภาพประกอบ ไม่ใช่ผังจริง)
    flatPlane(group, -70, -28, 0, D, 0.1, 0xff9a1f, 0.5);
    flatPlane(group, -28, W + 22, 0, D, 0.1, 0xf2d600, 0.5);
    flatPlane(group, W + 22, W + 70, 0, D, 0.1, 0xe5384a, 0.5);
    const tag = (text, x, bg, fg) => { const l = makeLabel(text, { fg, bg, h: 1.9 }); l.position.set(x, 0.7, -D * 0.82); group.add(l); };
    tag('ย.5–7 (สีส้ม)', -48, 'rgba(255,154,31,0.95)', '#3a1f00');
    tag('ย.1–4 (สีเหลือง)', W / 2, 'rgba(242,214,0,0.95)', '#3d3400');
    tag('พ.1–5 (สีแดง)', W + 46, 'rgba(229,56,74,0.95)', '#ffffff');
  }
  if (layers.has('eia')) {
    const R = 36;
    const disc = new THREE.Mesh(new THREE.CircleGeometry(R, 64), new THREE.MeshBasicMaterial({ color: 0x7be02a, transparent: true, opacity: 0.2, depthWrite: false, side: THREE.DoubleSide }));
    disc.rotation.x = -Math.PI / 2; disc.position.set(cx, 0.13, -cz); disc.renderOrder = 2; group.add(disc);
    for (const [r, op] of [[R, 0.9], [R * 0.66, 0.55], [R * 0.33, 0.35]]) {
      const ring = new THREE.Mesh(new THREE.RingGeometry(r - 0.5, r, 80), new THREE.MeshBasicMaterial({ color: 0x4fb800, transparent: true, opacity: op, depthWrite: false, side: THREE.DoubleSide }));
      ring.rotation.x = -Math.PI / 2; ring.position.set(cx, 0.14, -cz); ring.renderOrder = 3; group.add(ring);
    }
    const l = makeLabel('ผลกระทบรอบโครงการ (ภาพประกอบ)', { fg: '#163a00', bg: 'rgba(123,224,42,0.95)', h: 1.9 });
    l.position.set(cx, 0.8, -(cz - R * 0.8)); group.add(l);
  }
  if (layers.has('control')) {
    flatPlane(group, b.x - 0.3, b.x + b.width + 0.3, b.z - 0.3, b.z + b.depth + 0.3, 0.16, 0x14a8f0, 0.6, 4);
    const edges = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(b.width + 0.6, b.height + 0.6, b.depth + 0.6)), new THREE.LineBasicMaterial({ color: 0x14a8f0 }));
    edges.position.set(cx, b.height / 2, -cz); group.add(edges);
    const l = makeLabel('อาคารที่ถูกควบคุม', { fg: '#002f47', bg: 'rgba(20,168,240,0.95)', h: 1.9 });
    l.position.set(cx, b.height + 4.4, -cz); group.add(l);
  }
}
