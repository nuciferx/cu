// บทที่ 2 "อาคารขนาดใหญ่ · อาคารสูง" (สไลด์ 12, 14) — หน้าโต้ตอบ: ฉากอาคารหลังเดียว + ตัวเลื่อน + ผลจำแนกรายเกณฑ์
// รูปแบบเดียวกับบทระยะร่น (main.js ของราก) ใช้โมดูลกลาง: scene/index.js · shared/ui.js · rules/classify.js
import { initScene, updateScene } from '../../scene/index.js';
import { classifyBuilding, measure, fmt, fmtM } from '../../rules/classify.js';
import { RULES, ruleById } from '../../rules/building-class-rules.js';
import { STEPS } from './steps.js';
import { LOT, NEARBY, SLIDE12 } from '../../content/lesson02.js';
import { buildStatic, buildBuilding, buildOverlay, fit3d, sideBounds, CAMERA } from './building.js';
import credits from '../../../assets/polyfork/credits.json';
import { $, esc, renderCredits, initTheme, showLawBox, renderStepHead, bindStepNav, bindViewButtons } from '../../shared/ui.js';

// สถานะ = ค่าที่ผู้เรียนปรับ · preset = ใช้พื้นที่แต่ละชั้นตามสไลด์ 12 (ต่างกันทุกชั้น) จนกว่าจะขยับตัวเลื่อนชั้น/กว้าง/ลึก
const DEFAULTS = { floors: 5, floorH: 2.98, bw: 22.5, bd: 20, deck: 120, countDeck: false, roofType: 'flat', ridge: 4, preset: true };
const state = { ...DEFAULTS };
let api = null, stepIdx = 0, view = '3d', dark = false;
const step = () => STEPS[stepIdx];

const topArea = () => (state.preset ? SLIDE12.floorAreas[SLIDE12.floorAreas.length - 1] : state.bw * state.bd);
const RANGES = {
  floors: { label: 'จำนวนชั้น', min: 1, max: 40, step: 1, unit: 'ชั้น' },
  floorH: { label: 'ความสูงต่อชั้น', min: 2.4, max: 6, step: 0.01, unit: 'ม.', dec: 3 },
  bw: { label: 'ความกว้างพื้นต่อชั้น', min: 5, max: 60, step: 0.5, unit: 'ม.' },
  bd: { label: 'ความลึกพื้นต่อชั้น', min: 5, max: 60, step: 0.5, unit: 'ม.' },
  deck: { label: 'พื้นที่ดาดฟ้า', min: 0, max: () => Math.max(0, Math.round(topArea())), step: 5, unit: 'ตร.ม.', hint: 'ไม่เกินพื้นที่ชั้นบนสุด' },
  ridge: { label: 'ความสูงของยอดจั่วเหนือยอดผนัง', min: 0, max: 12, step: 0.5, unit: 'ม.' },
};
const resolve = (v) => (typeof v === 'function' ? v() : v);

// ---------- ค่า → พารามิเตอร์ของตัวจำแนก / ฉาก ----------
function buildingParams() {
  const p = {
    floors: state.floors, floorHeight: state.floorH, footprint: { width: state.bw, depth: state.bd },
    roof: { type: state.roofType, ridgeHeight: state.ridge }, roofDeckArea: state.deck, countRoofDeck: state.countDeck,
  };
  if (state.preset) p.floorAreas = SLIDE12.floorAreas;
  return p;
}
function sceneParams(m, shown) {
  const depth = state.preset ? SLIDE12.depth : state.bd;
  const wmax = Math.max(...m.areas) / depth;
  return {
    lot: { width: LOT, depth: LOT }, road: { width: 0 }, canal: null,
    levelMax: Math.max(0, ...shown.filter((r) => r.geometry?.kind === 'height').map((r) => r.geometry.level)),
    building: { x: (LOT - wmax) / 2, z: (LOT - depth) / 2, width: wmax, depth, floors: m.floors, height: m.height },
    shape: { areas: m.areas, depth, floorHeight: state.floorH, roofType: m.roofType, ridge: state.ridge, deckArea: m.deckArea, countDeck: m.countDeck },
  };
}

function clampAll() {
  if (state.preset) { state.floors = SLIDE12.floorAreas.length; state.bw = SLIDE12.floorAreas[0] / SLIDE12.depth; state.bd = SLIDE12.depth; }
  state.deck = Math.min(Math.max(state.deck, 0), Math.max(0, topArea()));
}

