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
/* Das Reservations-Widget (schwebender Knopf + Bottom-Sheet) erscheint nur auf
   der Startseite und bei Walk-in — auf allen anderen Seiten nicht
   (Entscheid Taulant, 24.09.2026). */
const SEITE = (location.pathname.split('/').pop() || 'index.html').toLowerCase();
if (!['', 'index.html', 'walkin.html'].includes(SEITE)) return;
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
    name: 'Name', email: 'E-Mail', phone: 'Telefon (für Rückfragen)', note: 'Nachricht (optional)',
    gift: 'Gutschein-Code (optional, z. B. LOVE-XXXX-XXXX)',
    errPhone: 'Bitte gib eine Telefonnummer an — wir brauchen sie für Rückfragen zur Reservation.',
    submit: 'Reservation anfragen',
    guestsPriv: n => `${n} Personen`,
    privBadge: 'Private Keramik-Session',
    privNote: min => `An diesem Tag ist das Studio regulär geschlossen — buchbar ist eine <b>private Keramik-Session ab ${min} Personen</b>. Die Servicegebühr wird online vorbezahlt, die Keramikstücke zahlt ihr vor Ort.`,
    privFee: (n, chf) => `Servicegebühr: ${n} × CHF 25 = <b>CHF ${chf}</b> — jetzt online bezahlen`,
    priv24h: 'Absage bis 24 h vor dem Termin: volle Rückerstattung der Gebühr. Bei kurzfristigeren Buchungen oder Absagen unter 24 h gibt es keine Rückerstattung.',
    submitPay: chf => `Kostenpflichtig buchen — CHF ${chf} →`,
    privPayFail: 'Die Online-Zahlung ist gerade nicht erreichbar. Deine Anfrage ist gespeichert — wir melden uns per E-Mail mit dem Zahlungslink.',
    okTitle: 'Anfrage eingegangen!',
    okText: 'Du bekommst gleich eine E-Mail von uns. Bitte warte kurz, bis unser Team deine Buchung annimmt — die Bestätigung kommt ebenfalls per E-Mail.',
    okKino: 'Kino-Night: Programm und Format schicken wir dir mit der Bestätigung.',
    okClose: 'Alles klar ♥',
    foot: 'Alle Details & Raumplan ansehen →',
    persons: 'Personen',
    acts: {
      keramik: { title: 'Keramik bemalen', desc: 'Stück aussuchen, bemalen, wir glasieren und brennen — nach rund zwei Wochen abholen.', price: 'CHF 25 Service + Stück ab CHF 7' },
      cafe:    { title: 'Nur Café', desc: 'Auf einen Kaffee vorbeikommen — gemütlich sitzen und auf den See schauen.', price: 'à la carte' },
      kino:    { title: 'Kino-Night', desc: 'Film und Keramikstück inklusive — jeden Freitagabend.', price: 'ab CHF 38 p. P.' }
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
    name: 'Name', email: 'E-mail', phone: 'Phone (for queries)', note: 'Message (optional)',
    gift: 'Gift card code (optional, e.g. LOVE-XXXX-XXXX)',
    errPhone: 'Please add a phone number — we need it for queries about your reservation.',
    submit: 'Request reservation',
    guestsPriv: n => `${n} people`,
    privBadge: 'Private ceramic session',
    privNote: min => `The studio is regularly closed on this day — you can book a <b>private ceramic session from ${min} people</b>. The service fee is prepaid online; you pay for the ceramic pieces on site.`,
    privFee: (n, chf) => `Service fee: ${n} × CHF 25 = <b>CHF ${chf}</b> — paid online now`,
    priv24h: 'Cancel up to 24 h before your session for a full refund of the fee. Bookings made or cancelled less than 24 h ahead are non-refundable.',
    submitPay: chf => `Book & pay — CHF ${chf} →`,
    privPayFail: 'Online payment is temporarily unavailable. Your request is saved — we will e-mail you the payment link.',
    okTitle: 'Request received!',
    okText: 'You will get an e-mail from us right away. Please wait until our team accepts your booking — the confirmation also arrives by e-mail.',
    okKino: 'Cinema Night: we send you the programme with the confirmation.',
    okClose: 'All set ♥',
    foot: 'See all details & floor plan →',
    persons: 'people',
    acts: {
      keramik: { title: 'Paint ceramics', desc: 'Pick a piece, paint it — we glaze and fire it, ready after about two weeks.', price: 'CHF 25 service + pieces from CHF 7' },
      cafe:    { title: 'Café only', desc: 'Drop in for a coffee — sit back and look out over the lake.', price: 'à la carte' },
      kino:    { title: 'Cinema Night', desc: 'Film and ceramic piece included — every Friday evening.', price: 'from CHF 38 p. p.' }
    }
  }
};
const ACT_IMG = {
  keramik: 'assets/img/studio-regal-keramik.jpeg',
  cafe: 'assets/img/interior-og-tische.jpeg',
  kino: 'assets/img/studio-og.jpeg'
};
/* Angebote, die es im Moment nicht gibt, erscheinen nirgends — auch dann nicht, wenn die
   Liste vom Server sie noch führt (Entscheid 21.09.2026: keine Kerzen, keine Floral Bar). */
