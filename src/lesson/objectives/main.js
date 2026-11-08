// บทที่ 1 "วัตถุประสงค์ของกฎหมายควบคุมอาคาร" (สไลด์ 1–2) — หน้าอ่าน + รูปประกอบ (ไม่โหลด three.js)
// รูปสร้างจากฉาก 3 มิติ (figure-scene.js) ล่วงหน้า → assets/lessons/01/*.webp แล้วฝังเป็น data URI ตอน build
import credits from '../../../assets/polyfork/credits.json';
import { $, esc, renderCredits, initTheme, showLawBox } from '../../shared/ui.js';
import { OBJECTIVES, LAW_ACT_8, REVIEW_POINTS, ACT8_EXTRA, NO_EXAMPLE } from '../../content/objectives.js';
import { LAYERS, SETBACK_LESSON } from '../../content/lesson01.js';
import { OVERVIEW_FIGURE, OBJECTIVE_FIGURES, GENERIC_NOTE } from '../../content/lesson01-figures.js';

const IMG = import.meta.glob('../../../assets/lessons/01/*.webp', { eager: true, query: '?url', import: 'default' });
const imgUrl = (file) => IMG[`../../../assets/lessons/01/${file}`];
const slideRef = (arr) => `<span class="sl-ref">(สไลด์ ${arr.join(', ')})</span>`;
const chipReview = '<span class="chip">จุดที่ต้องตรวจ</span>';
const exampleLi = (e) => `<li>${esc(e.text)} ${slideRef(e.slides)}</li>`;
const figure = (f, extraNote = '') => `<figure class="fig"><img src="${imgUrl(f.file)}" alt="${esc(f.alt)}" width="1200" height="675"><figcaption>${esc(f.caption)}${extraNote}</figcaption></figure>`;

function renderOverview() {
  const legend = `<ul class="legend">${OVERVIEW_FIGURE.legend.map((l) => `<li><span class="sw" style="background:${l.color}"></span>${esc(l.text)}</li>`).join('')}</ul>`;
  const boxes = LAYERS.map((l) => `<article class="layerbox" style="--c:${l.color}">
    <h3>${esc(l.name)}</h3><p>${esc(l.summary)}</p>
    <details><summary>ตัวอย่างจากสไลด์</summary><ul>${l.facts.map(exampleLi).join('')}</ul><p class="legal">${esc(l.caption)}</p></details></article>`).join('');
  $('overview').innerHTML = `<h2>ภาพรวม: ผังเมืองรวม · EIA · ควบคุมอาคาร <small class="slides">(สไลด์ 1)</small></h2>
    <p class="explain">ปกสไลด์ 1 มีสามเรื่อง คือ ผังเมืองรวม · EIA · ควบคุมอาคาร บทนี้เรียนเรื่องที่สาม คือกฎหมายควบคุมอาคาร</p>
    ${figure(OVERVIEW_FIGURE)}${legend}<div class="layerboxes">${boxes}</div>`;
}

const matchWord = (o) => (o.act8.match === 'ตรง' ? `มาตรา 8 มีคำว่า "${esc(o.act8.word)}"` : o.act8.match === 'ถ้อยคำต่าง' ? `มาตรา 8 มีคำใกล้เคียง "${esc(o.act8.word)}" (ถ้อยคำต่างจากสไลด์)` : 'ไม่พบในรายการของมาตรา 8');

function card(o) {
  const f = OBJECTIVE_FIGURES[o.n];
  const flagged = REVIEW_POINTS.filter((r) => r.objective === o.n);
  return `<article class="ocard" id="obj${o.n}" style="--c:${o.color}">
    <h2><span class="no">${o.n}</span><span class="ic">${o.icon}</span>${esc(o.name)} <small class="slides">(สไลด์ 2)</small></h2>
    ${figure(f, f.generic ? `<br><strong class="generic">${GENERIC_NOTE}</strong>` : '')}
    <p class="plain">${esc(o.plain)}</p>
    <p class="note">ตัวอย่างจากสไลด์ในชุดเดียวกัน ${chipReview}</p>
    ${o.examples.length ? `<ul>${o.examples.map(exampleLi).join('')}</ul>` : `<p class="none">${NO_EXAMPLE}</p>`}
    <p class="legal">ที่มา: ${esc(LAW_ACT_8.clause)} แห่ง ${esc(LAW_ACT_8.law)} · ${matchWord(o)} · <button type="button" class="lawbtn" data-law8="1">ดูตัวบท</button></p>
    ${flagged.map((r) => `<p class="review">จุดที่ต้องตรวจ: ${esc(r.title)}</p>`).join('')}
    <p class="legal linkbox">กฎของบท <a href="${esc(SETBACK_LESSON.href)}">${esc(SETBACK_LESSON.title)}</a> (สไลด์ ${esc(SETBACK_LESSON.slides)}) — สไลด์ไม่ได้ระบุว่าอยู่ใต้วัตถุประสงค์ข้อไหน จึงไม่จัดไว้ใต้ข้อใด</p>
  </article>`;
}

function renderTables() {
  const rows = OBJECTIVES.map((o) => `<tr><td><span class="ochip" style="--c:${o.color};min-height:0;padding:2px 10px 2px 4px"><span class="no">${o.n}</span></span> ${esc(o.name)}</td><td>${o.act8.word ? esc(o.act8.word) : '—'}</td><td>${esc(o.act8.match)}</td></tr>`).join('')
    + ACT8_EXTRA.map((w) => `<tr><td>— (ไม่มีในสไลด์ 2)</td><td>${esc(w)}</td><td>มีเฉพาะมาตรา 8 ${chipReview}</td></tr>`).join('');
  $('matchtable').innerHTML = `<table class="cmp"><thead><tr><th>ข้อในสไลด์ 2</th><th>คำในมาตรา 8</th><th>เทียบ</th></tr></thead><tbody>${rows}</tbody></table>`;
  $('reviewlist').innerHTML = REVIEW_POINTS.map((r) => `<li><span class="t">${esc(r.title)}</span>${chipReview}<p>${esc(r.detail)}</p>${r.law ? `<p>ตัวบท (${esc(r.law.clause)}): "${esc(r.law.text)}"</p>` : ''}</li>`).join('');
  $('linkbox').innerHTML = `<p>บทที่เกี่ยวข้อง: <a href="${esc(SETBACK_LESSON.href)}">${esc(SETBACK_LESSON.title)}</a> (สไลด์ ${esc(SETBACK_LESSON.slides)}) — ${esc(SETBACK_LESSON.rules)}<br><small>${esc(SETBACK_LESSON.note)}</small></p>`;
}

const showAct8 = () => showLawBox({ title: 'วัตถุประสงค์ของกฎหมาย (ที่มาของ 7 ข้อ)', ...LAW_ACT_8 });
renderCredits(credits);
initTheme();
renderOverview();
$('cards').innerHTML = `<h2 class="sectitle">วัตถุประสงค์ 7 ข้อ <small class="slides">(สไลด์ 2: กฎหมายควบคุมอาคารมีไว้ "เพื่อควบคุมเกี่ยวกับ" 7 เรื่อง)</small></h2><div class="cardlist">${OBJECTIVES.map(card).join('')}</div>`;
renderTables();
document.addEventListener('click', (e) => { if (e.target.closest('[data-law8]')) showAct8(); });
$('lawbtn').addEventListener('click', showAct8);
