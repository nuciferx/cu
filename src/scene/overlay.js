// วาดผลของตัวตรวจกฎลงในฉาก: เส้นร่น (เส้นประ + ป้ายตัวเลข) · พื้นที่ร่นที่อาคารล้ำ (แดง) · พื้นที่ว่าง (เขียว)
import * as THREE from 'three';

export const PASS = 0x1fa855, FAIL = 0xe5384a, UNKNOWN = 0xd9a400;
const WORD = (p) => (p === true ? 'ผ่าน' : p === false ? 'ไม่ผ่าน' : 'ยังไม่ตัดสิน');
const colorOf = (p) => (p === true ? PASS : p === false ? FAIL : UNKNOWN);
const cssOf = (p) => '#' + colorOf(p).toString(16).padStart(6, '0');

export function disposeGroup(g) {
  for (const o of [...g.children]) {
    g.remove(o);
    o.traverse?.((n) => {
      n.geometry?.dispose?.();
      const m = n.material;
      if (m && !m.userData?.shared) { m.map?.dispose?.(); m.dispose?.(); }
    });
  }
}

// ป้ายข้อความ (Sprite) — h = ความสูงป้ายเป็นเมตรในฉาก
export function makeLabel(text, { fg = '#fff', bg = 'rgba(0,0,0,0.75)', h = 1.4, opacity = 1 } = {}) {
  const dpr = 2, fs = 34;
  const c = document.createElement('canvas');
  const ctx = c.getContext('2d');
  const font = `600 ${fs}px "Noto Sans Thai","Leelawadee UI","Tahoma","Sarabun",system-ui,sans-serif`;
  ctx.font = font;
  const tw = Math.ceil(ctx.measureText(text).width);
  const padX = 22, padY = 14;
  c.width = (tw + padX * 2) * dpr / 2; c.height = (fs + padY * 2) * dpr / 2;
  ctx.scale(dpr / 2, dpr / 2);
  ctx.font = font; ctx.textBaseline = 'middle';
  const w = tw + padX * 2, hh = fs + padY * 2;
  ctx.fillStyle = bg; roundRect(ctx, 0, 0, w, hh, 14); ctx.fill();
  ctx.fillStyle = fg; ctx.fillText(text, padX, hh / 2 + 2);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false, opacity }));
  sp.scale.set((h * w) / hh, h, 1);
  sp.renderOrder = 20;
  return sp;
}
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}

function flat(x0, z0, x1, z1, y, color, opacity, { depthTest = true, order = 2 } = {}) {
  const geo = new THREE.PlaneGeometry(Math.max(x1 - x0, 1e-4), Math.max(z1 - z0, 1e-4)).rotateX(-Math.PI / 2);
  const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, depthTest, side: THREE.DoubleSide }));
  m.position.set((x0 + x1) / 2, y, -(z0 + z1) / 2);
  m.renderOrder = order;
  return m;
}

// เส้นประหนา (ชุดสี่เหลี่ยมเล็กๆ) จาก (ax,az) ถึง (bx,bz)
function dashed(ax, az, bx, bz, y, color, opacity, width = 0.3, dash = 0.9, gap = 0.5) {
  const len = Math.hypot(bx - ax, bz - az), dx = (bx - ax) / len, dz = (bz - az) / len;
  const nx = -dz * width / 2, nz = dx * width / 2;
  const pos = [];
  for (let t = 0; t < len; t += dash + gap) {
    const t2 = Math.min(t + dash, len);
    const p0 = [ax + dx * t, az + dz * t], p1 = [ax + dx * t2, az + dz * t2];
    const q = [[p0[0] - nx, p0[1] - nz], [p0[0] + nx, p0[1] + nz], [p1[0] + nx, p1[1] + nz], [p1[0] - nx, p1[1] - nz]];
    for (const i of [0, 1, 2, 0, 2, 3]) pos.push(q[i][0], y, -q[i][1]);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color, transparent: opacity < 1, opacity, depthWrite: false, side: THREE.DoubleSide }));
  m.renderOrder = 4;
  return m;
}

// พื้นที่ของแถบร่นแต่ละด้าน (พิกัดฉาก) : [x0,z0,x1,z1] และเส้นแบ่ง
function stripOf(from, d, lot) {
  const W = lot.width, D = lot.depth;
  switch (from) {
    case 'road': return { rect: [0, 0, W, d], line: [0, d, W, d], labelAt: [W * 0.5, d], tag: 'ถนน' };
    case 'canal':
    case 'boundary-back': return { rect: [0, D - d, W, D], line: [0, D - d, W, D - d], labelAt: [W * 0.5, D - d], tag: 'คลอง' };
    case 'boundary-left': return { rect: [0, 0, d, D], line: [d, 0, d, D], labelAt: [d, 1.6], tag: 'เขตซ้าย' };
    case 'boundary-right': return { rect: [W - d, 0, W, D], line: [W - d, 0, W - d, D], labelAt: [W - d, 3.6], tag: 'เขตขวา' };
    default: return null;
  }
}
const intersect = (a, b) => {
  const x0 = Math.max(a[0], b[0]), z0 = Math.max(a[1], b[1]), x1 = Math.min(a[2], b[2]), z1 = Math.min(a[3], b[3]);
  return x1 > x0 + 1e-6 && z1 > z0 + 1e-6 ? [x0, z0, x1, z1] : null;
};