const NICHT_ANGEBOTEN = ['candle', 'floral'];
const tw = () => TX[LoveSite.lang()] || TX.de;

/* ═══════════ Zustand ═══════════ */
const state = {
  guests: 2,
  date: LoveSite.todayISO(),
  slot: T.slotsFor(LoveSite.todayISO())[0] || '',
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
/* Geschlossener Wochentag (Mo/Di/Do)? Dann ist nur die private Keramik-Session
   ab 6 Personen buchbar — mit vorbezahlter Servicegebühr. */
const isPriv = iso => !!iso && !T.isOpen(iso);
function dateOptions() {
  const out = [];
  const base = new Date(LoveSite.todayISO() + 'T12:00:00');
  for (let i = 0; i < HORIZON_DAYS; i++) {
    const d = new Date(base.getTime() + i * 864e5);
    const iso = d.toISOString().slice(0, 10);
    /* Ferien/Feiertage aus der Cloud bleiben ganz zu; geschlossene Wochentage
       (Mo, Di, Do) sind als private Keramik-Session ab 6 Personen wählbar. */
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
  const x = tw();
  if (services) {
    /* Für Keramik, Café und Kino gelten die Texte der Website: Die Serverliste hat sich als
       veraltet erwiesen («7–10 Tage», «ab CHF 10», «Snacks inklusive»), und Preise und Fristen
       sollen an EINER Stelle stimmen. Neue, im Host-Bereich angelegte Angebote kommen weiter
       vom Server. */
    return services.filter(s => !NICHT_ANGEBOTEN.includes(s.id)).map(s => x.acts[s.id]
      ? { id: s.id, title: x.acts[s.id].title, desc: x.acts[s.id].desc, price: x.acts[s.id].price }
      : { id: s.id, title: en ? (s.label_en || s.label_de) : s.label_de, desc: en ? (s.desc_en || s.desc_de) : s.desc_de, price: s.price });
  }
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
  if (isPriv(state.date)) {
    /* Privat-Session: ab 6 Personen (bis 8 am langen Tisch; grössere Gruppen → Eventplaner) */
    if (state.guests < T.PRIVAT_MIN) state.guests = T.PRIVAT_MIN;
    $('lwGuests').innerHTML =
      [6, 7, 8].map(n => `<option value="${n}" ${state.guests === n ? 'selected' : ''}>${x.guestsPriv(n)}</option>`).join('') +
      `<option value="9" ${state.guests >= 9 ? 'selected' : ''}>${x.guestsEvent}</option>`;
    return;
  }
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
    cells += `<button type="button" class="lw-cal-day${iso === state.date ? ' sel' : ''}${iso === todayIso ? ' today' : ''}${ok && isPriv(iso) ? ' priv' : ''}" data-iso="${iso}" ${ok ? '' : 'disabled'}>${day}</button>`;
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
  /* Die Fenster hängen am Wochentag — Mi/Fr ab 12 Uhr, Sa/So ab 10 Uhr;
     an geschlossenen Tagen gelten die Fenster der privaten Session. */
  const offen = isPriv(state.date) ? T.PRIVAT_SLOTS : T.slotsFor(state.date);
  if (!offen.length) { $('lwSlot').innerHTML = ''; $('lwUntil').textContent = ''; return; }
  if (!offen.includes(state.slot)) state.slot = offen[0];
  if (slotFull(state.date, state.slot, state.guests)) {
    const free = offen.find(s => !slotFull(state.date, s, state.guests));
    if (free) state.slot = free;
  }
  $('lwSlot').innerHTML = offen.map(s => {
    const kino = T.isKinoSlot(state.date, s);
    const full = slotFull(state.date, s, state.guests);
    /* Das letzte Fenster des Tages ist kürzer — das gehört hingeschrieben */
    const h = T.slotLength(s);
    const dauer = (h % 1 === 0 ? String(h) : Math.floor(h) + '½') + (LoveSite.lang() === 'en' ? ' hrs' : ' Std.');
    return `<option value="${s}" ${state.slot === s ? 'selected' : ''} ${full ? 'disabled' : ''}>${s.split('–')[0]} · ${full ? x.full : (kino ? x.kino : dauer)}</option>`;
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
  /* Geschlossener Tag: nur Keramik als private Session, mit klarem Hinweis */
  let privHtml = '';
  if (isPriv(state.date)) {
    acts = acts.filter(a => a.id === 'keramik');
    if (!state.act) state.act = 'keramik';
    privHtml = `<div class="lw-event-note" style="text-align:left"><b>🎨 ${x.privBadge}</b><br>${x.privNote(T.PRIVAT_MIN)}<br><span style="font-size:.85em">${x.priv24h}</span></div>`;
  }
  const esc = s => String(s || '').replace(/[&<>"]/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[m]));
  box.innerHTML = privHtml + acts.map(a => `
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
  const prevPhone = (wrap.querySelector('#lwPhone') ? wrap.querySelector('#lwPhone').value : '') || (acc ? (acc.phone || '') : '');
  const prevNote = wrap.querySelector('#lwNote') ? wrap.querySelector('#lwNote').value : '';
  const prevGift = wrap.querySelector('#lwGift') ? wrap.querySelector('#lwGift').value : '';
  const act = actList().find(a => a.id === state.act);
  const priv = isPriv(state.date);
  const fee = T.PRIVAT_GEBUEHR * state.guests;
  wrap.innerHTML = `
  <form class="lw-form" id="lwForm" novalidate>
    <h5>${x.formTitle(act ? act.title : '')}</h5>
    <input type="text" id="lwName" autocomplete="name" placeholder="${x.name}" value="${prevName.replace(/"/g, '&quot;')}">
    <input type="email" id="lwEmail" autocomplete="email" placeholder="${x.email}" value="${prevMail.replace(/"/g, '&quot;')}">
    <input type="tel" id="lwPhone" autocomplete="tel" placeholder="${x.phone}" value="${prevPhone.replace(/"/g, '&quot;')}">
    <input type="text" id="lwNote" placeholder="${x.note}" value="${prevNote.replace(/"/g, '&quot;')}">
    <input type="text" id="lwGift" autocomplete="off" placeholder="${x.gift}" value="${prevGift.replace(/"/g, '&quot;')}">
    ${priv ? `<p class="lw-cancel-hint" style="font-weight:600">${x.privFee(state.guests, fee)}</p>` : ''}
    <label class="check" style="margin-top:.4rem"><input type="checkbox" id="lwAgb"><span>${LoveSite.t('agb.check')}</span></label>
    <p class="lw-err" id="lwErr" aria-live="polite"></p>
    <button type="submit" class="btn btn-rose btn-block">${priv ? x.submitPay(fee) : x.submit}</button>
    <p class="lw-cancel-hint">${priv ? x.priv24h : LoveSite.t('cancel.hint')}</p>
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
    ${b.payFailed ? `<p><b>${x.privPayFail}</b></p>` : ''}
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
let submitBusy = false;
async function submit(e) {
  e.preventDefault();
  if (submitBusy) return;
  const x = tw();
  const name = $('lwName').value.trim(), email = $('lwEmail').value.trim();
  const phone = $('lwPhone').value.trim();
  if (!name || !LoveSite.validEmail(email)) { $('lwErr').textContent = LoveSite.t('err.required'); return; }
  /* Telefon ist Pflicht — fürs Team bei Rückfragen zur Reservation */
  if ((phone.replace(/\D/g, '')).length < 7) { $('lwErr').textContent = x.errPhone; return; }
  if (!$('lwAgb').checked) { $('lwErr').textContent = LoveSite.t('err.agb'); return; }
  if (slotFull(state.date, state.slot, state.guests)) { $('lwErr').textContent = LoveSite.t('err.full'); return; }
  const priv = isPriv(state.date);
  const kino = !priv && T.isKinoSlot(state.date, state.slot) && state.act === 'kino';
  const fee = T.PRIVAT_GEBUEHR * state.guests;
  /* Optionaler Gutschein-Code: wird notiert — bei der vorbezahlten
     Privat-Session verrechnet ihn der Server direkt mit der Gebühr. */
  const giftRaw = $('lwGift') ? $('lwGift').value.trim().toUpperCase() : '';
  const gift = /^LOVE-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(giftRaw) ? giftRaw : '';
  submitBusy = true;
  state.done = LoveData.addBooking({
    type: priv ? 'keramik-privat' : (kino ? 'kino' : 'tisch'),
    name, email, phone,
    date: state.date, time: state.slot, persons: state.guests,
    area: 'egal', table_type: T.suggest(state.guests),
    world: priv ? 'keramik' : (state.act === 'kino' ? 'keramik' : state.act),
    price: priv ? 'CHF ' + fee : '',
    message: ($('lwNote').value.trim() ? $('lwNote').value.trim() + ' ' : '') + (gift ? '[Gutschein: ' + gift + '] ' : '') + (priv ? '[Privat-Session · Gebühr vorbezahlt] ' : '') + '[Widget]',
    lang: LoveSite.lang()
  });
  /* Private Session: Servicegebühr direkt über Payrexx vorbezahlen */
  if (priv && typeof LovePay !== 'undefined') {
    const r = await LovePay.checkout({
      amount: fee, code: state.done.id, email, back: 'reservieren',
      voucher_code: gift,
      purpose: 'LOVE Private Keramik-Session ' + state.done.id + ' · ' + state.guests + ' Personen'
    });
    if (r.ok) return; // Weiterleitung zu Payrexx läuft
    state.done.payFailed = true;
  }
  submitBusy = false;
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
  document.body.classList.add('lw-open');
  launcher.setAttribute('aria-expanded', 'true');
  $('lwClose').focus({ preventScroll: true });
}
function closeSheet() {
  sheet.classList.remove('open'); backdrop.classList.remove('open');
  launcher.classList.remove('lw-hidden');
  document.body.classList.remove('lw-open');
  launcher.setAttribute('aria-expanded', 'false');
  if (lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true });
}
launcher.addEventListener('click', openSheet);

/* Auf schmalen Bildschirmen ist der schwebende Knopf ausgeblendet (love-widget.css)
   und die Leiste am unteren Rand ist der einzige Reservations-Knopf. Sie öffnet
   dann dasselbe Fenster, statt die Seite zu wechseln — ein Tippen weniger.
   Auf der Reservationsseite selbst zeigt die Leiste auf «#formular» und bleibt
   damit unberührt: dort führt sie weiterhin direkt zum Formular. */
document.querySelectorAll('.sticky-cta a[href*="reservieren.html"]').forEach(a => {
  a.addEventListener('click', e => {
    if (getComputedStyle(launcher).display !== 'none') return;   // breiter Bildschirm: Link lassen
    e.preventDefault();
    openSheet();
  });
});
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
