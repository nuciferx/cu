// ฉาก 3 มิติ — แสดงผลอย่างเดียว วาดจากผลของตัวตรวจกฎ ไม่คำนวณกฎซ้ำ
// พิกัดฉาก (เมตร): x = ตามแนวถนน (ขวา+), z = ลึกจากถนนไปคลอง ; ถนนอยู่ z<0 คลองอยู่ z>lot.depth
// พิกัด three: (x, y, -z) → กล้องที่ยืนฝั่งถนนมองเห็น x ชี้ขวา คลองอยู่ไกลสุด
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { loadModels, makeModel } from './models.js';
import { buildOverlay, disposeGroup, makeLabel } from './overlay.js';

const COLORS = {
  light: { sky: 0xcfe6f7, ground: 0xb7d29a, road: 0x4a4f57, sidewalk: 0xc9c5bb, lot: 0xf1e7cf, water: 0x4aa3d8, wall: 0xa7a39a, hemiSky: 0xffffff, hemiGround: 0x9aa58a, sun: 1.5, hemi: 1.1 },
  dark: { sky: 0x0e1a2b, ground: 0x2a3b2c, road: 0x23262b, sidewalk: 0x4a4944, lot: 0x5a5444, water: 0x1f5f8a, wall: 0x5f5d58, hemiSky: 0x8fa6c8, hemiGround: 0x2a3322, sun: 0.7, hemi: 0.9 },
};

let host, renderer, scene, persp, ortho, controls3d, controlsTop, sun, hemi;
let userMoved = false, sideMoved = false;
let mode = '3d', dark = false, needsRender = true, modelsReady = false;
let params = null, results = [], opts = {};
// ตัวขยายของบทอื่น (ไม่ใส่ = ฉากที่ดิน/ถนน/คลองของบทระยะร่นเหมือนเดิม):
//   buildBuilding(group, params, opts) · buildOverlay(group, params, results, opts) · onPick(part) · onFrame()
//   buildStatic(group, params, { dark, colors }) : วาดพื้นฉากแทนที่ดิน/ถนน/คลอง/ตึกแถว (เช่น พื้นเรียบ)
//   fit3d(params, aspect) → { pos:{x,y,z}, target:{x,y,z} } พิกัดฉาก : จัดกล้อง 3 มิติเอง (ตามขนาดอาคาร)
//   sideBounds(params) → { x0, x1, y0, y1 } พิกัดฉาก : กรอบที่มุม 'side' (มองด้านข้างตรงๆ) ต้องเห็น
//   camera: { maxDistance, far } : ขยายระยะกล้องสำหรับอาคารสูง
let hooks = {};
const frameCbs = [];
let staticSig = '', staticGroup, canalGroup, buildingGroup, overlayGroup, gridGroup;
const mats = {};

