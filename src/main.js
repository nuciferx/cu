import { initScene, updateScene } from './scene/index.js';
import { checkRules } from './rules/check.js';
import { RULES } from './rules/setback-rules.js';
import { STEPS } from './lesson/steps.js';
import credits from '../assets/polyfork/credits.json';
import { $, esc, renderCredits, initTheme, showLawBox, renderStepHead, bindStepNav, bindViewButtons } from './shared/ui.js';

const DEFAULTS = { lotW: 16, lotD: 30, road: 8, canal: 8, bx: 4, bz: 14, bw: 8, bd: 12, height: 7 };
const state = { ...DEFAULTS };
let focusRuleId = null;
let api = null;
let stepIdx = 0;
let SLIDERS = [];
const step = () => STEPS[stepIdx];

// นิยามตัวเลื่อนทั้งหมด (ขั้นไหนใช้ตัวไหน ดู src/lesson/steps.js)
const SLIDER_DEFS = [
  { key: 'canal', label: 'ความกว้างคลอง', min: 0, max: 30, step: 0.5, unit: 'ม.', hint: '0 = ไม่ติดคลอง' },
  { key: 'height', label: 'ความสูงอาคาร', min: 3, max: 30, step: 0.5, unit: 'ม.' },
  { key: 'bz', label: 'ตำแหน่งอาคาร z (ระยะห่างจากถนน)', min: 0, max: () => state.lotD - state.bd, step: 0.5, unit: 'ม.' },
  { key: 'bx', label: 'ตำแหน่งอาคาร x (ห่างเขตซ้าย)', min: 0, max: () => state.lotW - state.bw, step: 0.5, unit: 'ม.' },
  { key: 'bw', label: 'ความกว้างอาคาร', min: 3, max: () => state.lotW, step: 0.5, unit: 'ม.' },
  { key: 'bd', label: 'ความลึกอาคาร', min: 3, max: () => state.lotD, step: 0.5, unit: 'ม.' },
];
const resolve = (v) => (typeof v === 'function' ? v() : v);

const WORD = { true: 'ผ่าน', false: 'ไม่ผ่าน', null: 'ไม่เกี่ยว/ยังไม่ตัดสิน' };
const CLS = { true: 'pass', false: 'fail', null: 'unk' };
const n1 = (v) => (Math.round(v * 100) / 100).toString();

function sceneParams() {
  const floors = Math.max(1, Math.round(state.height / 3.5));
  return {
    lot: { width: state.lotW, depth: state.lotD },
    road: { width: state.road },
    canal: state.canal > 0 ? { width: state.canal } : null,
    building: { x: state.bx, z: state.bz, width: state.bw, depth: state.bd, floors, height: state.height, use: 'residential' },
  };
}

function clampAll() {
  state.bw = Math.min(Math.max(state.bw, 3), state.lotW);
  state.bd = Math.min(Math.max(state.bd, 3), state.lotD);
  state.bx = Math.min(Math.max(state.bx, 0), state.lotW - state.bw);
  state.bz = Math.min(Math.max(state.bz, 0), state.lotD - state.bd);
}

function refresh() {
  clampAll();
  syncSliders();
  const p = sceneParams();
  const all = checkRules(p);
  const show = step().showRules;
  const results = show === 'all' ? all : all.filter((r) => show.includes(r.id));
  updateScene(p, results, { focusRuleId });
  renderRules(results);
}

// ใช้ SceneParams บางส่วนของขั้นกับ state
function applyInitial(init) {
  if (init.canal !== undefined) state.canal = init.canal ? init.canal.width : 0;
  if (init.lot) { state.lotW = init.lot.width ?? state.lotW; state.lotD = init.lot.depth ?? state.lotD; }
  if (init.road) state.road = init.road.width ?? state.road;
  const b = init.building;
  if (b) for (const [k, key] of [['x', 'bx'], ['z', 'bz'], ['width', 'bw'], ['depth', 'bd'], ['height', 'height']]) if (b[k] !== undefined) state[key] = b[k];
}