export function buildOverlay(group, params, results, opts) {
  const { lot, building: b } = params;
  const focus = opts.focusRuleId ?? null;
  const bRect = [b.x, b.z, b.x + b.width, b.z + b.depth];
  const labels = [];

  for (const r of results) {
    const g = r.geometry;
    if (!g) continue;
    const dim = focus && r.id !== focus ? 0.12 : 1;
    const geoms = Array.isArray(g) ? g : [g];
    geoms.forEach((geo, idx) => {
      if (geo.kind === 'setbackLine') {
        const s = stripOf(geo.from, geo.distance, lot);
        if (!s) return;
        const col = colorOf(r.pass);
        group.add(flat(...s.rect, 0.07, col, 0.16 * dim));
        group.add(dashed(...s.line, 0.12, col, dim, 0.3));
        const over = intersect(s.rect, bRect);
        if (over) group.add(flat(...over, 0.14, FAIL, 0.5 * dim, { depthTest: false, order: 6 }));
        if (dim < 1) return; // กฎที่ไม่ได้เน้น: ซ่อนป้าย เหลือแค่แถบสีจาง
        const word = r.id === 'wall-opening-distance' ? 'ห่างเขต' : 'ร่น';
        const text = `${word} ${fmtNum(geo.distance)} ม. · ${WORD(r.pass)}`;
        const lab = makeLabel(text, { fg: '#fff', bg: hexA(colorOf(r.pass), 0.95), h: 1.8 });
        lab.position.set(s.labelAt[0], 0.3, -s.labelAt[1]);
        // ป้ายเส้นข้าง: ขยับเข้าในที่ดินเล็กน้อยกันซ้อนกับเขต
        if (geo.from === 'boundary-left') lab.position.x += lab.scale.x * 0.5 + 0.2;
        if (geo.from === 'boundary-right') lab.position.x -= lab.scale.x * 0.5 + 0.2;
        if (geo.from === 'canal' || geo.from === 'boundary-back') lab.position.z += 1.1;
        if (geo.from === 'road') lab.position.z -= 1.1;
        labels.push(lab);
      } else if (geo.kind === 'openArea') {
        const col = colorOf(r.pass);
        const shape = new THREE.Shape();
        shape.moveTo(0, 0); shape.lineTo(lot.width, 0); shape.lineTo(lot.width, lot.depth); shape.lineTo(0, lot.depth); shape.closePath();
        const ix = intersect([0, 0, lot.width, lot.depth], bRect);
        if (ix) {
          const hole = new THREE.Path();
          hole.moveTo(ix[0], ix[1]); hole.lineTo(ix[0], ix[3]); hole.lineTo(ix[2], ix[3]); hole.lineTo(ix[2], ix[1]); hole.closePath();
          shape.holes.push(hole);
        }
        const sg = new THREE.ShapeGeometry(shape).rotateX(-Math.PI / 2);
        sg.scale(1, 1, 1);
        const mesh = new THREE.Mesh(sg, new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.28 * dim, depthWrite: false, side: THREE.DoubleSide }));
        mesh.position.y = 0.09; mesh.renderOrder = 3;
        group.add(mesh);
        // วางป้ายกลางช่องว่างที่ใหญ่ที่สุด
        const free = [
          [0, 0, lot.width, b.z], [0, b.z + b.depth, lot.width, lot.depth],
          [0, b.z, b.x, b.z + b.depth], [b.x + b.width, b.z, lot.width, b.z + b.depth],
        ].filter((q) => q[2] > q[0] && q[3] > q[1]).sort((a, c) => (c[2] - c[0]) * (c[3] - c[1]) - (a[2] - a[0]) * (a[3] - a[1]))[0];
        const [fx, fz] = free ? [(free[0] + free[2]) / 2, (free[1] + free[3]) / 2] : [lot.width / 2, lot.depth / 2];
        if (dim < 1) return;
        const text = `ที่ว่าง ${fmtNum(geo.ratio * 100)}% · ${WORD(r.pass)}`;
        const lab = makeLabel(text, { fg: '#fff', bg: hexA(col, 0.95), h: 1.8 });
        lab.position.set(fx, 0.3, -fz);
        labels.push(lab);
      }
    });
  }
  // กันป้ายซ้อนกัน: ถ้าทับป้ายที่วางแล้ว ให้ขยับตามแนว z ทีละครึ่งป้ายจนไม่ทับ
  const placed = [];
  for (const lab of labels) {
    const w = lab.scale.x, h = lab.scale.y;
    for (let k = 0; k < 12; k++) {
      const hit = placed.find((q) => Math.abs(q.position.x - lab.position.x) < (q.scale.x + w) / 2 && Math.abs(q.position.z - lab.position.z) < (q.scale.y + h) / 2);
      if (!hit) break;
      lab.position.z += (k % 2 ? 1 : -1) * (h * 0.55 + (hit.scale.y * 0.55)) * (1 + (k >> 1));
    }
    placed.push(lab);
    group.add(lab);
  }
}

const fmtNum = (n) => (Math.round(n * 10) / 10).toString();
const hexA = (hex, a) => `rgba(${(hex >> 16) & 255},${(hex >> 8) & 255},${hex & 255},${a})`;
export { cssOf, WORD };
