// ============================================
// Program storage (localStorage if user customized; otherwise default-program.json)
// ============================================
const PROGRAM_KEY = 'nobro_program_v1';
const PROGRAM_VERSION = 1;
const EMPTY_PROGRAM = { 1: [], 2: [], 3: [], 4: [], 5: [], 6: [], 7: [] };

function deepClone(x) { return JSON.parse(JSON.stringify(x)); }

function isValidProgramDays(days) {
  if (!days || typeof days !== 'object') return false;
  for (const k of ['1','2','3','4','5','6','7']) {
    const arr = days[k];
    if (!Array.isArray(arr)) return false;
    for (const e of arr) {
      if (!e || typeof e !== 'object') return false;
      if (typeof e.region !== 'string') return false;
      if (typeof e.name !== 'string') return false;
      if (typeof e.description !== 'string') return false;
      if (typeof e.set !== 'number' || e.set < 1) return false;
      if (typeof e.reps !== 'string' && typeof e.reps !== 'number') return false;
      if (typeof e.rest !== 'number' || e.rest < 0) return false;
    }
  }
  return true;
}

let _defaultProgramCache = null;
async function loadDefaultProgram() {
  if (_defaultProgramCache) return _defaultProgramCache;
  try {
    const res = await fetch('./default-program.json', { cache: 'no-cache' });
    const json = await res.json();
    if (json && json.days && isValidProgramDays(json.days)) {
      _defaultProgramCache = json.days;
      return json.days;
    }
  } catch (e) {}
  return EMPTY_PROGRAM;
}

async function loadProgram() {
  try {
    const raw = localStorage.getItem(PROGRAM_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      const days = parsed && parsed.days ? parsed.days : null;
      if (isValidProgramDays(days)) {
        for (const k of ['1','2','3','4','5','6','7']) {
          days[k].forEach(e => { if (typeof e.reps === 'number') e.reps = String(e.reps); });
        }
        return days;
      }
    }
  } catch (e) {}
  return deepClone(await loadDefaultProgram());
}

function saveCustomProgram(days) {
  localStorage.setItem(PROGRAM_KEY, JSON.stringify({ version: PROGRAM_VERSION, days }));
}

let PROGRAM = deepClone(EMPTY_PROGRAM);

// ============================================
// i18n
// ============================================
const SUPPORTED_LOCALES = ['en', 'tr', 'zh', 'hi', 'es', 'fr', 'ar', 'bn', 'ru', 'pt', 'id'];
const FALLBACK_LOCALE = 'en';
let translations = null;
let fallbackTranslations = null;
let currentLocale = FALLBACK_LOCALE;

function detectLocale() {
  const stored = (() => {
    try { return localStorage.getItem('nobro_locale'); } catch (e) { return null; }
  })();
  if (stored && SUPPORTED_LOCALES.includes(stored)) return stored;

  const langs = (navigator.languages && navigator.languages.length)
    ? navigator.languages
    : [navigator.language || FALLBACK_LOCALE];
  for (const l of langs) {
    const code = (l || '').toLowerCase().split('-')[0];
    if (SUPPORTED_LOCALES.includes(code)) return code;
  }
  return FALLBACK_LOCALE;
}

async function fetchLocale(locale) {
  const res = await fetch(`./locales/${locale}.json`, { cache: 'no-cache' });
  if (!res.ok) throw new Error(`locale ${locale} not found`);
  return res.json();
}

async function loadLocale(locale) {
  try {
    return await fetchLocale(locale);
  } catch (e) {
    if (locale !== FALLBACK_LOCALE) return fetchLocale(FALLBACK_LOCALE);
    throw e;
  }
}

function lookup(obj, key) {
  if (!obj) return undefined;
  const parts = key.split('.');
  let v = obj;
  for (const p of parts) {
    if (v && typeof v === 'object' && p in v) v = v[p];
    else return undefined;
  }
  return v;
}

function interpolate(str, vars) {
  if (typeof str !== 'string' || !vars) return str;
  return str.replace(/\{(\w+)\}/g, (_, k) => (vars[k] != null ? vars[k] : `{${k}}`));
}

function t(key, vars) {
  let v = lookup(translations, key);
  if (v === undefined) v = lookup(fallbackTranslations, key);
  if (v === undefined) return key;
  return interpolate(v, vars);
}

function applyStaticTranslations() {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    el.textContent = t(el.getAttribute('data-i18n'));
  });
  document.querySelectorAll('[data-i18n-aria-label]').forEach(el => {
    el.setAttribute('aria-label', t(el.getAttribute('data-i18n-aria-label')));
  });
  const titleKey = 'ui.title';
  const title = t(titleKey);
  if (title && title !== titleKey) document.title = title;
}