export async function initScene(container, extraHooks = {}) {
  hooks = extraHooks;
  host = container;
  renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.domElement.style.display = 'block';
  renderer.domElement.style.touchAction = 'none';
  host.appendChild(renderer.domElement);

  scene = new THREE.Scene();
  hemi = new THREE.HemisphereLight(0xffffff, 0x9aa58a, 1.1);
  sun = new THREE.DirectionalLight(0xffffff, 1.5);
  sun.position.set(30, 60, 25);
  scene.add(hemi, sun);

  persp = new THREE.PerspectiveCamera(42, 1, 0.5, 600);
  ortho = new THREE.OrthographicCamera(-10, 10, 10, -10, 0.5, 600);
  controls3d = new OrbitControls(persp, renderer.domElement);
  controls3d.maxPolarAngle = Math.PI / 2 - 0.04;
  controls3d.minDistance = 6;
  controls3d.maxDistance = 220;
  controlsTop = new OrbitControls(ortho, renderer.domElement);
  controlsTop.enableRotate = false;
  controlsTop.screenSpacePanning = true;
  controlsTop.minZoom = 0.3;
  controlsTop.maxZoom = 12;
  controlsTop.mouseButtons = { LEFT: THREE.MOUSE.PAN, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN };
  controlsTop.touches = { ONE: THREE.TOUCH.PAN, TWO: THREE.TOUCH.DOLLY_PAN };
  if (hooks.camera?.maxDistance) controls3d.maxDistance = hooks.camera.maxDistance;
  if (hooks.camera?.far) { persp.far = hooks.camera.far; ortho.far = hooks.camera.far; persp.updateProjectionMatrix(); ortho.updateProjectionMatrix(); }
  for (const c of [controls3d, controlsTop]) c.addEventListener('change', invalidate);
  controls3d.addEventListener('start', () => { userMoved = true; tween = null; });
  controlsTop.addEventListener('start', () => { if (mode === 'side') sideMoved = true; });
  controlsTop.enabled = false;

  for (const n of ['static', 'canal', 'building', 'overlay', 'grid']) {
    const g = new THREE.Group(); g.name = n; scene.add(g);
  }
  staticGroup = scene.getObjectByName('static'); canalGroup = scene.getObjectByName('canal');
  buildingGroup = scene.getObjectByName('building'); overlayGroup = scene.getObjectByName('overlay');
  gridGroup = scene.getObjectByName('grid');

  new ResizeObserver(resize).observe(host);
  applyTheme();
  resize();
  requestAnimationFrame(loop);

  if (hooks.onFrame) frameCbs.push(hooks.onFrame);
  setupPick();
  loadModels().then((n) => { modelsReady = n > 0; staticSig = ''; rebuild(); }).catch((e) => console.warn('models', e));
  return { setView, setTheme, getView: () => mode, resize, invalidate, flyTo, resetCamera, project, three: { THREE, scene } };
}

function loop() {
  if (needsRender) { needsRender = false; renderer.render(scene, mode === '3d' ? persp : ortho); for (const cb of frameCbs) cb(); }
  requestAnimationFrame(loop);
}
const invalidate = () => { needsRender = true; };

function resize() {
  const w = Math.max(host.clientWidth, 1), h = Math.max(host.clientHeight, 1);
  renderer.setSize(w, h, false);
  renderer.domElement.style.width = '100%'; renderer.domElement.style.height = '100%';
  persp.aspect = w / h; persp.updateProjectionMatrix();
  if (params) { if (mode === 'side') fitSide(); else fitTop(); if (!userMoved) fit3d(); }
  invalidate();
}

export function setTheme(isDark) { dark = isDark; applyTheme(); staticSig = ''; rebuild(); }
function applyTheme() {
  const c = COLORS[dark ? 'dark' : 'light'];
  scene.background = new THREE.Color(c.sky);
  hemi.color.set(c.hemiSky); hemi.groundColor.set(c.hemiGround); hemi.intensity = c.hemi; sun.intensity = c.sun;
  invalidate();
}

// ---------- กล้อง ----------
function lotCenter() { return params ? new THREE.Vector3(params.lot.width / 2, 0, -params.lot.depth / 2) : new THREE.Vector3(); }

function fit3d() {
  if (hooks.fit3d) {
    const f = hooks.fit3d(params, (host.clientWidth || 1) / (host.clientHeight || 1));
    persp.position.set(f.pos.x, f.pos.y, -f.pos.z);
    controls3d.target.set(f.target.x, f.target.y, -f.target.z);
    controls3d.update();
    return;
  }
  const { lot } = params;
  const c = lotCenter();
  const span = Math.max(lot.width, lot.depth);
  const aspect = (host.clientWidth || 1) / (host.clientHeight || 1);
  const k = Math.max(1, 1.1 / aspect); // จอแคบ (มือถือ) ถอยกล้องออกให้เห็นที่ดินครบ
  persp.position.set(c.x + span * 0.35 * k, span * 1.25 * k, c.z + span * 1.05 * k + 12);
  controls3d.target.set(c.x, 0, c.z + lot.depth * 0.05);
  controls3d.update();
}

