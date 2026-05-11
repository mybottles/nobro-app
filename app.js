// ============================================
// Program storage (localStorage if user customized; otherwise presets/default.json)
// ============================================
const PROGRAM_KEY = 'nobro_program_v1';
const PROGRAM_META_KEY = 'nobro_program_meta_v1';
const PROGRAM_CUSTOMIZED_KEY = 'nobro_program_customized_v1';
const PROGRAM_VERSION = 1;
const PRESETS_DIR = './presets/';
const DEFAULT_PRESET_ID = 'default';
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

function pickPresetMeta(o) {
  if (!o || typeof o !== 'object') return null;
  const meta = {};
  if (typeof o.id === 'string') meta.id = o.id;
  if (typeof o.name === 'string') meta.name = o.name;
  if (typeof o.description === 'string') meta.description = o.description;
  if (o.coach && typeof o.coach === 'object'
      && typeof o.coach.name === 'string') {
    meta.coach = { name: o.coach.name };
    if (typeof o.coach.url === 'string') meta.coach.url = o.coach.url;
  }
  return Object.keys(meta).length ? meta : null;
}

let _presetIndexCache = null;
async function loadPresetIndex() {
  if (_presetIndexCache) return _presetIndexCache;
  try {
    const res = await fetch(`${PRESETS_DIR}index.json`, { cache: 'no-cache' });
    if (!res.ok) throw new Error('preset index fetch failed');
    const json = await res.json();
    if (json && Array.isArray(json.presets)) {
      _presetIndexCache = json.presets.filter(p => p && typeof p.id === 'string' && typeof p.file === 'string');
      return _presetIndexCache;
    }
  } catch (e) {}
  return [];
}

async function loadPresetById(id) {
  const idx = await loadPresetIndex();
  const entry = idx.find(p => p.id === id);
  if (!entry) return null;
  try {
    const res = await fetch(`${PRESETS_DIR}${entry.file}`, { cache: 'no-cache' });
    if (!res.ok) throw new Error('preset fetch failed');
    const json = await res.json();
    if (json && isValidProgramDays(json.days)) {
      return { meta: pickPresetMeta(json) || pickPresetMeta(entry), days: json.days };
    }
  } catch (e) {}
  return null;
}

const _presetDaysCache = new Map();
async function getPresetDays(id) {
  if (_presetDaysCache.has(id)) return _presetDaysCache.get(id);
  const preset = await loadPresetById(id);
  const days = preset && preset.days ? preset.days : null;
  if (days) _presetDaysCache.set(id, days);
  return days;
}

let _defaultProgramCache = null;
async function loadDefaultProgram() {
  if (_defaultProgramCache) return _defaultProgramCache;
  const preset = await loadPresetById(DEFAULT_PRESET_ID);
  if (preset && preset.days) {
    _defaultProgramCache = preset.days;
    return preset.days;
  }
  return EMPTY_PROGRAM;
}

function loadProgramMeta() {
  try {
    const raw = localStorage.getItem(PROGRAM_META_KEY);
    if (raw) {
      const m = JSON.parse(raw);
      if (m && typeof m === 'object') return m;
    }
  } catch (e) {}
  return null;
}

function saveProgramMeta(meta) {
  if (meta) localStorage.setItem(PROGRAM_META_KEY, JSON.stringify(meta));
  else localStorage.removeItem(PROGRAM_META_KEY);
}

function isProgramCustomized() {
  try { return localStorage.getItem(PROGRAM_CUSTOMIZED_KEY) === '1'; } catch (e) { return false; }
}

function setProgramCustomized(flag) {
  try {
    if (flag) localStorage.setItem(PROGRAM_CUSTOMIZED_KEY, '1');
    else localStorage.removeItem(PROGRAM_CUSTOMIZED_KEY);
  } catch (e) {}
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
      if (s.tarih === bugunKey()) {
        if (typeof s.aktifMs !== 'number') s.aktifMs = 0;
        if (!('aktifSetBaslangic' in s)) s.aktifSetBaslangic = null;
        if (!('aktifDinlenmeBaslangic' in s)) s.aktifDinlenmeBaslangic = null;
        if (!('aktifDinlenmeLimit' in s)) s.aktifDinlenmeLimit = null;
        return s;
      }
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
    aktifMs: 0,
    aktifSetBaslangic: null,
    aktifDinlenmeBaslangic: null,
    aktifDinlenmeLimit: null,
  };
}

