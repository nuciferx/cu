// บทที่ 1 "วัตถุประสงค์ของกฎหมายควบคุมอาคาร" (สไลด์ 1–2) — ตัวคุมหน้า
// 3 ขั้น: (1) ภาพรวม 3 ชั้นซ้อน (2) วัตถุประสงค์ 7 ข้อ กดแล้วกล้องไปที่ส่วนของอาคาร (3) ลองจับคู่ (ไม่เก็บคะแนน)
import { initScene, updateScene } from '../../scene/index.js';
import credits from '../../../assets/polyfork/credits.json';
import { $, esc, renderCredits, initTheme, showLawBox, renderStepHead, bindStepNav, bindViewButtons } from '../../shared/ui.js';
import { OBJECTIVES, LAW_ACT_8, REVIEW_POINTS, ACT8_EXTRA, NO_EXAMPLE, objectiveByN } from '../../content/objectives.js';
import { LAYERS, PARTS, SCENE_ONLY, SETBACK_LESSON, partsOfObjective } from '../../content/lesson01.js';
import { buildBuilding, buildOverlay, partAnchors } from './building.js';

const PARAMS = {
  lot: { width: 16, depth: 30 }, road: { width: 8 }, canal: { width: 8 },
  building: { x: 2.5, z: 9, width: 11, depth: 14, floors: 3, height: 10.5, use: 'residential' },
};
const ANCH = partAnchors(PARAMS.building);

const STEPS = [
  { id: 'overview', title: 'ภาพรวม: ผังเมืองรวม · EIA · ควบคุมอาคาร', slides: [1],
    explain: 'ปกสไลด์ 1 มีสามเรื่อง คือ ผังเมืองรวม · EIA · ควบคุมอาคาร กดปุ่มด้านล่างเพื่อเปิด/ปิดแต่ละชั้นซ้อนบนฉาก แล้วอ่านคำอธิบายที่มาจากสไลด์ บทนี้เรียนเรื่องที่สาม คือกฎหมายควบคุมอาคาร' },
  { id: 'objectives', title: 'วัตถุประสงค์ 7 ข้อของกฎหมายควบคุมอาคาร', slides: [2],
    explain: 'สไลด์ 2: กฎหมายควบคุมอาคารมีไว้ "เพื่อควบคุมเกี่ยวกับ" 7 เรื่อง กดข้อใดข้อหนึ่ง (หรือกดจุดตัวเลขบนฉาก) กล้องจะเลื่อนไปที่ส่วนของอาคารที่เกี่ยวข้อง พร้อมตัวอย่างจากสไลด์ในชุดเดียวกัน' },
  { id: 'match', title: 'ลองจับคู่: ส่วนของอาคาร ↔ วัตถุประสงค์', slides: [2],
    explain: 'กดส่วนของอาคารในฉาก (หรือกดป้ายชื่อบนฉาก) แล้วเลือกว่าตรงกับวัตถุประสงค์ข้อไหน ตอบแล้วจะบอกว่าถูกหรือผิดพร้อมเหตุผลจากสไลด์ กิจกรรมนี้ไม่เก็บคะแนน ลองกี่ครั้งก็ได้' },
];

const st = { step: 0, layers: new Set(), obj: null, quizPart: null, answered: null, dark: false };
let api = null, setView = null;
const slideRef = (arr) => `<span class="sl-ref">(สไลด์ ${arr.join(', ')})</span>`;
const chipReview = '<span class="chip">จุดที่ต้องตรวจ</span>';