function fitTop() {
  const { lot, road, canal } = params;
  const w = host.clientWidth || 1, h = host.clientHeight || 1;
  const zMin = -road.width - 2, zMax = lot.depth + (canal ? canal.width : 0) + 2;
  const xMin = -7, xMax = lot.width + 7;
  const needW = xMax - xMin, needH = zMax - zMin;
  const aspect = w / h;
  let halfH = needH / 2, halfW = halfH * aspect;
  if (halfW < needW / 2) { halfW = needW / 2; halfH = halfW / aspect; }
  ortho.left = -halfW; ortho.right = halfW; ortho.top = halfH; ortho.bottom = -halfH;
  ortho.zoom = 1;
  const cx = (xMin + xMax) / 2, cz = -(zMin + zMax) / 2;
  ortho.up.set(0, 0, -1);
  ortho.position.set(cx, 200, cz);
  controlsTop.target.set(cx, 0, cz);
  ortho.updateProjectionMatrix();
  controlsTop.update();
  invalidate();
}

// มุม 'side': มองด้านข้างตรงๆ (กล้องขนาน ไม่มีมุมเอียง) เห็นความสูงอ่านเมตรได้ · ใช้เมื่อบทใส่ hooks.sideBounds
function fitSide() {
  const b = hooks.sideBounds(params);
  const aspect = (host.clientWidth || 1) / (host.clientHeight || 1);
  const cx = (b.x0 + b.x1) / 2, cy = (b.y0 + b.y1) / 2;
  let halfH = (b.y1 - b.y0) / 2, halfW = halfH * aspect;
  if (halfW < (b.x1 - b.x0) / 2) { halfW = (b.x1 - b.x0) / 2; halfH = halfW / aspect; }
  ortho.left = -halfW; ortho.right = halfW; ortho.top = halfH; ortho.bottom = -halfH;
  ortho.zoom = 1;
  ortho.up.set(0, 1, 0);
  ortho.position.set(cx, cy, 300); // กล้องอยู่ฝั่งถนน (three +z) มองไปทาง -z
  controlsTop.target.set(cx, cy, 0);
  ortho.updateProjectionMatrix();
  controlsTop.update();
  invalidate();
}

export function setView(m) {
  mode = m;
  sideMoved = false;
  controls3d.enabled = m === '3d';
  controlsTop.enabled = m === 'top' || m === 'side';
  if (params) { if (m === 'top') fitTop(); else if (m === 'side') fitSide(); else fit3d(); }
  gridGroup.visible = true;
  rebuildGrid();
  invalidate();
}

// ---------- ขยายสำหรับบทที่มีฉากโต้ตอบ (บทระยะร่นไม่ใช้) ----------
// กล้องไหลไปมุมใหม่: pos/target เป็นพิกัดฉาก (x, y สูง, z ลึกจากถนน) — แปลงเป็นพิกัด three ให้เอง
let tween = null;
export function flyTo(pos, target, ms = 750) {
  if (mode !== '3d') return;
  userMoved = true;
  const p1 = new THREE.Vector3(pos.x, pos.y, -pos.z), t1 = new THREE.Vector3(target.x, target.y, -target.z);
  const p0 = persp.position.clone(), t0 = controls3d.target.clone(), start = performance.now();
  tween = { id: (tween?.id || 0) + 1 };
  const id = tween.id;
  const step = (now) => {
    if (!tween || tween.id !== id) return;
    const k = Math.min(1, (now - start) / ms), e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
    persp.position.lerpVectors(p0, p1, e); controls3d.target.lerpVectors(t0, t1, e); controls3d.update(); invalidate();
    if (k < 1) requestAnimationFrame(step); else tween = null;
  };
  requestAnimationFrame(step);
}
export function resetCamera() { if (params && mode === '3d') { tween = null; userMoved = false; fit3d(); invalidate(); } }
// พิกัดฉาก → พิกเซลในกล่องภาพ (ใช้วางจุดกดแบบ DOM ทับฉาก)
const _v = new THREE.Vector3();
export function project(x, y, z) {
  _v.set(x, y, -z).project(mode === '3d' ? persp : ortho);
  return { x: (_v.x * 0.5 + 0.5) * host.clientWidth, y: (-_v.y * 0.5 + 0.5) * host.clientHeight, visible: _v.z < 1 && _v.z > -1 };
}
// กดชิ้นส่วนในฉาก: แยกการ "กด" ออกจากการ "ลากหมุน" แล้วหา userData.part ของชิ้นที่โดน
function setupPick() {
  if (!hooks.onPick) return;
  const el = renderer.domElement, ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  let down = null;
  el.addEventListener('pointerdown', (e) => { down = { x: e.clientX, y: e.clientY }; });
  el.addEventListener('pointerup', (e) => {
    if (!down || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 5) { down = null; return; }
    down = null;
    const r = el.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, mode === '3d' ? persp : ortho);
    for (const h of ray.intersectObjects(buildingGroup.children, true)) {
      for (let o = h.object; o; o = o.parent) if (o.userData?.part) { hooks.onPick(o.userData.part); return; }
    }
  });
}