// Active workout time = sum of every set's START→DONE + every rest's actual
// elapsed (clamped to its configured length). Set/rest in-flight segments are
// added live so the modal reflects current state without persisted ticks.
function aktifMsLive() {
  let total = state.aktifMs || 0;
  if (state.aktifSetBaslangic) {
    total += Date.now() - state.aktifSetBaslangic;
  } else if (state.aktifDinlenmeBaslangic) {
    const elapsed = Date.now() - state.aktifDinlenmeBaslangic;
    const limit = state.aktifDinlenmeLimit;
    total += (limit != null) ? Math.min(elapsed, limit) : elapsed;
  }
  return total;
}

function flushDinlenme(naturalEnd) {
  if (!state.aktifDinlenmeBaslangic) return;
  const limit = state.aktifDinlenmeLimit || 0;
  const elapsed = Date.now() - state.aktifDinlenmeBaslangic;
  state.aktifMs = (state.aktifMs || 0) + (naturalEnd ? limit : Math.min(elapsed, limit));
  state.aktifDinlenmeBaslangic = null;
  state.aktifDinlenmeLimit = null;
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
  const now = Date.now();
  // If app was closed during a rest, that rest never reached the skip button
  // nor its natural end — flush it as full configured rest before this START.
  if (state.aktifDinlenmeBaslangic) flushDinlenme(true);
  // A lingering aktifSetBaslangic means the previous set was abandoned (app
  // reload mid-set). Drop it — pressing START means "I'm starting now."
  state.aktifSetBaslangic = now;
  if (!state.baslangic) {
    state.baslangic = now;
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
  const now = Date.now();
  const program = PROGRAM[state.gun];
  const item = program[state.hareketIdx];

  if (state.aktifSetBaslangic) {
    state.aktifMs = (state.aktifMs || 0) + (now - state.aktifSetBaslangic);
    state.aktifSetBaslangic = null;
  }

  state.setBitisleri.push({
    hareketIdx: state.hareketIdx,
    name: item.name,
    setIdx: state.setIdx,
    ts: now,
  });

  state.setIdx++;
  if (state.setIdx >= item.set) {
    state.setIdx = 0;
    state.hareketIdx++;
  }

  if (state.hareketIdx >= program.length) {
    state.bitis = now;
    saveState(state);
    render();
    return;
  }

  state.aktifDinlenmeBaslangic = now;
  state.aktifDinlenmeLimit = (item.rest || 0) * 1000;
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
      flushDinlenme(false);
      saveState(state);
      render();
    });
  }

  tik();
  timerInterval = setInterval(() => {
    kalan--;
    if (kalan <= 0) {
      clearInterval(timerInterval);
      timerInterval = null;
      flushDinlenme(true);
      saveState(state);
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

  const sure = state.aktifMs || 0;
  const toplamSet = state.setBitisleri.length;

  let rows = '';
  program.forEach((h, idx) => {
    const yapilan = sayim[idx] || 0;
    rows += `<div class="summary-row"><span class="name"><a href="${ytUrl(h.name)}" target="_blank" rel="noopener">${escapeHtml(h.name)}</a></span><span class="val">${yapilan}/${h.set}</span></div>`;
  });

  const meta = currentMeta;
  const customized = isProgramCustomized();
  let programLine = '';
  if (meta || customized) {
    const name = meta ? escapeHtml(meta.name || t('ui.programs_unnamed')) : escapeHtml(t('ui.programs_unnamed'));
    const tag = customized ? ` <span class="program-custom-tag">${escapeHtml(t('ui.programs_customized'))}</span>` : '';
    const coach = (meta && meta.coach) ? ` <span class="summary-coach">${escapeHtml(t('ui.programs_coach_by'))} ${renderCoachLine(meta.coach)}</span>` : '';
    programLine = `<div class="summary-program">${name}${tag}${coach}</div>`;
  }

  document.getElementById('main').innerHTML = `
    <div class="summary">
      <h2>${escapeHtml(t('ui.today_done'))}</h2>
      ${programLine}
      ${rows}
      <div class="summary-row summary-total"><span class="name">${escapeHtml(t('ui.total_sets'))}</span><span class="val">${toplamSet}</span></div>
      <div class="summary-row"><span class="name">${escapeHtml(t('ui.duration'))}</span><span class="val">${escapeHtml(fmtSure(sure))}</span></div>
      <button class="summary-browse-btn" id="summaryBrowseBtn" type="button">${escapeHtml(t('ui.programs_browse'))}</button>
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
  const browseBtn = document.getElementById('summaryBrowseBtn');
  if (browseBtn) browseBtn.addEventListener('click', () => openPrograms());
}

function openToday() {
  renderTodayModal();
  openModal('todayModal');
}

function renderTodayModal() {
  const body = document.getElementById('todayBody');
  if (!body) return;

  const program = PROGRAM[state.gun] || [];
  const dayLine = t('ui.day_label', { day: dayShort(state.gun), n: state.gun });

  if (program.length === 0) {
    const tomorrow = state.gun === 7 ? 1 : state.gun + 1;
    body.innerHTML = `
      <div class="today-head">
        <div class="today-day">${escapeHtml(dayLine)}</div>
        <span class="today-status today-status-rest">${escapeHtml(t('ui.today_status_rest'))}</span>
      </div>
      <div class="today-empty">
        <div class="today-empty-emoji">${escapeHtml(t('ui.rest_day_emoji'))}</div>
        <div>${escapeHtml(t('ui.rest_day'))}</div>
        <div class="today-empty-next">${escapeHtml(t('ui.rest_day_tomorrow', { day: dayShort(tomorrow) }))}</div>
      </div>
    `;
    return;
  }

  const sayim = {};
  state.setBitisleri.forEach(b => {
    sayim[b.hareketIdx] = (sayim[b.hareketIdx] || 0) + 1;
  });

  const totalSets = program.reduce((acc, ex) => acc + (ex.set || 0), 0);
  const doneSets = state.setBitisleri.length;
  const remainingSets = Math.max(0, totalSets - doneSets);
  const totalExercises = program.length;
  const doneExercises = program.reduce((acc, ex, idx) => acc + ((sayim[idx] || 0) >= ex.set ? 1 : 0), 0);

  const isComplete = state.hareketIdx >= program.length;
  const hasStarted = !!state.baslangic;
  let statusKey, statusClass;
  if (isComplete) { statusKey = 'ui.today_status_done'; statusClass = 'today-status-done'; }
  else if (hasStarted) { statusKey = 'ui.today_status_active'; statusClass = 'today-status-active'; }
  else { statusKey = 'ui.today_status_idle'; statusClass = 'today-status-idle'; }

  const elapsedMs = aktifMsLive();

  const stats = `
    <div class="today-stats">
      <div class="today-stat">
        <div class="today-stat-val">${doneSets}<span class="today-stat-of">/${totalSets}</span></div>
        <div class="today-stat-label">${escapeHtml(t('ui.today_sets_done'))}</div>
      </div>
      <div class="today-stat">
        <div class="today-stat-val">${doneExercises}<span class="today-stat-of">/${totalExercises}</span></div>
        <div class="today-stat-label">${escapeHtml(t('ui.today_exercises_done'))}</div>
      </div>
      <div class="today-stat">
        <div class="today-stat-val">${hasStarted ? escapeHtml(fmtSure(elapsedMs)) : '—'}</div>
        <div class="today-stat-label">${escapeHtml(t('ui.today_elapsed'))}</div>
      </div>
    </div>
  `;

  let rows = '';
  program.forEach((ex, idx) => {
    const done = sayim[idx] || 0;
    const total = ex.set || 0;
    let stateClass, stateLabel;
    if (done >= total) { stateClass = 'is-done'; stateLabel = t('ui.today_ex_done'); }
    else if (idx === state.hareketIdx) { stateClass = 'is-active'; stateLabel = t('ui.today_ex_active'); }
    else { stateClass = 'is-pending'; stateLabel = t('ui.today_ex_pending'); }

    rows += `
      <div class="today-ex-row ${stateClass}">
        <div class="today-ex-marker" aria-hidden="true"></div>
        <div class="today-ex-body">
          <div class="today-ex-region">${escapeHtml(ex.region || '')}</div>
          <div class="today-ex-name">${escapeHtml(ex.name || '')}</div>
          <div class="today-ex-meta">${escapeHtml(t('ui.rep_set', { reps: ex.reps, set: Math.min(done + 1, total), total }))} · ${ex.rest}s</div>
        </div>
        <div class="today-ex-progress">
          <div class="today-ex-count">${done}<span class="today-stat-of">/${total}</span></div>
          <div class="today-ex-state">${escapeHtml(stateLabel)}</div>
        </div>
      </div>
    `;
  });

  let remainingLine = '';
  if (!isComplete && remainingSets > 0) {
    remainingLine = `<div class="today-remaining">${escapeHtml(t('ui.today_remaining_sets', { n: remainingSets }))}</div>`;
  }

  body.innerHTML = `
    <div class="today-head">
      <div class="today-day">${escapeHtml(dayLine)}</div>
      <span class="today-status ${statusClass}">${escapeHtml(t(statusKey))}</span>
    </div>
    ${stats}
    ${remainingLine}
    <div class="today-list">${rows}</div>
  `;
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
document.getElementById('programsBtn').addEventListener('click', () => openPrograms());
document.getElementById('settingsBtn').addEventListener('click', () => openSettings());
document.getElementById('dayInfo').addEventListener('click', () => openToday());

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
  setProgramCustomized(true);
  PROGRAM = await loadProgram();
  await syncCurrentMeta();
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
    const importedMeta = pickPresetMeta(parsed);
    saveProgramMeta(importedMeta);
    setProgramCustomized(!importedMeta);
    PROGRAM = await loadProgram();
    await syncCurrentMeta();
    programDraft = deepClone(PROGRAM);
    renderDayEditor();
  } catch (err) {
    alert(t('ui.import_error'));
  }
});

document.getElementById('resetProgramBtn').addEventListener('click', async () => {
  if (!confirm(t('ui.reset_default_confirm'))) return;
  localStorage.removeItem(PROGRAM_KEY);
  saveProgramMeta(null);
  setProgramCustomized(false);
  PROGRAM = await loadProgram();
  await syncCurrentMeta();
  programDraft = deepClone(PROGRAM);
  renderDayEditor();
});

// ============================================
// Programs modal — preset library (lazy-loaded)
// ============================================
const PROGRAMS_REPO_URL = 'https://github.com/mybottles/nobro-app/tree/main/presets';
let currentMeta = null;

async function syncCurrentMeta() {
  let meta = loadProgramMeta();
  if (!meta) {
    let hasSavedProgram = false;
    try { hasSavedProgram = !!localStorage.getItem(PROGRAM_KEY); } catch (e) {}
    if (!hasSavedProgram) {
      const idx = await loadPresetIndex();
      const def = idx.find(p => p.id === DEFAULT_PRESET_ID);
      if (def) meta = pickPresetMeta(def);
    }
  }
  currentMeta = meta;
  return currentMeta;
}

function programSummaryCounts(days) {
  let exercises = 0, sets = 0, activeDays = 0;
  for (const k of ['1','2','3','4','5','6','7']) {
    const arr = days[k] || [];
    if (arr.length) activeDays++;
    arr.forEach(e => {
      exercises++;
      sets += (parseInt(e.set, 10) || 0);
    });
  }
  return { exercises, sets, activeDays };
}

function renderCoachLine(coach) {
  if (!coach || !coach.name) return '';
  const name = escapeHtml(coach.name);
  if (coach.url) {
    return `<a class="program-coach-link" href="${escapeHtml(coach.url)}" target="_blank" rel="nofollow noopener">${name}</a>`;
  }
  return `<span class="program-coach-name">${name}</span>`;
}

function renderProgramDetails(days) {
  if (!days) return '';
  let html = '';
  for (let d = 1; d <= 7; d++) {
    const arr = (days[String(d)] || []).slice();
    const dayName = escapeHtml(dayShort(d));
    if (arr.length === 0) {
      html += `<div class="program-day-block program-day-rest">
        <span class="program-day-name">${dayName}</span>
        <span class="program-day-rest-tag">${escapeHtml(t('ui.programs_rest_day'))}</span>
      </div>`;
      continue;
    }
    let rows = '';
    arr.forEach(ex => {
      const reps = escapeHtml(String(ex.reps));
      const set = parseInt(ex.set, 10) || 0;
      const rest = parseInt(ex.rest, 10) || 0;
      rows += `<div class="program-ex-row">
        <span class="program-ex-region">${escapeHtml(ex.region || '')}</span>
        <span class="program-ex-name">${escapeHtml(ex.name || '')}</span>
        <span class="program-ex-spec">${set}×${reps} · ${rest}s</span>
      </div>`;
    });
    html += `<div class="program-day-block">
      <div class="program-day-header"><span class="program-day-name">${dayName}</span> <span class="program-day-count">${arr.length}</span></div>
      ${rows}
    </div>`;
  }
  return html;
}

function renderCurrentProgramCard() {
  const wrap = document.getElementById('currentProgramCard');
  if (!wrap) return;
  const meta = currentMeta;
  const counts = programSummaryCounts(PROGRAM || {});
  const customized = isProgramCustomized();

  let nameLine, descLine, coachLine;
  if (meta) {
    const customSuffix = customized ? ` <span class="program-custom-tag">${escapeHtml(t('ui.programs_customized'))}</span>` : '';
    nameLine = `${escapeHtml(meta.name || t('ui.programs_unnamed'))}${customSuffix}`;
    descLine = meta.description ? escapeHtml(meta.description) : '';
    coachLine = meta.coach ? `${escapeHtml(t('ui.programs_coach_by'))} ${renderCoachLine(meta.coach)}` : '';
  } else {
    nameLine = `${escapeHtml(t('ui.programs_unnamed'))} <span class="program-custom-tag">${escapeHtml(t('ui.programs_customized'))}</span>`;
    descLine = '';
    coachLine = '';
  }

  const stats = `${counts.exercises} ${escapeHtml(t('ui.programs_exercises'))} · ${counts.sets} ${escapeHtml(t('ui.programs_sets'))} · ${counts.activeDays}/7 ${escapeHtml(t('ui.programs_days'))}`;

  wrap.innerHTML = `
    <div class="program-current-label">${escapeHtml(t('ui.programs_current'))}</div>
    <div class="program-current-name">${nameLine} <span class="program-card-toggle" aria-hidden="true">▾</span></div>
    ${descLine ? `<div class="program-current-desc">${descLine}</div>` : ''}
    ${coachLine ? `<div class="program-current-coach">${coachLine}</div>` : ''}
    <div class="program-current-stats">${stats}</div>
    <div class="program-card-details" id="currentProgramDetails" hidden></div>
  `;
}

function renderProgramsList(presets) {
  const wrap = document.getElementById('programsList');
  if (!wrap) return;
  if (!presets || !presets.length) {
    wrap.innerHTML = `<div class="programs-empty">${escapeHtml(t('ui.programs_load_error'))}</div>`;
    return;
  }
  const activeId = currentMeta && currentMeta.id;
  const customized = isProgramCustomized();
  let html = '';
  for (const p of presets) {
    const isActive = activeId === p.id && !customized;
    const coach = p.coach
      ? `<div class="program-card-coach">${escapeHtml(t('ui.programs_coach_by'))} ${renderCoachLine(p.coach)}</div>`
      : '';
    const desc = p.description ? `<div class="program-card-desc">${escapeHtml(p.description)}</div>` : '';
    const cta = isActive
      ? `<span class="program-card-active">${escapeHtml(t('ui.programs_active'))}</span>`
      : `<button class="program-apply-btn" type="button" data-apply="${escapeHtml(p.id)}">${escapeHtml(t('ui.programs_apply'))}</button>`;
    html += `
      <div class="program-card${isActive ? ' is-active' : ''}" data-card-id="${escapeHtml(p.id)}">
        <div class="program-card-name">${escapeHtml(p.name || p.id)} <span class="program-card-toggle" aria-hidden="true">▾</span></div>
        ${desc}
        ${coach}
        <div class="program-card-details" hidden></div>
        <div class="program-card-cta">${cta}</div>
      </div>
    `;
  }
  wrap.innerHTML = html;
}

async function openPrograms() {
  await syncCurrentMeta();
  renderCurrentProgramCard();
  const wrap = document.getElementById('programsList');
  if (wrap) wrap.innerHTML = `<div class="programs-loading">…</div>`;
  openModal('programsModal');
  const presets = await loadPresetIndex();
  renderProgramsList(presets);
}

async function applyPreset(id) {
  const idx = await loadPresetIndex();
  const entry = idx.find(p => p.id === id);
  if (!entry) { alert(t('ui.programs_load_error')); return; }
  if (!confirm(t('ui.programs_apply_confirm', { name: entry.name || id }))) return;

  const preset = await loadPresetById(id);
  if (!preset) { alert(t('ui.programs_load_error')); return; }

  saveCustomProgram(preset.days);
  saveProgramMeta(preset.meta || pickPresetMeta(entry));
  setProgramCustomized(false);

  // Reset today's progress so the summary stays consistent with the new program.
  try { localStorage.removeItem(STORAGE_KEY); } catch (e) {}
  state = loadState();

  PROGRAM = await loadProgram();
  await syncCurrentMeta();
  closeModal(document.getElementById('programsModal'));
  render();
}

async function togglePresetCardExpand(card) {
  const id = card.dataset.cardId;
  const details = card.querySelector('.program-card-details');
  if (!details || !id) return;
  if (!details.hidden) {
    details.hidden = true;
    card.classList.remove('is-expanded');
    return;
  }
  if (!details.dataset.loaded) {
    details.innerHTML = `<div class="programs-loading">…</div>`;
    details.hidden = false;
    card.classList.add('is-expanded');
    const days = await getPresetDays(id);
    if (days) {
      details.innerHTML = renderProgramDetails(days);
      details.dataset.loaded = '1';
    } else {
      details.innerHTML = `<div class="programs-empty">${escapeHtml(t('ui.programs_load_error'))}</div>`;
    }
  } else {
    details.hidden = false;
    card.classList.add('is-expanded');
  }
}

function toggleCurrentCardExpand() {
  const card = document.getElementById('currentProgramCard');
  const details = document.getElementById('currentProgramDetails');
  if (!card || !details) return;
  if (!details.hidden) {
    details.hidden = true;
    card.classList.remove('is-expanded');
    return;
  }
  details.innerHTML = renderProgramDetails(PROGRAM);
  details.hidden = false;
  card.classList.add('is-expanded');
}

document.getElementById('programsList').addEventListener('click', async (e) => {
  const applyBtn = e.target.closest('button[data-apply]');
  if (applyBtn) {
    await applyPreset(applyBtn.dataset.apply);
    return;
  }
  if (e.target.closest('a')) return;
  const card = e.target.closest('.program-card[data-card-id]');
  if (card) await togglePresetCardExpand(card);
});

document.getElementById('currentProgramCard').addEventListener('click', (e) => {
  if (e.target.closest('a')) return;
  toggleCurrentCardExpand();
});

// ============================================
// PWA — service worker
// ============================================
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).catch(() => {});
  });
}

// ============================================
// Boot
// ============================================
(async () => {
  await initI18n();
  PROGRAM = await loadProgram();
  await syncCurrentMeta();
  render();
  requestWakeLock();
})();