// ---------- ฉาก ----------
function focusSet() {
  if (st.step === 1 && st.obj) return new Set(partsOfObjective(st.obj));
  if (st.step === 2 && st.quizPart) return new Set([st.quizPart]);
  return new Set();
}
function pushScene() {
  const focus = focusSet();
  const o = st.step === 1 && st.obj ? objectiveByN(st.obj) : null;
  updateScene(PARAMS, [], { dark: st.dark, layers: st.step === 0 ? st.layers : new Set(), focus, glowBuilding: st.step === 0 && st.layers.has('control'), glowColor: o?.color });
  positionMarkers();
}
const camFor = (partId) => {
  const a = ANCH[partId], k = 1.45; // ถอยกล้องออกจากจุดเล็งให้เห็นบริบทรอบๆ
  return { pos: { x: a.look[0] + (a.cam[0] - a.look[0]) * k, y: a.look[1] + (a.cam[1] - a.look[1]) * k, z: a.look[2] + (a.cam[2] - a.look[2]) * k }, tgt: { x: a.look[0], y: a.look[1], z: a.look[2] } };
};
function flyToPart(partId, n) {
  const b = PARAMS.building;
  // ข้อ 4 มีสองส่วน (หน้าต่าง + ถังบำบัดด้านหลัง) → มองจากด้านข้างให้เห็นทั้งคู่
  const c = n === 4 ? { pos: { x: b.x - 22, y: 13, z: b.z + b.depth + 14 }, tgt: { x: b.x + 3, y: 2.5, z: b.z + b.depth * 0.6 } } : camFor(partId);
  api.flyTo(c.pos, c.tgt);
}

// ---------- จุดกดบนฉาก (DOM ทับฉาก) ----------
let markers = []; // { el, anchor:[x,y,z], dx, dy }
function setMarkers(list) {
  $('markers').innerHTML = '';
  markers = list.map((m) => {
    const el = document.createElement('button');
    el.type = 'button'; el.className = 'mk' + (m.tag ? ' tag' : ''); el.style.setProperty('--c', m.color);
    el.textContent = m.text; el.setAttribute('aria-label', m.aria); el.dataset.key = m.key;
    el.addEventListener('click', m.onClick);
    $('markers').appendChild(el);
    return { el, anchor: m.anchor, dx: m.dx || 0, dy: m.dy || 0, key: m.key };
  });
  positionMarkers();
}
function positionMarkers() {
  if (!api) return;
  for (const m of markers) {
    const p = api.project(...m.anchor);
    m.el.hidden = !p.visible;
    m.el.style.left = `${p.x + m.dx}px`; m.el.style.top = `${p.y + m.dy}px`;
  }
}
function markObjective() {
  setMarkers(OBJECTIVES.map((o, i) => ({
    key: `o${o.n}`, text: String(o.n), color: o.color, aria: `วัตถุประสงค์ข้อ ${o.n}: ${o.name}`,
    anchor: ANCH[o.part].at, dx: o.part === 'overall' ? (o.n === 5 ? -22 : 22) : 0, dy: o.n === 4 ? 0 : 0,
    onClick: () => selectObjective(o.n),
  })));
  syncMarkerOn();
}
// ป้ายชื่อบนฉากในขั้น 3 ซ้อนกันง่ายเมื่อมองไกล → ขยับให้ไม่ทับกัน (พิกเซล)
const TAG_OFFSET = { overall: [0, -34], sign: [0, -8], septic: [30, 10], frame: [-40, 12], window: [-20, 0] };
function markParts() {
  setMarkers([...PARTS, ...SCENE_ONLY].map((p) => ({
    key: p.id, text: p.label, tag: true, color: PARTS.includes(p) ? objectiveByN(p.objective).color : '#6b7280', aria: `ส่วนของอาคาร: ${p.label}`,
    anchor: ANCH[p.id].at, dx: TAG_OFFSET[p.id]?.[0] || 0, dy: TAG_OFFSET[p.id]?.[1] || 0, onClick: () => pickPart(p.id),
  })));
  syncMarkerOn();
}
function syncMarkerOn() {
  for (const m of markers) m.el.classList.toggle('on', (st.step === 1 && m.key === `o${st.obj}`) || (st.step === 2 && m.key === st.quizPart));
}

