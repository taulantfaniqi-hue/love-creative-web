/* LOVE Creative — Reservations-Widget (Bottom-Sheet)
 *
 * Rollt sich von unten auf: Gäste → Datum → Zeitfenster wählen, darunter
 * erscheinen die passenden Erlebnisse als Karten (Guestplan-Prinzip).
 * Bucht über LoveData.addBooking → landet wie das grosse Formular im CRM.
 *
 * Einbindung (nach love-data.js und love-site.js):
 *   <link rel="stylesheet" href="assets/css/love-widget.css">
 *   <script src="assets/js/love-widget.js"></script>
 */
(() => {
'use strict';
/* LoveData ist eine top-level const (kein window-Property) → typeof-Check */
if (!window.LoveSite || !window.LoveTables || typeof LoveData === 'undefined') return;
const T = window.LoveTables;

/* ═══════════ Texte (eigenes Mini-i18n, hört auf love:lang) ═══════════ */
const TX = {
  de: {
    launcher: 'Tisch reservieren',
    script: 'Reserve your moment',
    close: 'Schliessen',
    guests: n => n === 1 ? '1 Gast' : `${n} Gäste`,
    guestsEvent: '9+ Gäste — Event',
    today: 'Heute', tomorrow: 'Morgen',
    until: 'bis',
    hours3: '3 Std.',
    kino: 'Kino-Night ♥',
    full: 'ausgebucht',
    monthNames: ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'],
    weekdays: ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'],
    divider: 'Verfügbar für deine Auswahl',
    eventNote: 'Ab 9 Personen planen wir mit euch ein Event — mit Verpflegung und eigenem Zeitplan.',
    eventLink: 'Zum Eventplaner →',
    formTitle: sel => `Fast geschafft — ${sel}`,
    name: 'Name', email: 'E-Mail', note: 'Nachricht (optional)',
    submit: 'Reservation anfragen',
    okTitle: 'Reservation eingegangen!',
    okText: 'Wir bestätigen dir deinen Tisch innert 24 Stunden per E-Mail.',
    okKino: 'Kino-Night: Programm und Format schicken wir dir mit der Bestätigung.',
    okClose: 'Alles klar ♥',
    foot: 'Alle Details & Raumplan ansehen →',
    persons: 'Personen',
    acts: {
      keramik: { title: 'Keramik bemalen', desc: 'Rohling aussuchen, bemalen, wir glasieren und brennen — nach 7–10 Tagen abholen.', price: 'CHF 25 Service + Stück ab CHF 10' },
      cafe:    { title: 'Nur Café', desc: 'Kaffee, Matcha, Bowls und Apéro — einfach gemütlich sitzen und geniessen.', price: 'à la carte' },
      candle:  { title: 'Kerzen giessen', desc: 'Deine eigene Sojakerze — von Fresh Fig bis Wild Rose, fertig zum Mitnehmen.', price: 'CHF 18 p. P.' },
      floral:  { title: 'Floral Bar', desc: 'Blumen wählen, Bouquet binden — wir zeigen dir, wie es hält.', price: 'nach Auswahl' },
      kino:    { title: 'Kino-Night', desc: 'Film, Keramikstück und Snacks inklusive — jeden Freitagabend.', price: 'ab CHF 38 p. P.' }
    }
  },
  en: {
    launcher: 'Reserve a table',
    script: 'Reserve your moment',
    close: 'Close',
    guests: n => n === 1 ? '1 guest' : `${n} guests`,
    guestsEvent: '9+ guests — event',
    today: 'Today', tomorrow: 'Tomorrow',
    until: 'until',
    hours3: '3 hrs',
    kino: 'Cinema Night ♥',
    full: 'fully booked',
    monthNames: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
    weekdays: ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'],
    divider: 'Available for your selection',
    eventNote: 'From 9 people we plan an event with you — with catering and your own timing.',
    eventLink: 'Go to event planner →',
    formTitle: sel => `Almost there — ${sel}`,
    name: 'Name', email: 'E-mail', note: 'Message (optional)',
    submit: 'Request reservation',
    okTitle: 'Reservation received!',
    okText: 'We confirm your table by e-mail within 24 hours.',
    okKino: 'Cinema Night: we send you the programme with the confirmation.',
    okClose: 'All set ♥',
    foot: 'See all details & floor plan →',
    persons: 'people',
    acts: {
      keramik: { title: 'Paint ceramics', desc: 'Pick a piece, paint it — we glaze and fire it, ready in 7–10 days.', price: 'CHF 25 service + pieces from CHF 10' },
      cafe:    { title: 'Café only', desc: 'Coffee, matcha, bowls and apéro — just sit back and enjoy.', price: 'à la carte' },
      candle:  { title: 'Pour candles', desc: 'Your own soy candle — from Fresh Fig to Wild Rose, ready to take home.', price: 'CHF 18 p. p.' },
      floral:  { title: 'Floral Bar', desc: 'Choose your flowers and bind a bouquet — we show you how.', price: 'by selection' },
      kino:    { title: 'Cinema Night', desc: 'Film, ceramic piece and snacks included — every Friday evening.', price: 'from CHF 38 p. p.' }
    }
  }
};
/* Echte Fotos folgen — bis dahin überall der Platzhalter.
   Originale: studio_bemalen.png · interior-cafe-counter.jpeg ·
   widget-candle.jpeg · illus-flower-workshop.jpeg · studio-og.jpeg */
const ACT_IMG = {
  keramik: 'assets/img/platzhalter.svg',
  cafe: 'assets/img/platzhalter.svg',
  candle: 'assets/img/platzhalter.svg',
  floral: 'assets/img/platzhalter.svg',
  kino: 'assets/img/platzhalter.svg'
};
const tw = () => TX[LoveSite.lang()] || TX.de;

/* ═══════════ Zustand ═══════════ */
const state = {
  guests: 2,
  date: LoveSite.todayISO(),
  slot: T.SLOTS[0],
  act: null,       // gewählte Aktivität
  done: null       // Buchung nach Erfolg
};

/* ═══════════ Markup einfügen ═══════════ */
document.body.insertAdjacentHTML('beforeend', `
<button class="lw-launcher" id="lwLauncher" type="button" aria-haspopup="dialog" aria-expanded="false">
  <span class="lw-heart" aria-hidden="true">♥</span><span id="lwLauncherTxt"></span>
</button>
<div class="lw-backdrop" id="lwBackdrop"></div>
<div class="lw-sheet" id="lwSheet" role="dialog" aria-modal="true" aria-labelledby="lwTitle">
  <div class="lw-head">
    <span class="lw-script" id="lwTitle"></span>
    <button class="lw-close" id="lwClose" type="button" aria-label="Schliessen">✕</button>
  </div>
  <div class="lw-rows">
    <label class="lw-row"><span class="lw-ic" aria-hidden="true">👤</span>
      <select id="lwGuests"></select><span class="lw-chev" aria-hidden="true">▼</span>
    </label>
    <div class="lw-row lw-daterow">
      <button type="button" class="lw-datebtn" id="lwDateBtn" aria-haspopup="dialog" aria-expanded="false">
        <span class="lw-ic" aria-hidden="true">📅</span><span id="lwDateTxt"></span><span class="lw-chev" aria-hidden="true">▼</span>
      </button>
      <div class="lw-cal hidden" id="lwCal"></div>
    </div>
    <label class="lw-row"><span class="lw-ic" aria-hidden="true">🕐</span>
      <select id="lwSlot"></select>
      <span class="lw-until" id="lwUntil"></span><span class="lw-chev" aria-hidden="true">▼</span>
    </label>
  </div>
  <div class="lw-divider" id="lwDivider"></div>
  <div class="lw-scroll">
    <div class="lw-cards" id="lwCards"></div>
    <div id="lwFormWrap"></div>
  </div>
  <div class="lw-foot"><a href="reservieren.html#formular" id="lwFootLink"></a></div>
</div>`);

const $ = id => document.getElementById(id);
const sheet = $('lwSheet'), backdrop = $('lwBackdrop'), launcher = $('lwLauncher');

/* ═══════════ Render ═══════════ */
function fmtDate(iso) {
  const x = tw();
  const d = new Date(iso + 'T12:00:00');
  const locale = LoveSite.lang() === 'en' ? 'en-GB' : 'de-CH';
  const dayMonth = d.toLocaleDateString(locale, { day: 'numeric', month: 'long' });
  const diff = Math.round((d - new Date(LoveSite.todayISO() + 'T12:00:00')) / 864e5);
  if (diff === 0) return `${x.today}, ${dayMonth}`;
  if (diff === 1) return `${x.tomorrow}, ${dayMonth}`;
  return `${d.toLocaleDateString(locale, { weekday: 'long' })}, ${dayMonth}`;
}
/* Schliesstage aus dem Google-Kalender (via Cloud-API) — z. B. Ferien,
   die in SumUp/Google gepflegt werden, verschwinden aus der Datumsauswahl. */
const closedDays = new Set();
function loadClosures() {
  if (typeof LoveCloud === 'undefined') return;
  LoveCloud.call('closures').then(r => {
    if (!r.ok || !Array.isArray(r.closures)) return;
    r.closures.forEach(c => {
      if (!/geschlossen|closed|ferien|feiertag|holiday|betriebsferien/i.test(c.title || '')) return;
      let d = new Date((c.start || '') + 'T12:00:00');
      const end = new Date((c.end || c.start || '') + 'T12:00:00');
      if (isNaN(d) || isNaN(end)) return;
      for (let i = 0; d < end && i < 60; i++, d = new Date(d.getTime() + 864e5)) {
        closedDays.add(d.toISOString().slice(0, 10));
      }
    });
    if (closedDays.size) {
      if (closedDays.has(state.date)) state.date = dateOptions()[0];
      renderDates(); renderSlots(); renderCards();
    }
  }).catch(() => {});
}
const HORIZON_DAYS = 60; // so weit im Voraus kann online reserviert werden
function dateOptions() {
  const out = [];
  const base = new Date(LoveSite.todayISO() + 'T12:00:00');
  for (let i = 0; i < HORIZON_DAYS; i++) {
    const d = new Date(base.getTime() + i * 864e5);
    const iso = d.toISOString().slice(0, 10);
    if (!closedDays.has(iso)) out.push(iso);
  }
  return out.length ? out : [LoveSite.todayISO()];
}
function selectable(iso) { return dateOptions().includes(iso); }

/* ── Dienstleistungen aus der Cloud (im Host-Bereich verwaltbar) ── */
let services = null;
function loadServices() {
  if (typeof LoveCloud === 'undefined') return;
  LoveCloud.call('services').then(r => {
    if (r.ok && Array.isArray(r.services) && r.services.length) { services = r.services; renderCards(); }
  }).catch(() => {});
}
function actList() {
  const en = LoveSite.lang() === 'en';
  if (services) {
    return services.map(s => ({
      id: s.id,
      title: en ? (s.label_en || s.label_de) : s.label_de,
      desc: en ? (s.desc_en || s.desc_de) : s.desc_de,
      price: s.price
    }));
  }
  const x = tw();
  return Object.entries(x.acts).map(([id, c]) => ({ id, title: c.title, desc: c.desc, price: c.price }));
}

/* ── Tisch-Verfügbarkeit pro Datum (Cloud) ── */
const availCache = {};
function loadAvailability(date) {
  if (availCache[date] || typeof LoveCloud === 'undefined') return;
  LoveCloud.call('availability&date=' + encodeURIComponent(date)).then(r => {
    if (r.ok) { availCache[date] = r; renderSlots(); renderCards(); }
  }).catch(() => {});
}
function slotFull(date, slot, guests) {
  const kind = T.suggest(guests);
  if (!kind || kind === 'event') return false;
  const a = availCache[date];
  if (!a) return false;
  const booked = (a.booked && a.booked[slot] && a.booked[slot][kind]) || 0;
  const inv = (a.inventory && a.inventory[kind]) || T.INVENTORY[kind] || 99;
  return booked >= inv;
}

function renderStatic() {
  const x = tw();
  $('lwLauncherTxt').textContent = x.launcher;
  $('lwTitle').textContent = x.script;
  $('lwClose').setAttribute('aria-label', x.close);
  $('lwDivider').textContent = x.divider;
  $('lwFootLink').textContent = x.foot;
}
function renderGuests() {
  const x = tw();
  $('lwGuests').innerHTML =
    Array.from({ length: 8 }, (_, i) => `<option value="${i + 1}" ${state.guests === i + 1 ? 'selected' : ''}>${x.guests(i + 1)}</option>`).join('') +
    `<option value="9" ${state.guests >= 9 ? 'selected' : ''}>${x.guestsEvent}</option>`;
}

/* ── Aufklappbarer Kalender fürs Datum ── */
let calMonth = null; // Date auf den 1. des angezeigten Monats
function renderDates() {
  $('lwDateTxt').textContent = fmtDate(state.date);
  if (!$('lwCal').classList.contains('hidden')) renderCal();
}
function renderCal() {
  const x = tw();
  if (!calMonth) { const d = new Date(state.date + 'T12:00:00'); calMonth = new Date(d.getFullYear(), d.getMonth(), 1, 12); }
  const y = calMonth.getFullYear(), m = calMonth.getMonth();
  const first = new Date(y, m, 1, 12);
  const startCol = (first.getDay() + 6) % 7; // Montag = 0
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const todayIso = LoveSite.todayISO();
  const maxIso = new Date(new Date(todayIso + 'T12:00:00').getTime() + (HORIZON_DAYS - 1) * 864e5).toISOString().slice(0, 10);
  const canPrev = new Date(y, m, daysInMonth, 12).toISOString().slice(0, 10) >= todayIso && (y > new Date().getFullYear() || m > new Date().getMonth());
  const canNext = new Date(y, m + 1, 1, 12).toISOString().slice(0, 10) <= maxIso;
  let cells = '';
  for (let i = 0; i < startCol; i++) cells += '<span class="lw-cal-day lw-cal-empty"></span>';
  for (let day = 1; day <= daysInMonth; day++) {
    const iso = `${y}-${String(m + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const ok = iso >= todayIso && iso <= maxIso && !closedDays.has(iso);
    cells += `<button type="button" class="lw-cal-day${iso === state.date ? ' sel' : ''}${iso === todayIso ? ' today' : ''}" data-iso="${iso}" ${ok ? '' : 'disabled'}>${day}</button>`;
  }
  $('lwCal').innerHTML = `
    <div class="lw-cal-head">
      <button type="button" class="lw-cal-nav" id="lwCalPrev" ${canPrev ? '' : 'disabled'} aria-label="‹">‹</button>
      <b>${x.monthNames[m]} ${y}</b>
      <button type="button" class="lw-cal-nav" id="lwCalNext" ${canNext ? '' : 'disabled'} aria-label="›">›</button>
    </div>
    <div class="lw-cal-grid">
      ${x.weekdays.map(w => `<span class="lw-cal-wd">${w}</span>`).join('')}
      ${cells}
    </div>`;
  $('lwCalPrev').addEventListener('click', e => { e.stopPropagation(); calMonth = new Date(y, m - 1, 1, 12); renderCal(); });
  $('lwCalNext').addEventListener('click', e => { e.stopPropagation(); calMonth = new Date(y, m + 1, 1, 12); renderCal(); });
  $('lwCal').querySelectorAll('.lw-cal-day[data-iso]').forEach(btn => btn.addEventListener('click', () => {
    state.date = btn.dataset.iso;
    toggleCal(false);
    loadAvailability(state.date);
    renderDates(); renderSlots(); renderCards();
  }));
}
function toggleCal(open) {
  const cal = $('lwCal');
  const willOpen = open === undefined ? cal.classList.contains('hidden') : open;
  cal.classList.toggle('hidden', !willOpen);
  $('lwDateBtn').setAttribute('aria-expanded', String(willOpen));
  if (willOpen) { calMonth = null; renderCal(); }
}

function renderSlots() {
  const x = tw();
  const fullSel = slotFull(state.date, state.slot, state.guests);
  if (fullSel) {
    const free = T.SLOTS.find(s => !slotFull(state.date, s, state.guests));
    if (free) state.slot = free;
  }
  $('lwSlot').innerHTML = T.SLOTS.map(s => {
    const kino = T.isKinoSlot(state.date, s);
    const full = slotFull(state.date, s, state.guests);
    return `<option value="${s}" ${state.slot === s ? 'selected' : ''} ${full ? 'disabled' : ''}>${s.split('–')[0]} · ${full ? x.full : (kino ? x.kino : x.hours3)}</option>`;
  }).join('');
  $('lwUntil').textContent = `${x.until} ${state.slot.split('–')[1]}`;
}
function renderCards() {
  const x = tw();
  const box = $('lwCards');
  if (state.done) { box.innerHTML = ''; renderResult(); return; }
  if (state.guests >= 9) {
    box.innerHTML = `<div class="lw-event-note">${x.eventNote}<br><a href="index.html#eventplaner">${x.eventLink}</a></div>`;
    $('lwFormWrap').innerHTML = '';
    return;
  }
  if (slotFull(state.date, state.slot, state.guests)) {
    box.innerHTML = `<div class="lw-event-note">${LoveSite.t('err.full')}</div>`;
    $('lwFormWrap').innerHTML = '';
    return;
  }
  const kino = T.isKinoSlot(state.date, state.slot);
  let acts = actList();
  acts = kino ? [...acts.filter(a => a.id === 'kino'), ...acts.filter(a => a.id !== 'kino')]
              : acts.filter(a => a.id !== 'kino');
  const esc = s => String(s || '').replace(/[&<>"]/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[m]));
  box.innerHTML = acts.map(a => `
    <button type="button" class="lw-card" data-act="${esc(a.id)}" aria-pressed="${state.act === a.id}">
      <span class="lw-imgwrap">
        ${a.id === 'kino' ? `<span class="lw-kino-flag">${x.kino}</span>` : ''}
        <img src="${ACT_IMG[a.id] || 'assets/img/platzhalter.svg'}" alt="" loading="lazy">
        <span class="lw-price">${esc(a.price)}</span>
      </span>
      <h4>${esc(a.title)}</h4><p>${esc(a.desc)}</p>
    </button>`).join('');
  box.querySelectorAll('.lw-card').forEach(b => b.addEventListener('click', () => {
    state.act = b.dataset.act;
    renderCards(); renderForm();
    $('lwFormWrap').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }));
  renderForm();
}
function renderForm() {
  const x = tw();
  const wrap = $('lwFormWrap');
  if (!state.act || state.done) { wrap.innerHTML = ''; return; }
  const acc = (typeof LoveAccount !== 'undefined' && LoveAccount.current()) || null;
  const prevName = (wrap.querySelector('#lwName') ? wrap.querySelector('#lwName').value : '') || (acc ? acc.name : '');
  const prevMail = (wrap.querySelector('#lwEmail') ? wrap.querySelector('#lwEmail').value : '') || (acc ? acc.email : '');
  const prevNote = wrap.querySelector('#lwNote') ? wrap.querySelector('#lwNote').value : '';
  const act = actList().find(a => a.id === state.act);
  wrap.innerHTML = `
  <form class="lw-form" id="lwForm" novalidate>
    <h5>${x.formTitle(act ? act.title : '')}</h5>
    <input type="text" id="lwName" autocomplete="name" placeholder="${x.name}" value="${prevName.replace(/"/g, '&quot;')}">
    <input type="email" id="lwEmail" autocomplete="email" placeholder="${x.email}" value="${prevMail.replace(/"/g, '&quot;')}">
    <input type="text" id="lwNote" placeholder="${x.note}" value="${prevNote.replace(/"/g, '&quot;')}">
    <p class="lw-err" id="lwErr" aria-live="polite"></p>
    <button type="submit" class="btn btn-rose btn-block">${x.submit}</button>
    <p class="lw-cancel-hint">${LoveSite.t('cancel.hint')}</p>
  </form>`;
  $('lwForm').addEventListener('submit', submit);
}
function renderResult() {
  const x = tw();
  const b = state.done;
  const locale = LoveSite.lang() === 'en' ? 'en-GB' : 'de-CH';
  $('lwFormWrap').innerHTML = `
  <div class="lw-success" aria-live="polite">
    <h4>${x.okTitle}</h4>
    <p>${x.okText}</p>
    ${b.type === 'kino' ? `<p>${x.okKino}</p>` : ''}
    <p class="lw-ref">${LoveSite.t('ref.lbl')}${b.id}</p>
    <p><b>${new Date(b.date + 'T12:00:00').toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long' })}</b> · ${b.time} · ${b.persons} ${x.persons}</p>
    <button type="button" class="btn btn-rose btn-block" id="lwDone">${x.okClose}</button>
  </div>`;
  $('lwDone').addEventListener('click', closeSheet);
  if (b.type === 'kino' && typeof LovePay !== 'undefined') LovePay.mountButton($('lwFormWrap').querySelector('.lw-success'), 'kino', { email: b.email, name: b.name });
}
function renderAll() { renderStatic(); renderGuests(); renderDates(); renderSlots(); renderCards(); }

/* ═══════════ Absenden ═══════════ */
function submit(e) {
  e.preventDefault();
  const x = tw();
  const name = $('lwName').value.trim(), email = $('lwEmail').value.trim();
  if (!name || !LoveSite.validEmail(email)) { $('lwErr').textContent = LoveSite.t('err.required'); return; }
  if (slotFull(state.date, state.slot, state.guests)) { $('lwErr').textContent = LoveSite.t('err.full'); return; }
  const kino = T.isKinoSlot(state.date, state.slot) && state.act === 'kino';
  state.done = LoveData.addBooking({
    type: kino ? 'kino' : 'tisch',
    name, email, phone: '',
    date: state.date, time: state.slot, persons: state.guests,
    area: 'egal', table_type: T.suggest(state.guests),
    world: state.act === 'kino' ? 'keramik' : state.act,
    message: ($('lwNote').value.trim() ? $('lwNote').value.trim() + ' ' : '') + '[Widget]',
    lang: LoveSite.lang()
  });
  renderCards();
}

/* ═══════════ Öffnen / Schliessen ═══════════ */
let lastFocus = null;
function openSheet() {
  lastFocus = document.activeElement;
  if (state.done) { state.done = null; state.act = null; }
  state.date = dateOptions().includes(state.date) ? state.date : dateOptions()[0];
  loadAvailability(state.date);
  renderAll();
  sheet.classList.add('open'); backdrop.classList.add('open');
  launcher.classList.add('lw-hidden');
  launcher.setAttribute('aria-expanded', 'true');
  $('lwClose').focus({ preventScroll: true });
}
function closeSheet() {
  sheet.classList.remove('open'); backdrop.classList.remove('open');
  launcher.classList.remove('lw-hidden');
  launcher.setAttribute('aria-expanded', 'false');
  if (lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true });
}
launcher.addEventListener('click', openSheet);
$('lwClose').addEventListener('click', closeSheet);
backdrop.addEventListener('click', closeSheet);
addEventListener('keydown', e => { if (e.key === 'Escape' && sheet.classList.contains('open')) closeSheet(); });

/* ═══════════ Eingaben ═══════════ */
const scrollTop = () => { const sc = sheet.querySelector('.lw-scroll'); if (sc) sc.scrollTop = 0; };
$('lwGuests').addEventListener('change', e => { state.guests = Number(e.target.value); renderSlots(); renderCards(); scrollTop(); });
$('lwDateBtn').addEventListener('click', e => { e.stopPropagation(); toggleCal(); });
document.addEventListener('click', e => {
  if (!$('lwCal').classList.contains('hidden') && !$('lwCal').contains(e.target) && e.target !== $('lwDateBtn')) toggleCal(false);
});
$('lwSlot').addEventListener('change', e => { state.slot = e.target.value; renderSlots(); renderCards(); scrollTop(); });

/* Sprache gewechselt → alles neu beschriften */
document.addEventListener('love:lang', () => { renderAll(); if (state.done) renderResult(); });

renderAll();
loadClosures();
loadServices();
loadAvailability(state.date);
document.addEventListener('love:cloud', e => {
  if (!e.detail) return;
  if (!closedDays.size) loadClosures();
  if (!services) loadServices();
  loadAvailability(state.date);
});
})();
