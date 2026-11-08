// ส่วนหน้าเว็บที่ใช้ร่วมกันทุกบท: ตัวช่วย DOM · โหมดมืด · เครดิตโมเดล · กล่องดูตัวบท · หัวการ์ดขั้น (ถัดไป/ย้อนกลับ)
// ทุกบทต้องมีองค์ประกอบ id เหล่านี้ในหน้า: theme, credits, lawbox, lawbody, stepcount, stepbar, steptitle, stepexplain, stepslides, prev, next
export const $ = (id) => document.getElementById(id);
export const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export function renderCredits(credits) {
  $('credits').innerHTML = credits.map((c) => `<li>${esc(c.name)} by Polyfork (<a href="${esc(c.url)}" target="_blank" rel="noopener" style="color:inherit">${esc(c.url)}</a>), CC BY 4.0</li>`).join('');
}

// โหมดสว่าง/มืด: ตามค่าเครื่อง แล้วให้ผู้เรียนสลับเองได้ · onChange(dark) ใช้สั่งฉาก 3 มิติเปลี่ยนสี
export function initTheme(onChange) {
  const btn = $('theme');
  const apply = (dark) => {
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    btn.textContent = dark ? 'โหมดสว่าง' : 'โหมดมืด';
  };
  apply(window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false);
  btn.addEventListener('click', () => { const d = document.documentElement.dataset.theme !== 'dark'; apply(d); onChange?.(d); });
  return { isDark: () => document.documentElement.dataset.theme === 'dark' };
}

// กล่องดูตัวบท: { title, law, clause, text }
export function showLawBox({ title, law, clause, text }) {
  $('lawbody').innerHTML = `<h2 id="lawtitle">${esc(title)}</h2><h3>${esc(law)}</h3><p class="clause">${esc(clause)}</p><blockquote>${esc(text)}</blockquote>`;
  $('lawbox').showModal();
}

// หัวการ์ดขั้น: "ขั้น n จาก N" · ปุ่มเลือกขั้น · ชื่อ · คำอธิบาย · เลขสไลด์ · เปิด/ปิดปุ่ม ถัดไป/ย้อนกลับ
export function renderStepHead(steps, idx, { explain } = {}) {
  const st = steps[idx];
  $('stepcount').textContent = `ขั้น ${idx + 1} จาก ${steps.length}`;
  $('steptitle').textContent = st.title;
  $('stepexplain').textContent = explain ?? st.explain;
  $('stepslides').textContent = `สไลด์ต้นฉบับ: ${st.slides.join(', ')}`;
  $('prev').disabled = idx === 0;
  $('next').disabled = idx === steps.length - 1;
  $('stepbar').innerHTML = steps.map((s, i) => `<button type="button" class="btn${i === idx ? ' on' : i < idx ? ' done' : ''}" data-i="${i}" title="${esc(s.title)}" aria-label="ขั้น ${i + 1}: ${esc(s.title)}"${i === idx ? ' aria-current="step"' : ''}>${i + 1}</button>`).join('');
}

export function bindStepNav(getIdx, goStep) {
  $('prev').addEventListener('click', () => goStep(getIdx() - 1));
  $('next').addEventListener('click', () => goStep(getIdx() + 1));
  $('stepbar').addEventListener('click', (e) => { const b = e.target.closest('button[data-i]'); if (b) goStep(+b.dataset.i); });
}

// ปุ่มมุมมอง · ค่าตั้งต้น 3 มิติ/ด้านบน (บทระยะร่น) · บทอื่นส่ง views เองได้ เช่น [['v3d','3d'],['vside','side']] · onChange(m) เรียกหลังเปลี่ยนมุม
export function bindViewButtons(getApi, views = [['v3d', '3d'], ['vtop', 'top']], onChange) {
  const set = (m) => {
    getApi().setView(m);
    for (const [id, v] of views) { $(id).classList.toggle('on', m === v); $(id).setAttribute('aria-pressed', m === v); }
    onChange?.(m);
  };
  for (const [id, v] of views) $(id).addEventListener('click', () => set(v));
  return set;
}