function goStep(i) {
  stepIdx = Math.max(0, Math.min(STEPS.length - 1, i));
  const st = step();
  if (st.initial) { Object.assign(state, DEFAULTS); applyInitial(st.initial); }
  focusRuleId = st.focusRuleId;
  SLIDERS = st.sliders.map((k) => SLIDER_DEFS.find((d) => d.key === k));
  buildSliders();
  renderLesson();
  refresh();
}

function renderLesson() {
  const st = step();
  renderStepHead(STEPS, stepIdx);
  $('rulesnote').textContent = st.showRules === 'all'
    ? 'กดที่กฎเพื่อเน้นเฉพาะข้อนั้นในฉาก (กดซ้ำเพื่อยกเลิก)'
    : (st.showRules.length ? 'ขั้นนี้แสดงเฉพาะกฎที่กำลังเรียน' : 'ขั้นนี้ยังไม่ตรวจกฎ กด "ถัดไป" เพื่อดูผล');
}

// ---------- ตัวเลื่อน ----------
function buildSliders() {
  const box = $('sliders');
  box.innerHTML = SLIDERS.length ? '' : '<p class="note">ขั้นนี้ไม่มีตัวเลื่อน — ลองหมุนดูฉาก หรือสลับมุมมองด้านบนซ้ายของภาพ</p>';
  for (const s of SLIDERS) {
    const wrap = document.createElement('div');
    wrap.className = 'sl';
    wrap.innerHTML = `<label for="r-${s.key}">${s.label}${s.hint ? ` <small>(${s.hint})</small>` : ''}</label>
      <span class="num"><input type="number" id="n-${s.key}" step="${s.step}" inputmode="decimal"> ${s.unit}</span>
      <input type="range" id="r-${s.key}" step="${s.step}">`;
    box.appendChild(wrap);
    const r = wrap.querySelector('[type=range]'), n = wrap.querySelector('[type=number]');
    const set = (v) => { if (Number.isFinite(v)) { state[s.key] = v; refresh(); } };
    r.addEventListener('input', () => set(parseFloat(r.value)));
    n.addEventListener('input', () => set(parseFloat(n.value)));
  }
}
function syncSliders() {
  for (const s of SLIDERS) {
    const r = $('r-' + s.key), n = $('n-' + s.key);
    const max = resolve(s.max), min = resolve(s.min);
    r.min = n.min = min; r.max = n.max = max;
    r.value = state[s.key];
    if (document.activeElement !== n) n.value = state[s.key];
  }
}

// ---------- รายการผลรายกฎ ----------
const ruleOf = (id) => RULES.find((r) => r.id === id);
const lawBtn = (id, i) => `<button type="button" class="lawbtn" data-law="${esc(id)}" data-i="${i}">ดูตัวบท</button>`;
const badge = (p) => `<span class="badge ${CLS[p]}">${WORD[p]}</span>`;
const chip = '<span class="chip">จุดที่ต้องตรวจ</span>';

// กฎที่ว่าง: แสดงทั้ง 2 แบบ (ข้อบัญญัติ กทม. = เทียบที่ดิน · ฉบับที่ 55 = เทียบชั้นใหญ่สุด)
// ข้อบัญญัติ = alternateSources[0] · ฉบับที่ 55 = source หลักของกฎ
// ป้ายอ้างมาตรา ดึงจาก source / alternateSources ใน RULES (ไม่พิมพ์เลขข้อตายในโค้ด)
const shortLaw = (law) => law.replace(/\s*\(พ\.ศ\.[^)]*\)/, '').replace(/^ข้อบัญญัติกรุงเทพมหานคร.*$/, 'ข้อบัญญัติ กทม.').replace('กฎกระทรวง ฉบับ', 'กฎกระทรวงฉบับ');
const refOf = (s) => `${shortLaw(s.law)} ${s.clause.replace(/\s+\(/, '(')}`;
function openAreaBody(r) {
  const pct = n1(r.required);
  const a = r.alt;
  const rule = ruleOf(r.id);
  const bylawRef = refOf(rule.alternateSources[0]);
  const ministryRef = refOf(rule.source);
  return `<p class="sub-row"><span>${esc(bylawRef)}: ${pct}% ของที่ดิน — ต้องการ ${pct}% · มีอยู่ ${r.actual != null ? n1(r.actual) : '-'}%</span>
      <span>${badge(r.pass)} ${lawBtn(r.id, 0)}</span></p>
    ${a ? `<p class="sub-row"><span>${esc(ministryRef)}: ${pct}% ของพื้นที่ชั้นใหญ่สุด — ต้องการ ${n1(a.requiredArea)} ตร.ม. · มีอยู่ ${n1(a.actualArea)} ตร.ม.</span>
      <span>${badge(a.pass)} ${lawBtn(r.id, -1)}</span></p>` : ''}`;
}

