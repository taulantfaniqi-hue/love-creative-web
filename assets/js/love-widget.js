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
    guestsEvent: '11+ Gäste — Event',
    today: 'Heute', tomorrow: 'Morgen',
    until: 'bis',
    hours3: '3 Std.',
    kino: 'Kino-Night ♥',
    divider: 'Verfügbar für deine Auswahl',
    eventNote: 'Ab 11 Personen planen wir mit euch ein Event — mit Verpflegung und eigenem Zeitplan.',
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
      keramik: { title: 'Keramik bemalen', desc: 'Rohling aussuchen, bemalen, wir glasieren und brennen — nach 7–10 Tagen abholen.', price: 'ab CHF 22 / Stück' },
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
    guestsEvent: '11+ guests — event',
    today: 'Today', tomorrow: 'Tomorrow',
    until: 'until',
    hours3: '3 hrs',
    kino: 'Cinema Night ♥',
    divider: 'Available for your selection',
    eventNote: 'From 11 people we plan an event with you — with catering and your own timing.',
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
      keramik: { title: 'Paint ceramics', desc: 'Pick a piece, paint it — we glaze and fire it, ready in 7–10 days.', price: 'from CHF 22 / piece' },
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
    <label class="lw-row"><span class="lw-ic" aria-hidden="true">📅</span>
      <select id="lwDate"></select><span class="lw-chev" aria-hidden="true">▼</span>
    </label>
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
function dateOptions() {
  const out = [];
  const base = new Date(LoveSite.todayISO() + 'T12:00:00');
  for (let i = 0; i < 21; i++) {
    const d = new Date(base.getTime() + i * 864e5);
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
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
    Array.from({ length: 10 }, (_, i) => `<option value="${i + 1}" ${state.guests === i + 1 ? 'selected' : ''}>${x.guests(i + 1)}</option>`).join('') +
    `<option value="11" ${state.guests === 11 ? 'selected' : ''}>${x.guestsEvent}</option>`;
}
function renderDates() {
  $('lwDate').innerHTML = dateOptions().map(iso =>
    `<option value="${iso}" ${state.date === iso ? 'selected' : ''}>${fmtDate(iso)}</option>`).join('');
}
function renderSlots() {
  const x = tw();
  $('lwSlot').innerHTML = T.SLOTS.map(s => {
    const kino = T.isKinoSlot(state.date, s);
    return `<option value="${s}" ${state.slot === s ? 'selected' : ''}>${s.split('–')[0]} · ${kino ? x.kino : x.hours3}</option>`;
  }).join('');
  $('lwUntil').textContent = `${x.until} ${state.slot.split('–')[1]}`;
}
function renderCards() {
  const x = tw();
  const box = $('lwCards');
  if (state.done) { box.innerHTML = ''; renderResult(); return; }
  if (state.guests >= 11) {
    box.innerHTML = `<div class="lw-event-note">${x.eventNote}<br><a href="index.html#eventplaner">${x.eventLink}</a></div>`;
    $('lwFormWrap').innerHTML = '';
    return;
  }
  const kino = T.isKinoSlot(state.date, state.slot);
  const acts = kino ? ['kino', 'keramik', 'cafe', 'candle', 'floral'] : ['keramik', 'cafe', 'candle', 'floral'];
  box.innerHTML = acts.map(a => {
    const c = x.acts[a];
    return `<button type="button" class="lw-card" data-act="${a}" aria-pressed="${state.act === a}">
      <span class="lw-imgwrap">
        ${a === 'kino' ? `<span class="lw-kino-flag">${x.kino}</span>` : ''}
        <img src="${ACT_IMG[a]}" alt="" loading="lazy">
        <span class="lw-price">${c.price}</span>
      </span>
      <h4>${c.title}</h4><p>${c.desc}</p>
    </button>`;
  }).join('');
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
  wrap.innerHTML = `
  <form class="lw-form" id="lwForm" novalidate>
    <h5>${x.formTitle(x.acts[state.act].title)}</h5>
    <input type="text" id="lwName" autocomplete="name" placeholder="${x.name}" value="${prevName.replace(/"/g, '&quot;')}">
    <input type="email" id="lwEmail" autocomplete="email" placeholder="${x.email}" value="${prevMail.replace(/"/g, '&quot;')}">
    <input type="text" id="lwNote" placeholder="${x.note}" value="${prevNote.replace(/"/g, '&quot;')}">
    <p class="lw-err" id="lwErr" aria-live="polite"></p>
    <button type="submit" class="btn btn-rose btn-block">${x.submit}</button>
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
  state.date = dateOptions().includes(state.date) ? state.date : LoveSite.todayISO();
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
$('lwGuests').addEventListener('change', e => { state.guests = Number(e.target.value); renderCards(); scrollTop(); });
$('lwDate').addEventListener('change', e => { state.date = e.target.value; renderSlots(); renderCards(); scrollTop(); });
$('lwSlot').addEventListener('change', e => { state.slot = e.target.value; renderSlots(); renderCards(); scrollTop(); });

/* Sprache gewechselt → alles neu beschriften */
document.addEventListener('love:lang', () => { renderAll(); if (state.done) renderResult(); });

renderAll();
})();