// ---------- ฟังก์ชันเดียวที่ภายนอกเรียก ----------
export function updateScene(sceneParams, ruleResults, options = {}) {
  const first = !params;
  params = sceneParams; results = ruleResults || []; opts = options;
  if (first) { fit3d(); fitTop(); }
  else if (hooks.fit3d && mode === '3d' && !userMoved) fit3d(); // อาคารเปลี่ยนขนาด → กล้องถอย/เข้าตาม ถ้าผู้เรียนยังไม่ได้ลากเอง
  if (mode === 'side' && !sideMoved) fitSide();
  rebuild();
}

function rebuild() {
  if (!params) return;
  const sig = JSON.stringify([params.lot, params.road, params.canal, modelsReady, dark]);
  if (sig !== staticSig) { staticSig = sig; buildStatic(); rebuildGrid(); }
  buildBuilding();
  disposeGroup(overlayGroup);
  (hooks.buildOverlay || buildOverlay)(overlayGroup, params, results, opts);
  invalidate();
}

// ---------- วัสดุ/ตัวช่วย ----------
function mat(color, extra = {}) { return new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.95, metalness: 0, ...extra }); }
function slab(x0, z0, x1, z1, y, color, thick = 0.02) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, thick, z1 - z0), mat(color));
  m.position.set((x0 + x1) / 2, y - thick / 2, -(z0 + z1) / 2);
  return m;
}

function buildStatic() {
  disposeGroup(staticGroup); disposeGroup(canalGroup);
  const c = COLORS[dark ? 'dark' : 'light'];
  if (hooks.buildStatic) { hooks.buildStatic(staticGroup, params, { dark, colors: c }); return; }
  const { lot, road, canal } = params;
  const W = lot.width, D = lot.depth, R = road.width;
  const cw = canal ? canal.width : 0;
  const X0 = -70, X1 = W + 70;

  // พื้นหญ้า ด้านหน้าถนน / ด้านหลังคลอง
  staticGroup.add(slab(X0, -R - 70, X1, -R, 0, c.ground, 0.4));
  staticGroup.add(slab(X0, 0, X1, D, 0, c.ground, 0.4));
  canalGroup.add(slab(X0, D + cw, X1, D + cw + 70, 0, c.ground, 0.4));
  // ถนน + เส้นกลาง
  staticGroup.add(slab(X0, -R, X1, 0, 0.03, c.road, 0.1));
  for (let x = X0 + 1; x < X1 - 2; x += 5) staticGroup.add(slab(x, -R / 2 - 0.1, x + 2.5, -R / 2 + 0.1, 0.05, 0xf2f2f2, 0.02));
  // ทางเท้าข้างที่ดิน (ซ้าย/ขวา) กว้าง 2 ม.
  staticGroup.add(slab(X0, 0, 0, 2, 0.04, c.sidewalk, 0.06));
  staticGroup.add(slab(W, 0, X1, 2, 0.04, c.sidewalk, 0.06));
  // ที่ดิน
  staticGroup.add(slab(0, 0, W, D, 0.045, c.lot, 0.06));
  // เส้นเขตที่ดิน (ริบบิ้นทึบ)
  const edge = 0.25, ec = dark ? 0xf0e6c0 : 0x3a3a3a;
  staticGroup.add(slab(-edge / 2, -edge / 2, W + edge / 2, edge / 2, 0.09, ec, 0.04));
  staticGroup.add(slab(-edge / 2, D - edge / 2, W + edge / 2, D + edge / 2, 0.09, ec, 0.04));
  staticGroup.add(slab(-edge / 2, 0, edge / 2, D, 0.09, ec, 0.04));
  staticGroup.add(slab(W - edge / 2, 0, W + edge / 2, D, 0.09, ec, 0.04));

  // คลอง: ผนังตลิ่ง 2 ฝั่ง + ผิวน้ำ
  if (cw > 0) {
    const depthY = 1.4;
    const water = new THREE.Mesh(new THREE.BoxGeometry(X1 - X0, 0.05, cw), mat(c.water, { roughness: 0.4, metalness: 0.1 }));
    water.position.set((X0 + X1) / 2, -depthY, -(D + cw / 2));
    canalGroup.add(water);
    for (const zz of [D, D + cw]) {
      const wall = new THREE.Mesh(new THREE.BoxGeometry(X1 - X0, depthY, 0.3), mat(c.wall));
      wall.position.set((X0 + X1) / 2, -depthY / 2, -zz);
      canalGroup.add(wall);
    }
    // ขอบตลิ่ง
    canalGroup.add(slab(X0, D - 0.3, X1, D, 0.06, c.wall, 0.06));
    canalGroup.add(slab(X0, D + cw, X1, D + cw + 0.3, 0.06, c.wall, 0.06));
    const lab = makeLabel(`คลองกว้าง ${fmt(cw)} ม.`, { fg: '#ffffff', bg: 'rgba(20,60,100,0.85)', h: 1.7 });
    lab.position.set(W * 0.9, -depthY + 0.6, -(D + cw / 2));
    canalGroup.add(lab);
  }

  if (modelsReady) buildProps(W, D, R, cw);
}