// ---------- แผงกิจกรรม ----------
const exampleLi = (e) => `<li>${esc(e.text)} ${slideRef(e.slides)}</li>`;
function objectiveChips(active, attr = 'data-o') {
  return OBJECTIVES.map((o) => `<button type="button" class="ochip${active === o.n ? ' on' : ''}" style="--c:${o.color}" ${attr}="${o.n}" aria-pressed="${active === o.n}"><span class="no">${o.n}</span>${esc(o.name)}</button>`).join('');
}

function renderActivity() {
  const box = $('activity');
  if (st.step === 0) {
    box.innerHTML = `<h2>ชั้นภาพซ้อนบนฉาก</h2>
      <p class="note">กดเพื่อเปิด/ปิด — เปิดพร้อมกันได้</p>
      <div class="chips">${LAYERS.map((l) => `<button type="button" class="ochip layerchip${st.layers.has(l.id) ? ' on' : ''}" style="--lc:${l.color};--li:${l.ink}" data-l="${l.id}" aria-pressed="${st.layers.has(l.id)}">${esc(l.name)}</button>`).join('')}</div>
      <div id="detail">${layerDetail()}</div>`;
  } else if (st.step === 1) {
    box.innerHTML = `<h2>วัตถุประสงค์ 7 ข้อ <small class="slides">(สไลด์ 2)</small></h2>
      <div class="chips">${objectiveChips(st.obj)}</div>
      <div id="detail">${objectiveDetail()}</div>`;
  } else {
    box.innerHTML = quizHtml();
  }
}

function layerDetail() {
  const on = LAYERS.filter((l) => st.layers.has(l.id));
  if (!on.length) return '<p class="note">ยังไม่ได้เปิดชั้นใด — กดปุ่มด้านบน</p>';
  return on.map((l) => `<div class="detail" style="--c:${l.color}">
    <h3>${esc(l.name)}</h3><p class="plain">${esc(l.summary)}</p>
    <ul>${l.facts.map(exampleLi).join('')}</ul>
    <p class="legal">${esc(l.caption)}</p></div>`).join('');
}

function objectiveDetail() {
  const o = st.obj && objectiveByN(st.obj);
  const link = `<p class="legal linkbox">กฎของบท <a href="${esc(SETBACK_LESSON.href)}">${esc(SETBACK_LESSON.title)}</a> (สไลด์ ${esc(SETBACK_LESSON.slides)}) มีเรื่องร่นจากคลอง ผนังช่องเปิด ที่ว่าง — สไลด์ไม่ได้ระบุว่าอยู่ใต้วัตถุประสงค์ข้อไหน จึงไม่จัดไว้ใต้ข้อใด</p>`;
  if (!o) return `<p class="note">กดข้อใดข้อหนึ่งด้านบน หรือกดจุดตัวเลขบนฉาก</p>${link}`;
  const flagged = REVIEW_POINTS.filter((r) => r.objective === o.n);
  return `<div class="detail" style="--c:${o.color}">
    <h3><span class="ic" style="color:${o.color}">${o.icon}</span>ข้อ ${o.n} ${esc(o.name)}</h3>
    <p class="plain">${esc(o.plain)}</p>
    <p class="note">ตัวอย่างจากสไลด์ในชุดเดียวกัน ${chipReview}</p>
    ${o.examples.length ? `<ul>${o.examples.map(exampleLi).join('')}</ul>` : `<p class="none">${NO_EXAMPLE}</p>`}
    <p class="legal">ที่มา: ${esc(LAW_ACT_8.clause)} แห่ง ${esc(LAW_ACT_8.law)} · ${matchWord(o)} · <button type="button" class="lawbtn" data-law8="1">ดูตัวบท</button></p>
    ${flagged.map((r) => `<p class="review">จุดที่ต้องตรวจ: ${esc(r.title)}</p>`).join('')}
  </div>${link}`;
}
const matchWord = (o) => (o.act8.match === 'ตรง' ? `มาตรา 8 มีคำว่า "${esc(o.act8.word)}"` : o.act8.match === 'ถ้อยคำต่าง' ? `มาตรา 8 มีคำใกล้เคียง "${esc(o.act8.word)}" (ถ้อยคำต่างจากสไลด์)` : 'ไม่พบในรายการของมาตรา 8');