async function initI18n() {
  currentLocale = detectLocale();
  if (currentLocale !== FALLBACK_LOCALE) {
    try { fallbackTranslations = await fetchLocale(FALLBACK_LOCALE); } catch (e) {}
  }
  try {
    translations = await loadLocale(currentLocale);
  } catch (e) {
    translations = fallbackTranslations || {};
    currentLocale = FALLBACK_LOCALE;
  }
  if (!fallbackTranslations) fallbackTranslations = translations;

  const dir = (translations.meta && translations.meta.dir) || 'ltr';
  document.documentElement.lang = currentLocale;
  document.documentElement.dir = dir;
  applyStaticTranslations();
}

// ============================================
// State (today's progress)
// ============================================
const STORAGE_KEY = 'idman_state_v1';

function gunNo() {
  const d = new Date().getDay();
  return d === 0 ? 7 : d;
}

function bugunKey() {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth()+1}-${d.getDate()}`;
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const s = JSON.parse(raw);
      if (s.tarih === bugunKey()) return s;
    }
  } catch (e) {}
  return {
    tarih: bugunKey(),
    gun: gunNo(),
    hareketIdx: 0,
    setIdx: 0,
    setBitisleri: [],
    baslangic: null,
    bitis: null,
  };
}

function saveState(s) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)); } catch (e) {}
}

let state = loadState();
let timerInterval = null;
let wakeLock = null;

async function requestWakeLock() {
  try {
    if ('wakeLock' in navigator) {
      wakeLock = await navigator.wakeLock.request('screen');
    }
  } catch (e) {}
}

function releaseWakeLock() {
  if (wakeLock) { wakeLock.release(); wakeLock = null; }
}

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && !wakeLock) requestWakeLock();
});

let audioCtx = null;
function beep() {
  try {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const dur = 0.6;
    const now = audioCtx.currentTime;
    [880, 1320].forEach((freq, i) => {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.frequency.value = freq;
      osc.type = 'sine';
      gain.gain.setValueAtTime(0, now + i * 0.25);
      gain.gain.linearRampToValueAtTime(0.3, now + i * 0.25 + 0.02);
      gain.gain.linearRampToValueAtTime(0, now + i * 0.25 + dur);
      osc.connect(gain).connect(audioCtx.destination);
      osc.start(now + i * 0.25);
      osc.stop(now + i * 0.25 + dur);
    });
    if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
  } catch (e) {}
}

function fmt(secs) {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function fmtSure(ms) {
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return t('duration.h_m', { h, m });
  return t('duration.m_s', { m, s });
}

function dayShort(n) {
  const arr = lookup(translations, 'days_short') || lookup(fallbackTranslations, 'days_short') || [];
  return arr[n] || '';
}

function ytUrl(name) {
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(name + ' form')}`;
}