function refresh() {
  clampAll();
  const bp = buildingParams();
  const m = measure(bp);
  const all = classifyBuilding(bp);
  const show = step().showRules;
  const shown = show === 'all' ? all : all.filter((r) => show.includes(r.id));
  const sp = sceneParams(m, shown);
  updateScene(sp, shown, { dark, mode: view, colorBy: step().colorBy, roofStructures: step().roofStructures && m.roofType === 'flat', results: all });
  syncControls();
  renderMeters(m, all);
  renderRules(shown, all);
  $('derived').textContent = `พื้นที่ต่อชั้น ${state.preset ? 'ต่างกันทุกชั้นตามสไลด์ 12 (' + m.areas.map(fmt).join(', ') + ')' : fmt(state.bw * state.bd) + ' ตร.ม. (กว้าง × ลึก ทุกชั้นเท่ากัน)'} · ความสูงรวม ${fmtM(m.height)} ม. (${m.floors} ชั้น × ${state.floorH.toFixed(3)} ม.)${m.roofType === 'gable' ? ' · วัดถึงยอดผนังของชั้นสูงสุด' : ' · วัดถึงพื้นดาดฟ้า'}`;
}

function goStep(i) {
  stepIdx = Math.max(0, Math.min(STEPS.length - 1, i));
  const st = step();
  if (st.initial) { Object.assign(state, DEFAULTS, st.initial); }
  buildControls();
  renderStepHead(STEPS, stepIdx);
  $('rulesnote').textContent = st.showRules === 'all' ? '' : 'ขั้นนี้แสดงเฉพาะเกณฑ์ที่กำลังเรียน กดข้ามไปขั้น "ลองทั้งสองเรื่อง" เพื่อดูทุกเกณฑ์พร้อมกัน';
  refresh();
  api?.resetCamera();
}

// ---------- ตัวปรับค่า ----------
function buildControls() {
  const box = $('sliders');
  box.innerHTML = '';
  for (const key of step().controls) {
    const wrap = document.createElement('div');
    if (key === 'preset') {
      wrap.className = 'sl full';
      wrap.innerHTML = '<button type="button" class="btn" id="c-preset">ใช้ตัวอย่างสไลด์ 12 (ชั้นละไม่เท่ากัน)</button>';
      wrap.querySelector('button').addEventListener('click', () => { Object.assign(state, { preset: true, floorH: SLIDE12.height / SLIDE12.floorAreas.length, deck: SLIDE12.roofDeckArea, roofType: 'flat' }); refresh(); });
    } else if (key === 'countDeck') {
      wrap.className = 'sl full';
      wrap.dataset.key = key;
      wrap.innerHTML = '<label class="chk"><input type="checkbox" id="c-countDeck"> นับพื้นที่ดาดฟ้ารวมเข้าพื้นที่อาคาร (สไลด์ 12 นับ · กฎกระทรวงฉบับที่ 33 ข้อ 1 ไม่นับ — จุดที่ต้องตรวจ)</label>';
      wrap.querySelector('input').addEventListener('change', (e) => { state.countDeck = e.target.checked; refresh(); });
    } else if (key === 'roofType') {
      wrap.className = 'sl full';
      wrap.innerHTML = `<span class="seglabel">ชนิดหลังคา</span><div class="segs" role="group" aria-label="ชนิดหลังคา">
        <button type="button" class="btn seg" data-v="flat">หลังคาแบน (มีพื้นดาดฟ้า)</button><button type="button" class="btn seg" data-v="gable">ทรงจั่วหรือปั้นหยา</button></div>`;
      wrap.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => { state.roofType = b.dataset.v; refresh(); }));
    } else {
      const s = RANGES[key];
      wrap.className = 'sl';
      wrap.dataset.key = key;
      wrap.innerHTML = `<label for="r-${key}">${s.label}${s.hint ? ` <small>(${s.hint})</small>` : ''}</label>
        <span class="num"><input type="number" id="n-${key}" step="${s.step === 1 ? 1 : 'any'}" inputmode="decimal"> ${s.unit}</span>
        <input type="range" id="r-${key}" step="${s.step}">`;
      const r = wrap.querySelector('[type=range]'), n = wrap.querySelector('[type=number]');
      const set = (v) => {
        if (!Number.isFinite(v)) return;
        state[key] = v;
        if (['floors', 'bw', 'bd'].includes(key)) state.preset = false; // เปลี่ยนเป็นทุกชั้นเท่ากัน
        refresh();
      };
      r.addEventListener('input', () => set(parseFloat(r.value)));
      n.addEventListener('input', () => set(parseFloat(n.value)));
    }
    box.appendChild(wrap);
  }
}
function syncControls() {
  const gable = state.roofType === 'gable';
  for (const wrap of $('sliders').children) {
    const key = wrap.dataset.key;
    if (key && RANGES[key]) {
      const s = RANGES[key], r = wrap.querySelector('[type=range]'), n = wrap.querySelector('[type=number]');
      r.min = n.min = resolve(s.min); r.max = n.max = resolve(s.max);
      r.value = state[key];
      if (document.activeElement !== n) n.value = +state[key].toFixed(s.dec ?? 2);
      wrap.hidden = (key === 'deck' && gable) || (key === 'ridge' && !gable);
    }
    if (key === 'countDeck') { wrap.querySelector('input').checked = state.countDeck; wrap.hidden = gable; }
    wrap.querySelectorAll('.segs button').forEach((b) => { const on = b.dataset.v === state.roofType; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); });
  }
  const pb = $('c-preset');
  if (pb) pb.classList.toggle('on', state.preset);
}