// ---------- กิจกรรมจับคู่ ----------
function quizHtml() {
  const p = st.quizPart && PARTS.find((x) => x.id === st.quizPart);
  const scene = st.quizPart && SCENE_ONLY.find((x) => x.id === st.quizPart);
  let body;
  if (!st.quizPart) body = '<p class="note">ยังไม่ได้เลือกส่วนของอาคาร — กดป้ายชื่อบนฉาก หรือกดส่วนของอาคารโดยตรง</p>';
  else if (scene) body = `<p class="quiz-q">ส่วนที่เลือก: ${esc(scene.label)}</p><div class="quiz-fb">${esc(scene.note)}</div>`;
  else body = `<p class="quiz-q">ส่วนที่เลือก: ${esc(p.label)} — ตรงกับวัตถุประสงค์ข้อไหน?</p>
    <div class="chips">${objectiveChips(st.answered, 'data-a')}</div>${feedbackHtml(p)}`;
  return `<h2>ลองจับคู่ <small class="slides">(ไม่เก็บคะแนน)</small></h2>${body}
    <p class="note">ข้อ 5 และ 6 ยังไม่มีตัวอย่างในสไลด์ชุดนี้ จึงยังไม่มีส่วนของอาคารให้จับคู่ · การจับคู่เป็นของผู้จัดทำ รอเจ้าของงานยืนยัน ${chipReview}</p>
    <button type="button" class="btn" id="nextpart">สุ่มส่วนอื่น</button>`;
}
function feedbackHtml(p) {
  if (st.answered == null) return '';
  const right = objectiveByN(p.objective), ans = objectiveByN(st.answered);
  if (st.answered === p.objective) return `<div class="quiz-fb ok" role="status"><strong>ถูก</strong> — ข้อ ${right.n} ${esc(right.name)}<br>${esc(p.why)} ${slideRef(p.slides)}</div>`;
  const extra = p.hints[st.answered] ? `${esc(p.hints[st.answered])}<br>` : '';
  const none = !ans.examples.length ? `ข้อ ${ans.n} ยังไม่มีตัวอย่างในสไลด์ชุดนี้ จึงยังไม่มีส่วนของอาคารที่สไลด์จัดไว้ใต้ข้อนี้<br>` : '';
  return `<div class="quiz-fb no" role="status"><strong>ยังไม่ใช่</strong> — ไม่ใช่ข้อ ${ans.n} ${esc(ans.name)}<br>${extra}${none}ที่สไลด์จัดไว้คือ <strong>ข้อ ${right.n} ${esc(right.name)}</strong><br>${esc(p.why)} ${slideRef(p.slides)}</div>`;
}

// ---------- การทำงาน ----------
function selectObjective(n) {
  st.obj = n; syncAll();
  const o = objectiveByN(n);
  flyToPart(o.part === 'overall' ? 'overall' : o.part, n);
}
function pickPart(id) {
  if (st.step === 1) { const o = OBJECTIVES.find((x) => (x.parts || [x.part]).includes(id) && x.part !== 'overall'); if (o) selectObjective(o.n); return; }
  if (st.step !== 2) return;
  st.quizPart = id; st.answered = null; syncAll();
  if (ANCH[id]) api.flyTo(camFor(id).pos, camFor(id).tgt);
}
// ชั้นผังเมืองรวม/EIA กว้างกว่าอาคาร → ถอยกล้องออก · ถ้าปิดสองชั้นนี้แล้วกลับมุมเดิม
function wideIfZones() {
  if (st.layers.has('zoning') || st.layers.has('eia')) { const b = PARAMS.building; api.flyTo({ x: b.x - 26, y: 52, z: -38 }, { x: b.x + 6, y: 0, z: 12 }); } else api.resetCamera();
}
function syncAll() { renderActivity(); pushScene(); syncMarkerOn(); }

