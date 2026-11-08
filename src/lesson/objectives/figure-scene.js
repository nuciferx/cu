// ฉาก 3 มิติสำหรับ "สร้างรูปประกอบบทที่ 1" เท่านั้น (ไม่ถูก build เข้าหน้าบทใดๆ)
// ใช้โดย scripts/make-l1-figures.py: เปิด figure-scene.html (vite dev) แล้วสั่ง window.__fig.show('1'..'7' | 'overview')
// ต่อภาพหนึ่งภาพ: เลือกส่วนอาคารที่เรืองแสง · ย้ายกล้อง · ซ่อนป้ายที่ไม่เกี่ยวข้อง (ป้ายคลอง ฯลฯ)
import { initScene, updateScene } from '../../scene/index.js';
import { makeLabel } from '../../scene/overlay.js';
import { objectiveByN } from '../../content/objectives.js';
import { partsOfObjective } from '../../content/lesson01.js';
import { buildBuilding, buildOverlay, partAnchors } from './building.js';

const PARAMS = {
  lot: { width: 16, depth: 30 }, road: { width: 8 }, canal: { width: 8 },
  building: { x: 2.5, z: 9, width: 11, depth: 14, floors: 3, height: 10.5, use: 'residential' },
};
const B = PARAMS.building;
const ANCH = partAnchors(B);

// กล้องของแต่ละข้อ: pos/tgt เป็นพิกัดฉาก (x, y สูง, z ลึกจากถนน)
const camFor = (partId) => {
  const a = ANCH[partId], k = 1.45;
  return { pos: { x: a.look[0] + (a.cam[0] - a.look[0]) * k, y: a.look[1] + (a.cam[1] - a.look[1]) * k, z: a.look[2] + (a.cam[2] - a.look[2]) * k }, tgt: { x: a.look[0], y: a.look[1], z: a.look[2] } };
};
const SHOTS = {
  overview: { layers: new Set(['zoning', 'eia', 'control']), cam: { pos: { x: B.x + 2, y: 74, z: -50 }, tgt: { x: B.x + 4, y: 0, z: 14 } }, glowBuilding: true, labelScale: 2.4 },
  1: { cam: camFor('frame') },
  2: { cam: { pos: { x: 17, y: 6.5, z: -13 }, tgt: { x: 8, y: 3.5, z: 9 } } },
  3: { cam: { pos: { x: 24, y: 24, z: 28 }, tgt: { x: 13.5, y: 4.5, z: 11 } } },
  4: { cam: { pos: { x: B.x - 22, y: 13, z: B.z + B.depth + 14 }, tgt: { x: B.x + 3, y: 2.5, z: B.z + B.depth * 0.6 } } },
  7: { cam: camFor('parking') },
  // ข้อ 5, 6 ไม่มีส่วนอาคารเฉพาะ → มุมกว้างเห็นทั้งอาคารกับตึกข้างเคียง เรืองทั้งหลัง
  5: { focus: ['overall'], cam: { pos: { x: -4, y: 9, z: -22 }, tgt: { x: 8, y: 4.5, z: 8 } }, label: 'แนวอาคารริมถนน' },
  6: { focus: ['overall'], cam: { pos: { x: B.x - 20, y: 12, z: B.z - 24 }, tgt: { x: B.x + B.width / 2, y: 4.5, z: B.z + 5 } }, label: 'รูปทรงอาคาร' },
};

const api = await initScene(document.getElementById('view'), {
  buildBuilding,
  buildOverlay: (group, params, results, opts) => {
    buildOverlay(group, params, results, opts);
    if (opts.labelScale) group.traverse((o) => { if (o.isSprite) o.scale.multiplyScalar(opts.labelScale); }); // ถ่ายไกล ป้ายต้องใหญ่ขึ้นให้อ่านออก
    if (opts.extraLabel) { // ป้ายสำหรับข้อที่ไม่มีส่วนอาคาร (ใช้สีของข้อนั้น)
      const l = makeLabel(opts.extraLabel.text, { fg: '#ffffff', bg: opts.extraLabel.color, h: 1.7 });
      l.position.set(B.x + B.width / 2, B.height + 4.8, -(B.z + B.depth / 2) + 0);
      group.add(l);
    }
  },
});
api.setTheme(false);

function hideForeignLabels() {
  // ป้ายที่ฉากพื้นฐานวางไว้ (ป้ายความกว้างคลอง ฯลฯ) ไม่เกี่ยวกับข้อที่แสดง → ซ่อน
  for (const name of ['static', 'canal', 'grid']) api.three.scene.getObjectByName(name)?.traverse((o) => { if (o.isSprite) o.visible = false; });
  api.invalidate();
}

window.__fig = {
  show(key) {
    const s = SHOTS[key];
    const n = key === 'overview' ? null : +key;
    const o = n ? objectiveByN(n) : null;
    const focus = new Set(s.focus || (n ? partsOfObjective(n) : []));
    const extraLabel = s.label ? { text: s.label, color: o.color } : null;
    updateScene(PARAMS, [], { dark: false, layers: s.layers || new Set(), focus, glowBuilding: !!s.glowBuilding, labelScale: s.labelScale, glowColor: o?.color, extraLabel });
    api.flyTo(s.cam.pos, s.cam.tgt, 1);
    setTimeout(hideForeignLabels, 50);
    return true;
  },
};
window.__figReady = true;