// ---------- ตัวนับ ----------
const meterAnim = new Map();
function countTo(el, to, f = fmt) {
  const from = meterAnim.get(el)?.to ?? +el.dataset.v ?? to;
  el.dataset.v = to;
  if (meterAnim.get(el)?.raf) cancelAnimationFrame(meterAnim.get(el).raf);
  const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  if (reduce || !Number.isFinite(from) || from === to) { el.textContent = f(to); meterAnim.set(el, { to }); return; }
  const t0 = performance.now(), ms = 450, st = { to };
  meterAnim.set(el, st);
  const tick = (now) => {
    const k = Math.min(1, (now - t0) / ms), e = 1 - Math.pow(1 - k, 3);
    el.textContent = f(from + (to - from) * e);
    if (k < 1) st.raf = requestAnimationFrame(tick);
  };
  st.raf = requestAnimationFrame(tick);
}
function meterHtml(id, title, unit, marks, max) {
  const ticks = marks.map((mk) => `<u class="mt" style="left:${Math.min(100, (mk.v / max) * 100)}%"><s>${esc(mk.text)}</s></u>`).join('');
  return `<div class="meter" id="meter-${id}"><div class="mhead"><span>${esc(title)}</span><span><b class="mnum" id="mnum-${id}">0</b> ${esc(unit)}</span></div>
    <div class="mbar" role="img" aria-label="${esc(title)}"><i class="fill" id="mfill-${id}"></i>${ticks}</div><p class="msub" id="msub-${id}"></p></div>`;
}
function renderMeters(m, all) {
  const want = step().meters;
  const lp = ruleById('large').params, hp = ruleById('high').params;
  const box = $('meters');
  const key = want.join(',');
  if (box.dataset.key !== key) {
    box.dataset.key = key;
    let html = '';
    if (want.includes('area')) html += meterHtml('area', 'พื้นที่รวมที่นับ', 'ตร.ม.', [{ v: lp.areaOverWithHeight, text: fmt(lp.areaOverWithHeight) }, { v: lp.areaOverAlways, text: fmt(lp.areaOverAlways) }], lp.areaOverAlways * 1.25);
    if (want.includes('height')) html += meterHtml('height', 'ความสูงที่วัด', 'ม.', [{ v: lp.heightMin, text: fmtM(lp.heightMin) }, { v: hp.heightMin, text: fmtM(hp.heightMin) }], hp.heightMin * 1.4);
    box.innerHTML = html;
    meterAnim.clear();
  }
  const byArea = all.find((r) => r.id === 'large-by-area');
  if (want.includes('area')) {
    const max = lp.areaOverAlways * 1.25;
    $('mfill-area').style.width = `${Math.min(100, (m.total / max) * 100)}%`;
    $('mfill-area').className = `fill ${byArea.is ? 'over' : ''}`;
    countTo($('mnum-area'), m.total);
    $('msub-area').textContent = m.deckArea > 0
      ? `นับดาดฟ้า (ตามสไลด์ 12) ${fmt(m.totalWithDeck)} ตร.ม. · ไม่นับดาดฟ้า (ตามกฎกระทรวงฉบับที่ 33) ${fmt(m.totalWithoutDeck)} ตร.ม. — ตัวนับใช้แบบที่เลือกไว้`
      : `พื้นที่รวม ${m.floors} ชั้น`;
  }
  if (want.includes('height')) {
    const max = hp.heightMin * 1.4;
    $('mfill-height').style.width = `${Math.min(100, (m.height / max) * 100)}%`;
    $('mfill-height').className = `fill ${m.height >= hp.heightMin ? 'over' : ''}`;
    countTo($('mnum-height'), m.height, fmtM);
    $('msub-height').textContent = `วัดถึง${m.roofType === 'gable' ? 'ยอดผนังของชั้นสูงสุด (ไม่รวมยอดจั่ว)' : 'พื้นดาดฟ้า'}`;
  }
}

// ---------- ผลรายเกณฑ์ ----------
const ruleOfResult = (id) => ruleById(id.startsWith('large') ? 'large' : id);
const shortLaw = (law) => law.replace(/\s*\(พ\.ศ\.[^)]*\)/, '').replace(/^ข้อบัญญัติกรุงเทพมหานคร.*$/, 'ข้อบัญญัติ กทม.').replace('กฎกระทรวง ฉบับ', 'กฎกระทรวงฉบับ');
const lawBtns = (rule) => [rule.source, ...(rule.alternateSources || [])].slice(0, rule.inScene ? 2 : 4)
  .map((s, i) => `<button type="button" class="lawbtn" data-rule="${esc(rule.id)}" data-i="${i}">${esc(shortLaw(s.law))} ${esc(s.clause)}</button>`).join(' · ');
