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
/* A single table-booking flow across public pages. Dedicated event/course
   destinations are never intercepted. Keep native URLs as a fallback. */
const SEITE = (location.pathname.split('/').pop() || 'index.html').toLowerCase();
if (!['index.html','walkin.html','reservieren.html','geschenk.html','workshop.html','events.html','kidscamp.html','geburtstag.html','teamevents.html','halloween.html','kinokeramik.html','monetkids.html','monetadults.html','shop.html','agb.html','datenschutz.html','impressum.html','leistungen.html','host.html'].includes(SEITE)) return;
const IS_RESERVATION = SEITE === 'reservieren.html';
const SHOW_LAUNCHER = ['', 'index.html', 'walkin.html', 'reservieren.html'].includes(SEITE);
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
    privNote: min => `An diesem Tag ist das Studio regulär geschlossen — buchbar ist eine <b>private Keramik-Session ab ${min} Personen</b>. Die Servicegebühr wird online vorbezahlt, die Keramikstücke zahlt ihr vor Ort. Weil wir an diesem Tag eigens für euch öffnen, prüfen wir die Buchung persönlich und melden uns — bitte hab etwas Geduld.`,
    privFee: (n, chf) => `Servicegebühr: ${n} × CHF 25 = <b>CHF ${chf}</b> — jetzt online bezahlen`,
    priv24h: 'Absage bis 24 h vor dem Termin: volle Rückerstattung der Gebühr. Bei kurzfristigeren Buchungen oder Absagen unter 24 h gibt es keine Rückerstattung.',
    submitPay: chf => `Kostenpflichtig buchen — CHF ${chf} →`,
    privPayFail: 'Die Online-Zahlung ist gerade nicht erreichbar. Deine Anfrage ist gespeichert — wir melden uns per E-Mail mit dem Zahlungslink.',
    okPriv: 'An diesem Tag öffnen wir eigens für euch. Unser Team prüft die Buchung persönlich und meldet sich per E-Mail — bitte hab etwas Geduld.',
    okTitle: 'Anfrage eingegangen!',
    okText: 'Du bekommst gleich eine E-Mail von uns. Bitte warte kurz, bis unser Team deine Buchung annimmt — die Bestätigung kommt ebenfalls per E-Mail.',
    okKino: 'Kino-Night: Programm und Format schicken wir dir mit der Bestätigung.',
    okClose: 'Alles klar ♥',
    foot: 'Alle Details ansehen →',
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
    privNote: min => `The studio is regularly closed on this day — you can book a <b>private ceramic session from ${min} people</b>. The service fee is prepaid online; you pay for the ceramic pieces on site. As we open specially for you on this day, we check the booking personally and get back to you — please bear with us.`,
    privFee: (n, chf) => `Service fee: ${n} × CHF 25 = <b>CHF ${chf}</b> — paid online now`,
    priv24h: 'Cancel up to 24 h before your session for a full refund of the fee. Bookings made or cancelled less than 24 h ahead are non-refundable.',
    submitPay: chf => `Book & pay — CHF ${chf} →`,
    privPayFail: 'Online payment is temporarily unavailable. Your request is saved — we will e-mail you the payment link.',
    okPriv: 'We open specially for you on this day. Our team checks the booking personally and gets back to you by e-mail — please bear with us.',
    okTitle: 'Request received!',
    okText: 'You will get an e-mail from us right away. Please wait until our team accepts your booking — the confirmation also arrives by e-mail.',
    okKino: 'Cinema Night: we send you the programme with the confirmation.',
    okClose: 'All set ♥',
    foot: 'See all details →',
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
   Liste vom Server sie noch führt (Entscheid 21.09.2026: keine Kerzen, keine Floral Bar;
   13.10.2026: «Nur Café» ist nicht reservierbar). */
const NICHT_ANGEBOTEN = ['candle', 'floral', 'cafe'];
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
    <p class="hidden" id="lwCloseNote" style="margin:.1rem 0 0;padding:.55rem .8rem;border-radius:10px;background:#fff;color:var(--green,#337357);font-size:.82rem;line-height:1.4"></p>
  </div>
  <div class="lw-divider" id="lwDivider"></div>
  <div class="lw-scroll">
    <div class="lw-cards" id="lwCards"></div>
    <div id="lwFormWrap"></div>
  </div>
  <div class="lw-foot"><a href="reservieren.html#infos" id="lwFootLink" data-reservation-info></a></div>