function escapeHtml(s) {
  if (s == null) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function updateProgressBar(program) {
  const fill = document.getElementById('progressbarFill');
  if (!fill) return;
  const totalSets = program.reduce((acc, ex) => acc + (ex.set || 0), 0);
  if (totalSets === 0) { fill.style.width = '0%'; return; }
  const done = state.setBitisleri.length;
  const pct = Math.min(100, Math.round((done / totalSets) * 100));
  fill.style.width = pct + '%';
}

function render() {
  const main = document.getElementById('main');
  const bottom = document.getElementById('bottom');
  const dayInfo = document.getElementById('dayInfo');
  const progress = document.getElementById('progress');
  const footer = document.getElementById('footer');

  const program = PROGRAM[state.gun] || [];
  dayInfo.textContent = t('ui.day_label', { day: dayShort(state.gun), n: state.gun });
  footer.textContent = '';
  updateProgressBar(program);

  if (program.length === 0) {
    progress.textContent = '';
    const tomorrow = state.gun === 7 ? 1 : state.gun + 1;
    main.innerHTML = `<div class="empty"><div class="big">${t('ui.rest_day_emoji')}</div>${escapeHtml(t('ui.rest_day'))}<br>${escapeHtml(t('ui.rest_day_tomorrow', { day: dayShort(tomorrow) }))}</div>`;
    bottom.innerHTML = '';
    return;
  }

  if (state.hareketIdx >= program.length) {
    progress.textContent = t('ui.progress_done');
    renderOzet(program);
    return;
  }

  const item = program[state.hareketIdx];
  progress.textContent = t('ui.progress', {
    cur: state.hareketIdx + 1,
    total: program.length,
    set: state.setIdx + 1,
    sets: item.set,
  });

  main.innerHTML = `
    <div class="bolge">${escapeHtml(item.region)}</div>
    <div class="hareket"><a class="hareket-link" href="${ytUrl(item.name)}" target="_blank" rel="noopener">${escapeHtml(item.name)}</a></div>
    <div class="hedef">${escapeHtml(t('ui.rep_set', { reps: item.reps, set: state.setIdx + 1, total: item.set }))}</div>
    <div class="aciklama">${escapeHtml(item.description)}</div>
  `;

  bottom.innerHTML = `<button class="btn btn-start" id="startBtn">${escapeHtml(t('ui.start'))}</button>`;
  document.getElementById('startBtn').addEventListener('click', onStart);
}

function onStart() {
  if (!state.baslangic) {
    state.baslangic = Date.now();
  }
  if (!audioCtx) {
    try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {}
  }
  if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
  requestWakeLock();
  saveState(state);

  const program = PROGRAM[state.gun];
  const item = program[state.hareketIdx];

  const main = document.getElementById('main');
  main.innerHTML = `
    <div class="bolge">${escapeHtml(item.region)}</div>
    <div class="hareket"><a class="hareket-link" href="${ytUrl(item.name)}" target="_blank" rel="noopener">${escapeHtml(item.name)}</a></div>
    <div class="hedef">${escapeHtml(t('ui.rep_set_doing', { reps: item.reps, set: state.setIdx + 1, total: item.set }))}</div>
    <div class="timer-label">${escapeHtml(t('ui.set_duration'))}</div>
    <div class="timer" id="setTimer" style="color:#f59e0b;">0:00</div>
  `;
  document.getElementById('bottom').innerHTML = `<button class="btn btn-done" id="doneBtn">${escapeHtml(t('ui.done'))}</button>`;
  document.getElementById('doneBtn').addEventListener('click', onDone);

  const setBaslangic = Date.now();
  const setTimerEl = document.getElementById('setTimer');
  if (timerInterval) clearInterval(timerInterval);
  timerInterval = setInterval(() => {
    const gecen = Math.floor((Date.now() - setBaslangic) / 1000);
    if (setTimerEl) setTimerEl.textContent = fmt(gecen);
  }, 1000);
}

function onDone() {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
  const program = PROGRAM[state.gun];
  const item = program[state.hareketIdx];

  state.setBitisleri.push({
    hareketIdx: state.hareketIdx,
    name: item.name,
    setIdx: state.setIdx,
    ts: Date.now(),
  });

  state.setIdx++;
  if (state.setIdx >= item.set) {
    state.setIdx = 0;
    state.hareketIdx++;
  }

  if (state.hareketIdx >= program.length) {
    state.bitis = Date.now();
    saveState(state);
    render();
    return;
  }

  saveState(state);
  startDinlenme(item.rest);
}

function startDinlenme(saniye) {
  let kalan = saniye;
  const main = document.getElementById('main');
  const bottom = document.getElementById('bottom');

  function tik() {
    main.innerHTML = `
      <div class="timer-label">${escapeHtml(t('ui.rest'))}</div>
      <div class="timer">${fmt(kalan)}</div>
      <div class="aciklama">${escapeHtml(t('ui.rest_hint'))}</div>
    `;
    bottom.innerHTML = `<button class="btn-skip" id="skipBtn">${escapeHtml(t('ui.skip_rest'))}</button>`;
    document.getElementById('skipBtn').addEventListener('click', () => {
      clearInterval(timerInterval);
      timerInterval = null;
      render();
    });
  }

  tik();
  timerInterval = setInterval(() => {
    kalan--;
    if (kalan <= 0) {
      clearInterval(timerInterval);
      timerInterval = null;
      beep();
      render();
      return;
    }
    tik();
  }, 1000);
}

function renderOzet(program) {
  const sayim = {};
  state.setBitisleri.forEach(b => {
    const k = b.hareketIdx;
    sayim[k] = (sayim[k] || 0) + 1;
  });

  const sure = state.bitis && state.baslangic ? state.bitis - state.baslangic : 0;
  const toplamSet = state.setBitisleri.length;

  let rows = '';
  program.forEach((h, idx) => {
    const yapilan = sayim[idx] || 0;
    rows += `<div class="summary-row"><span class="name"><a href="${ytUrl(h.name)}" target="_blank" rel="noopener">${escapeHtml(h.name)}</a></span><span class="val">${yapilan}/${h.set}</span></div>`;
  });

  document.getElementById('main').innerHTML = `
    <div class="summary">
      <h2>${escapeHtml(t('ui.today_done'))}</h2>
      ${rows}
      <div class="summary-row summary-total"><span class="name">${escapeHtml(t('ui.total_sets'))}</span><span class="val">${toplamSet}</span></div>
      <div class="summary-row"><span class="name">${escapeHtml(t('ui.duration'))}</span><span class="val">${escapeHtml(fmtSure(sure))}</span></div>
    </div>
  `;
  document.getElementById('bottom').innerHTML = '';
  document.getElementById('footer').innerHTML = `<a href="#" id="resetLink" style="color:#444;text-decoration:none;">${escapeHtml(t('ui.reset'))}</a>`;
  document.getElementById('resetLink').addEventListener('click', (e) => {
    e.preventDefault();
    if (confirm(t('ui.reset_confirm'))) {
      localStorage.removeItem(STORAGE_KEY);
      state = loadState();
      render();
    }
  });
}

window.addEventListener('beforeunload', () => {
  if (timerInterval) clearInterval(timerInterval);
  saveState(state);
});

// ============================================
// Modal control
// ============================================
function openModal(id) {
  const m = document.getElementById(id);
  if (m) m.hidden = false;
}
function closeModal(m) { m.hidden = true; }

document.getElementById('aboutBtn').addEventListener('click', () => openModal('aboutModal'));
document.getElementById('settingsBtn').addEventListener('click', () => openSettings());

document.getElementById('shareBtn').addEventListener('click', async () => {
  const url = 'https://nobro.app/';
  const payload = { title: 'nobro.app', text: 'no thinking. just lift.', url };
  try {
    if (navigator.share) {
      await navigator.share(payload);
      return;
    }
    await navigator.clipboard.writeText(url);
  } catch (e) {
    if (e && e.name === 'AbortError') return;
    try { await navigator.clipboard.writeText(url); } catch (_) { return; }
  }
  const btn = document.getElementById('shareBtn');
  const label = btn.querySelector('span');
  const original = label.textContent;
  btn.classList.add('is-copied');
  label.textContent = t('ui.share_copied');
  setTimeout(() => {
    btn.classList.remove('is-copied');
    label.textContent = original;
  }, 1800);
});

document.querySelectorAll('.modal').forEach((m) => {
  m.querySelectorAll('[data-close]').forEach((el) => {
    el.addEventListener('click', () => closeModal(m));
  });
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    document.querySelectorAll('.modal:not([hidden])').forEach(closeModal);
  }
});