function goStep(i) {
  st.step = Math.max(0, Math.min(STEPS.length - 1, i));
  renderStepHead(STEPS, st.step);
  if (st.step === 0) { st.obj = null; setMarkers([]); api.resetCamera(); }
  if (st.step === 1) { markObjective(); }
  if (st.step === 2) { st.quizPart = null; st.answered = null; markParts(); api.resetCamera(); }
  syncAll();
}

function renderTables() {
  const rows = OBJECTIVES.map((o) => `<tr><td><span class="ochip" style="--c:${o.color};min-height:0;padding:2px 10px 2px 4px"><span class="no">${o.n}</span></span> ${esc(o.name)}</td><td>${o.act8.word ? esc(o.act8.word) : '—'}</td><td>${esc(o.act8.match)}</td></tr>`).join('')
    + ACT8_EXTRA.map((w) => `<tr><td>— (ไม่มีในสไลด์ 2)</td><td>${esc(w)}</td><td>มีเฉพาะมาตรา 8 ${chipReview}</td></tr>`).join('');
  $('matchtable').innerHTML = `<table class="cmp"><thead><tr><th>ข้อในสไลด์ 2</th><th>คำในมาตรา 8</th><th>เทียบ</th></tr></thead><tbody>${rows}</tbody></table>`;
  $('reviewlist').innerHTML = REVIEW_POINTS.map((r) => `<li><span class="t">${esc(r.title)}</span>${chipReview}<p>${esc(r.detail)}</p>${r.law ? `<p>ตัวบท (${esc(r.law.clause)}): "${esc(r.law.text)}"</p>` : ''}</li>`).join('');
  $('linkbox').innerHTML = `<p>บทที่เกี่ยวข้อง: <a href="${esc(SETBACK_LESSON.href)}">${esc(SETBACK_LESSON.title)}</a> (สไลด์ ${esc(SETBACK_LESSON.slides)}) — ${esc(SETBACK_LESSON.rules)}<br><small>${esc(SETBACK_LESSON.note)}</small></p>`;
}

async function start() {
  renderCredits(credits);
  const theme = initTheme((d) => { st.dark = d; api?.setTheme(d); pushScene(); });
  st.dark = theme.isDark();
  api = await initScene($('view'), { buildBuilding, buildOverlay, onPick: (id) => pickPart(id), onFrame: positionMarkers });
  api.setTheme(st.dark);
  setView = bindViewButtons(() => api);
  renderTables();
  bindStepNav(() => st.step, goStep);
  $('activity').addEventListener('click', (e) => {
    const l = e.target.closest('[data-l]'); if (l) { st.layers.has(l.dataset.l) ? st.layers.delete(l.dataset.l) : st.layers.add(l.dataset.l); syncAll(); wideIfZones(); return; }
    const o = e.target.closest('[data-o]'); if (o) { selectObjective(+o.dataset.o); return; }
    const a = e.target.closest('[data-a]'); if (a) { st.answered = +a.dataset.a; renderActivity(); return; }
    if (e.target.closest('#nextpart')) { const rest = PARTS.filter((p) => p.id !== st.quizPart); pickPart(rest[Math.floor(Math.random() * rest.length)].id); return; }
    if (e.target.closest('[data-law8]')) showLawBox({ title: 'วัตถุประสงค์ของกฎหมาย (ที่มาของ 7 ข้อ)', ...LAW_ACT_8 });
  });
  $('lawbtn').addEventListener('click', () => showLawBox({ title: 'วัตถุประสงค์ของกฎหมาย (ที่มาของ 7 ข้อ)', ...LAW_ACT_8 }));
  goStep(0);
  if (import.meta.env.DEV || new URLSearchParams(location.search).has('debug')) window.__l1 = { st, goStep, selectObjective, pickPart, setView, syncAll, api };
}
start();