const fmt = (n) => (Math.round(n * 10) / 10).toString();

function add(g, m) { if (m) g.add(m); return m; }

function buildProps(W, D, R, cw) {
  const g = staticGroup;
  // ตึกแถวข้างเคียง ซ้าย-ขวา (ถอยหลัง 2 ม. จากถนน) ลึกไม่เกินที่ดิน
  const depth = Math.min(16, D * 0.6), sz = depth / 4, z0 = 2;
  const leftSeq = ['two-storey', 'three-storey', 'two-storey'];
  const rightSeq = ['two-storey', 'three-storey', 'corner'];
  leftSeq.forEach((p, i) => add(g, makeModel(p, { x: -2 - 4 * i, z: z0 + depth / 2, sz })));
  rightSeq.forEach((p, i) => add(g, makeModel(p, { x: W + 2 + 4 * i, z: z0 + depth / 2, sz })));
  // รั้วท้ายตึกแถว
  for (let i = 0; i < 3; i++) {
    add(g, makeModel('concrete-block-wall', { x: -2 - 4 * i, z: D - 0.5 }));
    add(g, makeModel('concrete-block-wall', { x: W + 2 + 4 * i, z: D - 0.5 }));
  }
  // เสาไฟ ริมถนน
  add(g, makeModel('street-lamp', { x: -0.9, z: 0.8 }));
  add(g, makeModel('street-lamp', { x: W + 0.9, z: 0.8, rotY: Math.PI }));
  // ต้นไม้ ท้ายแถว + ริมคลองฝั่งตรงข้าม
  add(g, makeModel('broad-canopy', { x: -16, z: 7 }));
  add(g, makeModel('broad-canopy', { x: W + 16, z: 8 }));
  add(g, makeModel('ornamental-front', { x: -20, z: 19 }));
  add(g, makeModel('ornamental-front', { x: W + 20, z: 20 }));
  if (cw > 0) {
    for (const x of [-6, W * 0.35, W + 8]) add(g, makeModel('broad-canopy', { x, z: D + cw + 5, scale: 0.9 }));
    for (const x of [W * 0.15, W * 0.7]) add(g, makeModel('trimmed-foundation', { x, z: D + cw + 2 }));
  }
  // พุ่มไม้ + คน หน้าตึกแถว
  add(g, makeModel('potted-shrub', { x: -4.3, z: 1.3 }));
  add(g, makeModel('potted-shrub', { x: W + 3.7, z: 1.3 }));
  add(g, makeModel('shopkeeper', { x: -6.4, z: 1.2 }));
  add(g, makeModel('street-vendor', { x: W + 6.4, z: 1.2 }));
  add(g, makeModel('suburban-resident', { x: -10, z: 1.2 }));
  // รถบนถนน (โมเดลหันหน้า +z → หมุน 90° ให้วิ่งตามแนวถนน)
  const lane1 = -R * 0.27, lane2 = -R * 0.73;
  add(g, makeModel('city-taxi', { x: W * 0.5, z: lane1, rotY: Math.PI / 2 }));
  add(g, makeModel('family-crossover', { x: -10, z: lane2, rotY: -Math.PI / 2 }));
  add(g, makeModel('delivery-moped', { x: W + 9, z: lane2, rotY: -Math.PI / 2 }));
  add(g, makeModel('family-crossover', { x: W + 15, z: lane1, rotY: Math.PI / 2 }));
}