// ============================================
// Program editor (Settings)
// ============================================
let programDraft = null;
let editingDay = 1;

function openSettings() {
  programDraft = deepClone(PROGRAM);
  editingDay = state.gun || 1;
  renderDayPills();
  renderDayEditor();
  openModal('settingsModal');
}

function renderDayPills() {
  const wrap = document.getElementById('dayPills');
  let html = '';
  for (let d = 1; d <= 7; d++) {
    const active = d === editingDay;
    html += `<button class="day-pill" type="button" role="tab" aria-pressed="${active}" data-day="${d}">${escapeHtml(dayShort(d))}</button>`;
  }
  wrap.innerHTML = html;
}

function renderDayEditor() {
  const wrap = document.getElementById('dayEditor');
  const arr = programDraft[editingDay] || [];
  if (arr.length === 0) {
    wrap.innerHTML = `<div class="empty-day">${escapeHtml(t('ui.no_exercises'))}</div>`;
    return;
  }
  let html = '';
  arr.forEach((ex, idx) => {
    html += `
      <div class="ex-card" data-idx="${idx}">
        <div class="ex-card-actions">
          <button type="button" data-action="up" data-i18n-aria-label="ui.move_up" aria-label="${escapeHtml(t('ui.move_up'))}">↑</button>
          <button type="button" data-action="down" data-i18n-aria-label="ui.move_down" aria-label="${escapeHtml(t('ui.move_down'))}">↓</button>
          <button type="button" class="remove" data-action="remove" data-i18n-aria-label="ui.remove" aria-label="${escapeHtml(t('ui.remove'))}">×</button>
        </div>
        <div class="ex-row">
          <input class="ex-input" type="text" data-field="region" value="${escapeHtml(ex.region)}" placeholder="${escapeHtml(t('ui.region_label'))}">
          <input class="ex-input" type="text" data-field="name" value="${escapeHtml(ex.name)}" placeholder="${escapeHtml(t('ui.exercise_label'))}">
        </div>
        <textarea class="ex-textarea" data-field="description" placeholder="${escapeHtml(t('ui.description_label'))}" rows="2">${escapeHtml(ex.description)}</textarea>
        <div class="ex-num-row">
          <label>${escapeHtml(t('ui.sets_label'))}<input class="ex-num" type="number" min="1" data-field="set" value="${ex.set}"></label>
          <label>${escapeHtml(t('ui.reps_label'))}<input class="ex-num" type="text" data-field="reps" value="${escapeHtml(ex.reps)}"></label>
          <label>${escapeHtml(t('ui.rest_label'))}<input class="ex-num" type="number" min="0" data-field="rest" value="${ex.rest}"></label>
        </div>
      </div>
    `;
  });
  wrap.innerHTML = html;
}