function renderRules(results) {
  const ul = $('rules');
  ul.innerHTML = results.length ? results.map((r) => {
    const cls = CLS[r.pass];
    const two = r.id === 'open-area-residential' && r.pass !== null;
    const body = two ? openAreaBody(r) : `<p class="msg">${esc(r.message)}</p>
      <p class="src">ที่มา: ${esc(r.source.law)} ${esc(r.source.clause)} · ${lawBtn(r.id, -1)}${r.slides?.length ? ` · สไลด์ ${r.slides.join(', ')}` : ''}</p>`;
    return `<li class="rule ${cls}${focusRuleId === r.id ? ' focus' : ''}" data-id="${esc(r.id)}">
      <div class="row"><span class="t">${esc(r.title)}${r.needsReview ? chip : ''}</span>${two ? '' : badge(r.pass)}</div>
      ${body}</li>`;
  }).join('') : '<li class="note">ยังไม่มีผลให้ดูในขั้นนี้</li>';
}

// กฎอื่นที่ยังไม่มีภาพในฉาก (inScene:false) — เนื้อหาอ่านอย่างเดียว
function renderOthers() {
  $('otherlist').innerHTML = RULES.filter((r) => !r.inScene).map((r) => `<li class="rule" data-id="${esc(r.id)}">
    <div class="row"><span class="t">${esc(r.title)}${r.status === 'needs-review' ? chip : ''}</span></div>
    <p class="msg">${esc(r.explain)}</p>
    <p class="src">ที่มา: ${esc(r.source.law)} ${esc(r.source.clause)} · ${lawBtn(r.id, -1)} · สไลด์ ${r.slides.join(', ')}</p>
    ${r.status === 'needs-review' ? `<p class="review">จุดที่ต้องตรวจ: ${esc(r.reviewNote)}</p>` : ''}</li>`).join('');
}

// กล่องดูตัวบท: i = -1 ตัวบทหลักของกฎ · i >= 0 ตัวบทอื่นใน alternateSources
function showLaw(id, i) {
  const r = ruleOf(id);
  const s = i < 0 ? r.source : r.alternateSources[i];
  showLawBox({ title: r.title, law: s.law, clause: s.clause, text: s.text });
}

let setView;

async function start() {
  renderCredits(credits);
  const theme = initTheme((d) => api?.setTheme(d));
  api = await initScene($('view'));
  api.setTheme(theme.isDark());
  setView = bindViewButtons(() => api);
  renderOthers();
  goStep(0);
  bindStepNav(() => stepIdx, goStep);
  $('reset').addEventListener('click', () => {
    Object.assign(state, DEFAULTS);
    if (step().initial) applyInitial(step().initial);
    focusRuleId = step().focusRuleId;
    refresh();
  });
  document.addEventListener('click', (e) => {
    const b = e.target.closest('.lawbtn'); if (b) showLaw(b.dataset.law, +b.dataset.i);
  });
  $('rules').addEventListener('click', (e) => {
    if (e.target.closest('.lawbtn') || step().showRules !== 'all') return;
    const li = e.target.closest('.rule'); if (!li) return;
    focusRuleId = focusRuleId === li.dataset.id ? null : li.dataset.id;
    refresh();
  });
  // ตัวช่วยดีบัก/ถ่ายภาพ: มีเฉพาะตอน dev หรือใส่ ?debug ใน URL — ไม่มีในการใช้งานปกติ
  if (import.meta.env.DEV || new URLSearchParams(location.search).has('debug')) {
    window.__cu = { state, refresh, setView, goStep, STEPS };
  }
}
start();