</div>`);

const $ = id => document.getElementById(id);
const sheet = $('lwSheet'), backdrop = $('lwBackdrop'), launcher = $('lwLauncher');
if (!SHOW_LAUNCHER) launcher.style.display = 'none';

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
const isPriv = iso => !!iso && !T.isHoliday(iso) && !closedDays.has(iso) && !T.isOpen(iso);
/* Hat dieses Fenster heute schon begonnen? Dann nicht mehr anbieten. */
function vorbei(iso, slot) {
  if (iso !== LoveSite.todayISO()) return false;
  const m = String(slot || '').match(/^(\d{1,2}):(\d{2})/); if (!m) return false;
  const jetzt = new Date();
  return +m[1] * 60 + +m[2] <= jetzt.getHours() * 60 + jetzt.getMinutes();
}
const fensterFuer = iso => (T.isHoliday(iso) || closedDays.has(iso) ? [] : isPriv(iso) ? T.PRIVAT_SLOTS : T.slotsFor(iso));
const heuteVorbei = iso => iso === LoveSite.todayISO() && fensterFuer(iso).every(s => vorbei(iso, s));
function dateOptions() {
  const out = [];
  const base = new Date(LoveSite.todayISO() + 'T12:00:00');
  for (let i = 0; i < HORIZON_DAYS; i++) {
    const d = new Date(base.getTime() + i * 864e5);
    const iso = d.toISOString().slice(0, 10);
    /* Ferien/Feiertage aus der Cloud bleiben ganz zu; geschlossene Wochentage
       (Mo, Di, Do) sind als private Keramik-Session ab 6 Personen wählbar. */
    if (!T.isHoliday(iso) && !closedDays.has(iso) && !heuteVorbei(iso)) out.push(iso);
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
  return Object.entries(x.acts).filter(([id]) => !NICHT_ANGEBOTEN.includes(id)).map(([id, c]) => ({ id, title: c.title, desc: c.desc, price: c.price }));
}

/* ── Tisch-Verfügbarkeit pro Datum (Cloud) ── */
const availCache = {};
function loadAvailability(date) {
  if (availCache[date] || typeof LoveCloud === 'undefined') return;
  LoveCloud.call('availability&date=' + encodeURIComponent(date)).then(r => {
    if (r.ok) { availCache[date] = r; renderSlots(); renderCards(); }
  }).catch(() => {});
}
/* Voll, wenn während der gewünschten Zeit irgendwann alle Tische dieses Typs belegt sind.
   Seit den freien Startzeiten (13.10.2026) zählen alle Buchungen, die sich zeitlich überschneiden. */
function slotFull(date, slot, guests) {
  const kind = T.suggest(guests);
  if (!kind || kind === 'event') return false;
  const a = availCache[date];
  if (!a) return false;
  const inv = (a.inventory && a.inventory[kind]) || T.INVENTORY[kind] || 99;
  const [s, e] = T.intervall(slot);
  if (s == null) return ((a.booked && a.booked[slot] && a.booked[slot][kind]) || 0) >= inv;
  const belegt = Object.entries(a.booked || {}).map(([k, v]) => [...T.intervall(k), (v && v[kind]) || 0])
    .filter(([bs, be, n]) => n && bs != null && bs < e && be > s);
  const punkte = [s, ...belegt.map(b => b[0]).filter(p => p > s)];
  const spitze = Math.max(0, ...punkte.map(p => belegt.filter(([bs, be]) => bs <= p && p < be).reduce((x, b) => x + b[2], 0)));
  return spitze >= inv;
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
    const ok = iso >= todayIso && iso <= maxIso && !T.isHoliday(iso) && !closedDays.has(iso) && !heuteVorbei(iso);
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
  const offen = fensterFuer(state.date);
  if (!offen.length) { state.slot = ''; $('lwSlot').innerHTML = ''; $('lwUntil').textContent = ''; $('lwCloseNote').classList.add('hidden'); return; }
  if (!offen.includes(state.slot)) state.slot = offen[0];
  if (slotFull(state.date, state.slot, state.guests) || vorbei(state.date, state.slot)) {
    const free = offen.find(s => !slotFull(state.date, s, state.guests) && !vorbei(state.date, s));
    if (free) state.slot = free;
  }
  $('lwSlot').innerHTML = offen.map(s => {
    const kino = T.isKinoSlot(state.date, s);
    const full = slotFull(state.date, s, state.guests), alt = vorbei(state.date, s);
    /* Das letzte Fenster des Tages ist kürzer — das gehört hingeschrieben */
    const h = T.slotLength(s);
    const dauer = (h % 1 === 0 ? String(h) : Math.floor(h) + '½') + (LoveSite.lang() === 'en' ? ' hrs' : ' Std.');
    return `<option value="${s}" ${state.slot === s ? 'selected' : ''} ${full || alt ? 'disabled' : ''}>${s.split('–')[0]} · ${alt ? (LoveSite.lang() === 'en' ? 'passed' : 'vorbei') : full ? x.full : (kino ? x.kino : dauer)}</option>`;
  }).join('');
  $('lwUntil').textContent = `${x.until} ${state.slot.split('–')[1]}`;
  /* Kürzer als 3 Stunden, weil wir schliessen? Dann sagen — und dass es so eingeplant ist. */
  const zu = isPriv(state.date) ? '' : T.schliesstVorher(state.date, state.slot);
  $('lwCloseNote').textContent = zu ? (LoveSite.lang() === 'en'
    ? `We close at ${zu} on this day — your table is reserved until then. This is already taken into account.`
    : `Wir schliessen an diesem Tag um ${zu} Uhr — dein Tisch ist bis dann reserviert. Das ist bei deiner Reservation berücksichtigt.`) : '';
  $('lwCloseNote').classList.toggle('hidden', !zu);
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
      <!-- Ohne Foto und ohne Preis (Taulant 14.10.2026: Regal-Bild weg, Preise stehen nur im Preis-Abschnitt) -->
      <h4>${esc(a.title)}</h4><p>${esc(a.desc)}</p>
    </button>`).join('');
  box.querySelectorAll('.lw-card').forEach(b => b.addEventListener('click', () => {
    state.act = b.dataset.act;
    renderCards(); renderForm();
    // Scroll only the inner panel: Safari must not pan the page/visual viewport.
    const sc = sheet.querySelector('.lw-scroll'), form = $('lwFormWrap');
    if (sc && form) sc.scrollTo({ top: Math.max(0, sc.scrollTop + form.getBoundingClientRect().top - sc.getBoundingClientRect().top), behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
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
    ${b.type === 'keramik-privat' ? `<p>${x.okPriv}</p>` : ''}
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
  if (!selectable(state.date) || !fensterFuer(state.date).includes(state.slot)) { $('lwErr').textContent = LoveSite.lang() === 'en' ? 'This date or time is not available — please choose another.' : 'Dieses Datum oder Zeitfenster ist nicht verfügbar — bitte wähle ein anderes.'; return; }
  const name = $('lwName').value.trim(), email = $('lwEmail').value.trim();
  const phone = $('lwPhone').value.trim();
  if (!name || !LoveSite.validEmail(email)) { $('lwErr').textContent = LoveSite.t('err.required'); return; }
  /* Telefon ist Pflicht — fürs Team bei Rückfragen zur Reservation */
  if ((phone.replace(/\D/g, '')).length < 7) { $('lwErr').textContent = x.errPhone; return; }
  if (!$('lwAgb').checked) { $('lwErr').textContent = LoveSite.t('err.agb'); return; }
  if (slotFull(state.date, state.slot, state.guests)) { $('lwErr').textContent = LoveSite.t('err.full'); return; }
  if (vorbei(state.date, state.slot)) { $('lwErr').textContent = LoveSite.lang() === 'en' ? 'This time slot has already started — please choose another one.' : 'Dieses Zeitfenster hat schon begonnen — bitte wähle ein anderes.'; return; }
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
  // Reopening always exposes the guests/date/time controls and the first card.
  sheet.querySelector('.lw-scroll').scrollTop = 0;
  sheet.querySelector('.lw-rows').scrollTop = 0;
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

/* Use the selected pink dialog from every ordinary table CTA, at every
   viewport. Modified clicks and real links remain available as fallbacks. */
function isTableReservationLink(a) {
  if (!a || a.hasAttribute('download') || a.hasAttribute('data-reservation-info') ||
      (a.target && a.target !== '_self') || a.id === 'lwFootLink') return false;
  let url;
  try { url = new URL(a.href, location.href); } catch (_) { return false; }
  if (url.origin !== location.origin) return false;
  return url.pathname === '/reservieren.html' &&
    (!url.hash || url.hash === '#formular');
}
document.addEventListener('click', e => {
  if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  const a = e.target.closest && e.target.closest('a[href]');
  if (!isTableReservationLink(a)) return;
  e.preventDefault();
  openSheet();
});
$('lwFootLink').addEventListener('click', closeSheet);
$('lwClose').addEventListener('click', closeSheet);
backdrop.addEventListener('click', closeSheet);
addEventListener('keydown', e => {
  if (!sheet.classList.contains('open')) return;
  if (e.key === 'Escape') { closeSheet(); return; }
  if (e.key !== 'Tab') return;
  const items = Array.from(sheet.querySelectorAll('a[href],button,input,select,textarea,[tabindex="0"]'))
    .filter(el => !el.disabled && el.getClientRects().length);
  const first = items[0], last = items[items.length - 1];
  if (!first) return;
  if (e.shiftKey && (document.activeElement === first || !sheet.contains(document.activeElement))) {
    e.preventDefault(); last.focus();
  } else if (!e.shiftKey && (document.activeElement === last || !sheet.contains(document.activeElement))) {
    e.preventDefault(); first.focus();
  }
});

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
/* Progressive enhancement: the old page remains a fallback only if the shared
   widget cannot initialize. Never replace existing booking/payment data. */
if (IS_RESERVATION) {
  const oldForm = document.querySelector('#formular .panel');
  const launch = $('reservationLaunch');
  if (oldForm && launch) {
    oldForm.hidden = true;
    oldForm.style.display = 'none';
    launch.hidden = false;
    launch.classList.remove('hidden');
  }
  const q = new URLSearchParams(location.search);
  if (!q.has('paid') && !q.has('payfail') && (!location.hash || location.hash === '#formular')) openSheet();
}
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