document.getElementById('dayPills').addEventListener('click', (e) => {
  const btn = e.target.closest('button[data-day]');
  if (!btn) return;
  editingDay = +btn.dataset.day;
  renderDayPills();
  renderDayEditor();
});

document.getElementById('dayEditor').addEventListener('input', (e) => {
  const card = e.target.closest('.ex-card');
  if (!card) return;
  const idx = +card.dataset.idx;
  const field = e.target.dataset.field;
  if (!field) return;
  const arr = programDraft[editingDay];
  if (!arr || !arr[idx]) return;
  let val = e.target.value;
  if (field === 'set' || field === 'rest') {
    const n = parseInt(val, 10);
    val = Number.isFinite(n) && n >= 0 ? n : 0;
    if (field === 'set' && val < 1) val = 1;
  }
  arr[idx][field] = val;
});

document.getElementById('dayEditor').addEventListener('click', (e) => {
  const btn = e.target.closest('button[data-action]');
  if (!btn) return;
  const card = e.target.closest('.ex-card');
  if (!card) return;
  const idx = +card.dataset.idx;
  const arr = programDraft[editingDay];
  const action = btn.dataset.action;
  if (action === 'remove') arr.splice(idx, 1);
  else if (action === 'up' && idx > 0) [arr[idx-1], arr[idx]] = [arr[idx], arr[idx-1]];
  else if (action === 'down' && idx < arr.length - 1) [arr[idx+1], arr[idx]] = [arr[idx], arr[idx+1]];
  renderDayEditor();
});

document.getElementById('addExBtn').addEventListener('click', () => {
  programDraft[editingDay].push({
    region: '', name: '', description: '', set: 3, reps: '10', rest: 60
  });
  renderDayEditor();
});

document.getElementById('saveProgramBtn').addEventListener('click', async () => {
  for (const k of ['1','2','3','4','5','6','7']) {
    programDraft[k].forEach(e => {
      e.set = Math.max(1, parseInt(e.set, 10) || 1);
      e.rest = Math.max(0, parseInt(e.rest, 10) || 0);
      if (typeof e.reps !== 'string') e.reps = String(e.reps);
    });
  }
  saveCustomProgram(programDraft);
  PROGRAM = await loadProgram();
  programDraft = null;
  closeModal(document.getElementById('settingsModal'));
  render();
});

document.getElementById('cancelProgramBtn').addEventListener('click', () => {
  programDraft = null;
  closeModal(document.getElementById('settingsModal'));
});

document.getElementById('exportBtn').addEventListener('click', () => {
  const data = { version: PROGRAM_VERSION, days: programDraft || PROGRAM };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'nobro-program.json';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 0);
});

document.getElementById('importBtn').addEventListener('click', () => {
  document.getElementById('importFile').click();
});

document.getElementById('importFile').addEventListener('change', async (e) => {
  const file = e.target.files && e.target.files[0];
  e.target.value = '';
  if (!file) return;
  try {
    const text = await file.text();
    const parsed = JSON.parse(text);
    const days = parsed && parsed.days ? parsed.days : parsed;
    if (days && typeof days === 'object') {
      for (const k of ['1','2','3','4','5','6','7']) {
        if (Array.isArray(days[k])) {
          days[k].forEach(en => { if (en && typeof en.reps === 'number') en.reps = String(en.reps); });
        }
      }
    }
    if (!isValidProgramDays(days)) throw new Error('invalid');
    saveCustomProgram(days);
    PROGRAM = await loadProgram();
    programDraft = deepClone(PROGRAM);
    renderDayEditor();
  } catch (err) {
    alert(t('ui.import_error'));
  }
});

document.getElementById('resetProgramBtn').addEventListener('click', async () => {
  if (!confirm(t('ui.reset_default_confirm'))) return;
  localStorage.removeItem(PROGRAM_KEY);
  PROGRAM = await loadProgram();
  programDraft = deepClone(PROGRAM);
  renderDayEditor();
});

// ============================================
// PWA — service worker
// ============================================
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  });
}

// ============================================
// Boot
// ============================================
(async () => {
  await initI18n();
  PROGRAM = await loadProgram();
  render();
  requestWakeLock();
})();