const chip = '<span class="chip">จุดที่ต้องตรวจ</span>';
const SUMMARY = new Set(['large', 'high']);
const badge = (r) => (SUMMARY.has(r.id)
  ? `<span class="badge ${r.is ? 'yes' : 'no'}">${r.is ? 'เป็น' : 'ไม่เป็น'}</span>`
  : `<span class="badge ${r.is ? 'yes' : 'no'}">${r.is ? 'เข้าเกณฑ์' : 'ไม่เข้าเกณฑ์'}</span>`);

function row(r, nested = false) {
  const rule = ruleOfResult(r.id);
  const alt = r.id === 'large-by-area' && r.alt?.differs ? `<p class="alt">ผลของทั้งสองแบบต่างกัน: นับดาดฟ้า → ${r.alt.large.withDeck ? 'เป็น' : 'ไม่เป็น'}อาคารขนาดใหญ่ · ไม่นับดาดฟ้า → ${r.alt.large.withoutDeck ? 'เป็น' : 'ไม่เป็น'}อาคารขนาดใหญ่</p>` : '';
  return `<li class="rule ${r.is ? 'yes' : 'no'}${nested ? ' nested' : ''}" data-id="${esc(r.id)}">
    <div class="row"><span class="t">${esc(r.title)}${r.needsReview ? chip : ''}</span>${badge(r)}</div>
    <p class="msg">${esc(r.message)}</p>${alt}
    ${r.needsReview && r.reviewNote ? `<p class="review">จุดที่ต้องตรวจ: ${esc(r.reviewNote)}</p>` : ''}
    <p class="src">ที่มา: ${lawBtns(rule)} · สไลด์ ${r.slides.join(', ')}</p></li>`;
}
function renderRules(shown, all) {
  const ids = new Set(shown.map((r) => r.id));
  const parts = [];
  const summary = (id) => all.find((r) => r.id === id);
  if (ids.has('large')) {
    const subs = ['large-by-area', 'large-by-height'].map(summary);
    parts.push(row(summary('large')), ...subs.map((r) => row(r, true)));
    for (const id of ['large', 'large-by-area', 'large-by-height']) ids.delete(id);
  }
  for (const r of shown) if (ids.has(r.id)) parts.push(row(r));
  $('rules').innerHTML = parts.join('');
}

// เนื้อหาอ่านอย่างเดียว: จุดที่ต้องตรวจ
function renderOthers() {
  $('otherlist').innerHTML = RULES.filter((r) => !r.inScene).map((r) => `<li class="rule" data-id="${esc(r.id)}">
    <div class="row"><span class="t">${esc(r.title)}${chip}</span></div>
    <p class="msg">${esc(r.explain)}</p>
    <p class="review">${esc(r.reviewNote)}</p>
    <p class="src">ที่มา: ${lawBtns(r)} · สไลด์ ${r.slides.join(', ')}</p></li>`).join('');
  $('nearlist').innerHTML = NEARBY.map((n) => `<li class="rule"><div class="row"><span class="t">สไลด์ ${n.slide}: ${esc(n.title)}</span></div><p class="msg">${esc(n.text)}</p><p class="src">${esc(n.note)}</p></li>`).join('');
}

function showLaw(ruleId, i) {
  const r = ruleById(ruleId);
  const s = i === 0 ? r.source : r.alternateSources[i - 1];
  showLawBox({ title: r.title, law: s.law, clause: s.clause, text: s.text });
}

async function start() {
  renderCredits(credits.filter((c) => c.slug.startsWith('suburban-resident')));
  const theme = initTheme((d) => { dark = d; api?.setTheme(d); refresh(); });
  dark = theme.isDark();
  api = await initScene($('view'), { buildStatic, buildBuilding, buildOverlay, fit3d, sideBounds, camera: CAMERA });
  api.setTheme(dark);
  const setView = bindViewButtons(() => api, [['v3d', '3d'], ['vside', 'side']], (m) => { view = m; refresh(); });
  renderOthers();
  goStep(0);
  bindStepNav(() => stepIdx, goStep);
  $('reset').addEventListener('click', () => { Object.assign(state, DEFAULTS, step().initial || {}); refresh(); });
  document.addEventListener('click', (e) => { const b = e.target.closest('.lawbtn'); if (b) showLaw(b.dataset.rule, +b.dataset.i); });
  if (import.meta.env.DEV || new URLSearchParams(location.search).has('debug')) window.__cu2 = { state, refresh, setView, goStep, STEPS, measure, classifyBuilding };
}
start();