function buildBuilding() {
  disposeGroup(buildingGroup);
  if (hooks.buildBuilding) { hooks.buildBuilding(buildingGroup, params, opts); return; }
  const b = params.building;
  const m = new THREE.Mesh(new THREE.BoxGeometry(b.width, b.height, b.depth),
    new THREE.MeshStandardMaterial({ color: 0xff7a1a, flatShading: true, roughness: 0.8, transparent: true, opacity: 0.88 }));
  const cx = b.x + b.width / 2, cz = b.z + b.depth / 2;
  m.position.set(cx, b.height / 2, -cz);
  buildingGroup.add(m);
  const lineMat = new THREE.LineBasicMaterial({ color: 0x5a2400 });
  const edges = new THREE.LineSegments(new THREE.EdgesGeometry(m.geometry), lineMat);
  edges.position.copy(m.position);
  buildingGroup.add(edges);
  // เส้นชั้น
  const floors = Math.max(1, b.floors | 0);
  for (let k = 1; k < floors; k++) {
    const y = (b.height * k) / floors, x0 = b.x, x1 = b.x + b.width, z0 = -b.z, z1 = -(b.z + b.depth);
    const geo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(x0, y, z0), new THREE.Vector3(x1, y, z0), new THREE.Vector3(x1, y, z1), new THREE.Vector3(x0, y, z1), new THREE.Vector3(x0, y, z0),
    ]);
    buildingGroup.add(new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0x5a2400 })));
  }
  const lab = makeLabel(`อาคารหลัก ${floors} ชั้น · สูง ${fmt(b.height)} ม.`, { fg: '#ffffff', bg: 'rgba(160,60,0,0.92)', h: 1.8 });
  lab.position.set(cx, b.height + 1.6, -cz);
  buildingGroup.add(lab);
}

// ไม้บรรทัด/กริด 1 ม. จางๆ บนที่ดิน + เลขบอกระยะทุก 5 ม. (เฉพาะมองจากด้านบน)
function rebuildGrid() {
  disposeGroup(gridGroup);
  if (!params) return;
  const { lot } = params;
  const top = mode === 'top';
  const pts1 = [], pts5 = [];
  for (let x = 0; x <= lot.width + 1e-6; x++) (x % 5 === 0 ? pts5 : pts1).push(new THREE.Vector3(x, 0.1, 0), new THREE.Vector3(x, 0.1, -lot.depth));
  for (let z = 0; z <= lot.depth + 1e-6; z++) (z % 5 === 0 ? pts5 : pts1).push(new THREE.Vector3(0, 0.1, -z), new THREE.Vector3(lot.width, 0.1, -z));
  const col = dark ? 0xffffff : 0x000000;
  gridGroup.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts1), new THREE.LineBasicMaterial({ color: col, transparent: true, opacity: top ? 0.1 : 0.05 })));
  gridGroup.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts5), new THREE.LineBasicMaterial({ color: col, transparent: true, opacity: top ? 0.28 : 0.12 })));
  if (top) {
    for (let x = 5; x <= lot.width; x += 5) { const l = makeLabel(`${x}`, { fg: '#222', bg: 'rgba(255,255,255,0.7)', h: 0.9 }); l.position.set(x, 0.2, 1.1); gridGroup.add(l); }
    for (let z = 5; z <= lot.depth; z += 5) { const l = makeLabel(`${z}`, { fg: '#222', bg: 'rgba(255,255,255,0.7)', h: 0.9 }); l.position.set(-1.1, 0.2, -z); gridGroup.add(l); }
  }
}

// ให้ภายนอก (ภาพหน้าจอ / debug) ใช้
export const _debug = { get scene() { return scene; } };
