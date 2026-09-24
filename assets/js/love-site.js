/* LOVE Creative — gemeinsame Website-Logik (alle öffentlichen Seiten)
 *
 *  - i18n DE/EN: DE wird aus dem HTML eingesammelt (eine Quelle), EN kommt aus
 *    COMMON_EN (Navigation, Footer, Fehler) + window.LOVE_EN (seitenspezifisch).
 *  - Header/Nav, Scroll-Reveal, Helfer.
 *  - LoveTables: das Tischmodell des Studios (Reservation + CRM-Tischplan).
 *
 *  Reihenfolge im HTML:  <script>window.LOVE_EN = {…}</script>
 *                        <script src="assets/js/love-data.js"></script>
 *                        <script src="assets/js/love-site.js"></script>
 */
(() => {
'use strict';

/* ═══════════ Tischmodell (Raumplan Seestrasse 287B) ═══════════ */
const ROOMS = [
  { id: 'EG', name: { de: 'Erdgeschoss', en: 'Ground floor' }, tables: [
    { id: 'EG-R1', kind: 'rund2', seats: 2, label: { de: 'Rundtisch 1 (2 P.)', en: 'Round table 1 (2 p.)' } },
    { id: 'EG-R2', kind: 'rund2', seats: 2, label: { de: 'Rundtisch 2 (2 P.)', en: 'Round table 2 (2 p.)' } },
    { id: 'EG-M1', kind: 'rund4', seats: 4, label: { de: 'Rundtisch 3 (4 P.)', en: 'Round table 3 (4 p.)' } },
    { id: 'EG-M2', kind: 'rund4', seats: 4, label: { de: 'Rundtisch 4 (4 P.)', en: 'Round table 4 (4 p.)' } },
    { id: 'EG-L1', kind: 'lang8', seats: 8, label: { de: 'Langer Tisch 1 (8 P.)', en: 'Long table 1 (8 p.)' } },
    { id: 'EG-L2', kind: 'lang8', seats: 8, label: { de: 'Langer Tisch 2 (8 P.)', en: 'Long table 2 (8 p.)' } }
  ]},
  { id: 'OG', name: { de: '1. Obergeschoss · Galerie', en: 'Upper floor · gallery' }, tables: [
    { id: 'OG-L1', kind: 'lang8', seats: 8, label: { de: 'Langer Tisch Galerie (8 P.)', en: 'Long table gallery (8 p.)' } },
    { id: 'OG-R1', kind: 'rund2', seats: 2, label: { de: 'Rundtisch 1 (2 P.)', en: 'Round table 1 (2 p.)' } },
    { id: 'OG-R2', kind: 'rund2', seats: 2, label: { de: 'Rundtisch 2 (2 P.)', en: 'Round table 2 (2 p.)' } },
    { id: 'OG-R3', kind: 'rund2', seats: 2, label: { de: 'Rundtisch 3 (2 P.)', en: 'Round table 3 (2 p.)' } },
    { id: 'OG-R4', kind: 'rund2', seats: 2, label: { de: 'Rundtisch 4 (2 P.)', en: 'Round table 4 (2 p.)' } }
  ]}
];
/* ═══════════ Öffnungszeiten und Zeitfenster ═══════════
   Montag, Dienstag und Donnerstag bleibt das Studio zu — an diesen Tagen sind
   nur Gruppenreservierungen auf Anfrage möglich. An den offenen Tagen gilt das
   Drei-Stunden-Raster; das letzte Fenster ist kürzer, damit die Öffnungszeit
   ohne Lücke aufgeht (Mi/Fr bis 20 Uhr, Sa/So bis 18:30 Uhr).
   Wochentage nach JavaScript: 0 = Sonntag … 6 = Samstag. */
const OEFFNUNG = {
  0: { von: '10:00', bis: '18:30', slots: ['10:00–13:00', '13:00–16:00', '16:00–18:30'] }, // Sonntag
  1: null,                                                                                  // Montag  — geschlossen
  2: null,                                                                                  // Dienstag — geschlossen
  3: { von: '12:00', bis: '20:00', slots: ['12:00–15:00', '15:00–18:00', '18:00–20:00'] }, // Mittwoch
  4: null,                                                                                  // Donnerstag — geschlossen
  5: { von: '12:00', bis: '20:00', slots: ['12:00–15:00', '15:00–18:00', '18:00–20:00'] }, // Freitag
  6: { von: '10:00', bis: '18:30', slots: ['10:00–13:00', '13:00–16:00', '16:00–18:30'] }  // Samstag
};
/* Geschlossene Tage (Mo/Di/Do): private Keramik-Sessions ab 6 Personen.
   Die Servicegebühr (CHF 25 p. P.) wird online vorbezahlt; die Keramikstücke
   zahlt die Gruppe vor Ort. Absage bis 24 h vorher: volle Rückerstattung. */
const PRIVAT_SLOTS = ['10:00–13:00', '13:30–16:30', '17:00–20:00'];
const PRIVAT_MIN = 6;
const PRIVAT_GEBUEHR = 25;
const wochentag = dateISO => new Date(dateISO + 'T12:00:00').getDay();
/* Hat das Studio an diesem Datum offen? */
const isOpen = dateISO => !!(dateISO && OEFFNUNG[wochentag(dateISO)]);
/* Die Zeitfenster dieses Tages — an geschlossenen Tagen eine leere Liste */
const slotsFor = dateISO => (dateISO && OEFFNUNG[wochentag(dateISO)] ? OEFFNUNG[wochentag(dateISO)].slots : []);
/* Wie lange dauert dieses Fenster? Für die Beschriftung («3 Stunden» / «2½ Stunden») */
function slotLength(slot) {
  const m = String(slot).match(/(\d{2}):(\d{2})[–-](\d{2}):(\d{2})/);
  if (!m) return 0;
  return ((+m[3] * 60 + +m[4]) - (+m[1] * 60 + +m[2])) / 60;
}
/* Alle vorkommenden Fenster — für Übersichten im CRM, die alle Tage nebeneinander zeigen */
const SLOTS = [...new Set(Object.values(OEFFNUNG).filter(Boolean).flatMap(t => t.slots))]
  .sort((a, b) => a.localeCompare(b));
const KINO_SLOT = '18:00–20:00';   // Freitagabend
/* Die Kino-Night ist ausgeblendet, bis das Konzept steht (Entscheid Taulant, 22.09.2026).
   Solange der Schalter auf false steht, ist der Freitagabend ein gewöhnliches Zeitfenster —
   Reservation, Reservations-Fenster und Hinweise richten sich alle danach. Zum Einschalten:
   true setzen, kinoabend.html wieder in tools/build-public.js aufnehmen, Navigation ergänzen. */
const KINO_AKTIV = false;

const allTables = () => ROOMS.flatMap(r => r.tables.map(t => Object.assign({ room: r.id }, t)));
const capacity = () => allTables().reduce((s, t) => s + t.seats, 0); // = 44
/* Wie viele Tische es pro Typ gibt — mehrere gleichzeitige 8er-Buchungen sind möglich */
const INVENTORY = { rund2: 6, rund4: 2, lang8: 3 };

/* Welcher Tischtyp passt zur Gruppengrösse? */
function suggest(persons) {
  persons = Number(persons) || 0;
  if (persons <= 0) return null;
  if (persons <= 2) return 'rund2';
  if (persons <= 4) return 'rund4';
  if (persons <= 8) return 'lang8';
  return 'event';
}
function candidates(persons, area) {
  const kind = suggest(persons);
  return allTables().filter(t => t.kind === kind && (!area || area === 'egal' || t.room === area));
}
function isKinoSlot(dateISO, slot) {
  if (!KINO_AKTIV || !dateISO || slot !== KINO_SLOT) return false;
  return wochentag(dateISO) === 5; // Freitag
}
/* Belegung eines Zeitfensters aus der Buchungsliste (für CRM-Tischplan) */
function occupancy(dateISO, slot, bookings) {
  const live = (bookings || []).filter(b =>
    (b.type === 'tisch' || b.type === 'kino') && b.date === dateISO && b.time === slot &&
    !['storniert', 'verloren'].includes(b.status));
  const byTable = {};
  let seats = 0;
  const unassigned = [];
  live.forEach(b => {
    seats += Number(b.persons) || 0;
    if (b.table) byTable[b.table] = b; else unassigned.push(b);
  });
  return { byTable, seats, unassigned, all: live };
}

window.LoveTables = { ROOMS, SLOTS, KINO_SLOT, KINO_AKTIV, INVENTORY, OEFFNUNG, allTables, capacity, suggest,
  candidates, isKinoSlot, occupancy, isOpen, slotsFor, slotLength,
  PRIVAT_SLOTS, PRIVAT_MIN, PRIVAT_GEBUEHR };

/* ═══════════ i18n ═══════════ */
const COMMON_EN = {
  'skip': 'Skip to content',
  'brand.sub': 'Creative Café',
  'nav.menu': 'Menu',
  'nav.keramik': 'Paint ceramics', 'nav.workshop': 'Workshop', 'nav.walkin': 'Walk-in', 'nav.kidscamp': 'Kids camp', 'nav.geburtstage': 'Birthdays', 'nav.kidsgeb': 'Kids camp &amp; birthdays', 'nav.team': 'Team events', 'ft.firmen': 'Team &amp; corporate events', 'nav.cafe': 'Café &amp; Bar', 'nav.kino': 'Cinema Night',
  'nav.events': 'Events', 'nav.membership': 'Membership', 'nav.geschenk': 'Gift', 'nav.kontakt': 'Contact', 'nav.shop': 'Shop',
  'nav.reservieren': 'Reserve',
  'cta.reserve': 'Reserve a table', 'cta.reserve2': 'Reserve a table', 'cta.reserve3': 'Reserve a table',
  'ft.social': 'Instagram · TikTok · Pinterest — profiles coming soon',
  'ft.worlds': 'Discover', 'ft.visit': 'Visit us', 'ft.hours': 'Wed &amp; Fri 12:00–20:00 · Sat &amp; Sun 10:00–18:30', 'ft.kino': 'Cinema Night: every Friday',
  'ft.legal': 'Legal', 'ft.privacy': 'Privacy', 'ft.imprint': 'Imprint', 'ft.team': 'Team portal',
  'ft.cafe': 'Café &amp; menu', 'ft.res': 'Reserve a table', 'ft.member': 'Membership', 'ft.gift': 'Gift an experience', 'ft.shop': 'Shop', 'ft.services': 'Offering &amp; services',
  'ft.keramik': 'Ceramics &amp; prices', 'ft.kinoL': 'Cinema Night', 'ft.events': 'Events',
  'err.required': 'Please fill in name and a valid e-mail address.',
  'err.phone': 'Please add a phone number — we need it for queries about your reservation.',
  'err.agb': 'Please accept the terms and conditions to continue.',
  'agb.check': 'I have read and accept the <a href="agb.html" target="_blank" rel="noopener">terms and conditions</a>.',
  'err.email': 'Please enter a valid e-mail address.',
  'err.date': 'Please choose a date.',
  'err.persons': 'For 9 or more people please use the event planner.',
  'err.full': 'This time slot is fully booked for your group size — please pick another slot or date.',
  'cancel.hint': 'Free cancellation up to 24 h before your visit — directly in your LOVE account.',
  'err.plPersons': 'Events start at 6 people — for smaller groups simply reserve a table.',
  'err.amount': 'Please choose one of the gift card amounts (CHF 20-500).',
  'err.optin': 'Please confirm the checkbox so we may send you news.',
  'err.slot': 'Please choose a time slot.',
  'err.choice': 'Please make a selection first.',
  'ref.lbl': 'Reference: '
};
const COMMON_DE = { // DE-Texte, die nur in JS vorkommen
  'err.required': 'Bitte Name und eine gültige E-Mail-Adresse angeben.',
  'err.phone': 'Bitte gib eine Telefonnummer an — wir brauchen sie für Rückfragen zur Reservation.',
  'err.agb': 'Bitte akzeptiere die AGB, um fortzufahren.',
  'agb.check': 'Ich habe die <a href="agb.html" target="_blank" rel="noopener">AGB</a> gelesen und akzeptiere sie.',
  'err.email': 'Bitte eine gültige E-Mail-Adresse angeben.',
  'err.date': 'Bitte ein Datum wählen.',
  'err.persons': 'Ab 9 Personen nutze bitte den Eventplaner.',
  'err.full': 'Dieses Zeitfenster ist für eure Gruppengrösse ausgebucht — bitte wähl ein anderes Fenster oder Datum.',
  'cancel.hint': 'Kostenlose Stornierung bis 24 h vor dem Besuch — direkt im LOVE-Konto.',
  'err.plPersons': 'Events gibt es ab 6 Personen — für kleinere Gruppen reserviere einfach einen Tisch.',
  'err.amount': 'Bitte wähl einen der Geschenkkarten-Beträge (CHF 20–500).',
  'err.optin': 'Bitte bestätige das Häkchen, damit wir dir News schicken dürfen.',
  'err.slot': 'Bitte ein Zeitfenster wählen.',
  'err.choice': 'Bitte zuerst eine Auswahl treffen.',
  'ref.lbl': 'Referenz: '
};

const DE = Object.assign({}, COMMON_DE, window.LOVE_DE || {});
document.querySelectorAll('[data-i18n]').forEach(el => { DE[el.dataset.i18n] = el.innerHTML; });
document.querySelectorAll('[data-i18n-ph]').forEach(el => { DE[el.dataset.i18nPh] = el.placeholder; });
document.querySelectorAll('[data-i18n-aria]').forEach(el => { DE[el.dataset.i18nAria] = el.getAttribute('aria-label'); });
const EN = Object.assign({}, COMMON_EN, window.LOVE_EN || {});
const I18N = { de: DE, en: EN };
let lang = localStorage.getItem('love.lang') || 'de';

function t(key) {
  const d = I18N[lang] || {};
  return (key in d) ? d[key] : (I18N.de[key] !== undefined ? I18N.de[key] : key);
}
function applyLang(l) {
  lang = (l === 'en') ? 'en' : 'de';
  localStorage.setItem('love.lang', lang);
  document.documentElement.lang = lang;
  document.querySelectorAll('[data-i18n]').forEach(el => { el.innerHTML = t(el.dataset.i18n); });
  document.querySelectorAll('[data-i18n-ph]').forEach(el => { el.placeholder = t(el.dataset.i18nPh); });
  document.querySelectorAll('[data-i18n-aria]').forEach(el => { el.setAttribute('aria-label', t(el.dataset.i18nAria)); });
  document.querySelectorAll('.lang-btn').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.lang === lang)));
  const titles = window.LOVE_TITLES || {};
  if (titles[lang]) document.title = titles[lang];
  document.dispatchEvent(new CustomEvent('love:lang', { detail: lang }));
}
/* Zweite Sprachwahl im aufklappbaren Menü: Auf dem Handy hat sie in der Kopfzeile keinen Platz
   (sie ragte über den Rand und machte die Seite seitlich verschiebbar). Die Kopie entsteht VOR
   dem Anbinden der Klicks, damit beide gleich funktionieren und gleich markiert werden. */
(() => {
  const ls = document.querySelector('.nav-in > .lang-switch'), ul = document.querySelector('nav.main > ul');
  if (!ls || !ul) return;
  const li = document.createElement('li'); li.className = 'nav-lang';
  li.appendChild(ls.cloneNode(true)); ul.appendChild(li);
})();
/* ═══════════ Öffnungszeiten-Karte (Startseite) ═══════════
   Liest OEFFNUNG, damit Karte, Reservation und Google-Angaben nie auseinanderlaufen. */
function renderHours() {
  const tbl = document.getElementById('hoursTable'), st = document.getElementById('hoursStatus');
  if (!tbl) return;
  const en = lang === 'en';
  const NAMEN = en ? ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] : ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
  const jetzt = new Date(), heute = jetzt.getDay();
  const zeit = t => t.replace(/:00$/, '') + (en ? '' : '');
  tbl.innerHTML = [1, 2, 3, 4, 5, 6, 0].map(d => {
    const o = OEFFNUNG[d], ist = d === heute;
    return `<tr class="${o ? '' : 'closed'}${ist ? ' today' : ''}"><td>${NAMEN[d]}${ist ? `<span class="today-tag">${en ? 'today' : 'heute'}</span>` : ''}</td>` +
      `<td>${o ? zeit(o.von) + ' – ' + zeit(o.bis) + (en ? '' : ' Uhr') : (en ? 'closed' : 'geschlossen')}</td></tr>`;
  }).join('');
  /* Status: offen bis … / heute geschlossen / öffnet um … */
  const o = OEFFNUNG[heute], min = jetzt.getHours() * 60 + jetzt.getMinutes(), zuMin = t => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
  if (!o) { st.textContent = en ? 'Closed today' : 'Heute geschlossen'; st.className = 'hours-status closed'; }
  else if (min < zuMin(o.von)) { st.textContent = (en ? 'Opens today at ' : 'Öffnet heute um ') + zeit(o.von) + (en ? '' : ' Uhr'); st.className = 'hours-status closed'; }
  else if (min < zuMin(o.bis)) { st.textContent = (en ? 'Open now until ' : 'Jetzt offen bis ') + zeit(o.bis) + (en ? '' : ' Uhr'); st.className = 'hours-status open'; }
  else { st.textContent = en ? 'Closed for today' : 'Heute bereits geschlossen'; st.className = 'hours-status closed'; }
}
renderHours();
document.addEventListener('love:lang', renderHours);
document.querySelectorAll('.lang-btn').forEach(b => b.addEventListener('click', () => applyLang(b.dataset.lang)));
if (lang !== 'de') applyLang(lang);

/* ═══════════ Header / Nav ═══════════ */
const header = document.querySelector('header.site');
if (header) addEventListener('scroll', () => header.classList.toggle('scrolled', scrollY > 8), { passive: true });
const burger = document.getElementById('burger');
const mainnav = document.getElementById('mainnav');
if (burger && mainnav) {
  burger.addEventListener('click', () => {
    const open = mainnav.classList.toggle('open');
    burger.setAttribute('aria-expanded', String(open));
  });
  mainnav.addEventListener('click', e => { if (e.target.tagName === 'A') { mainnav.classList.remove('open'); burger.setAttribute('aria-expanded', 'false'); } });
  addEventListener('keydown', e => { if (e.key === 'Escape') { mainnav.classList.remove('open'); burger.setAttribute('aria-expanded', 'false'); } });
  // aktuelle Seite markieren
  const norm = s => (s || '').replace(/\.html$/, '') || 'index';
  const here = norm(location.pathname.split('/').pop());
  mainnav.querySelectorAll('a').forEach(a => { const h = a.getAttribute('href') || ''; if (!h.includes('#') && norm(h) === here) a.setAttribute('aria-current', 'page'); });
}

/* ═══════════ Scroll-Reveal ═══════════ */
const io = new IntersectionObserver(entries => {
  entries.forEach(en => { if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); } });
}, { threshold: .12 });
document.querySelectorAll('.reveal').forEach(el => io.observe(el));

/* ═══════════ Helfer ═══════════ */
const validEmail = s => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(s).trim());
const todayISO = () => new Date().toISOString().slice(0, 10);
const chf = n => 'CHF ' + (Number(n) || 0).toLocaleString('de-CH').replace(/,/g, "'");
const y = document.getElementById('year'); if (y) y.textContent = new Date().getFullYear();

/* ═══════════ Zahlungsmethoden-Badges im Footer (Payrexx) ═══════════ */
(function payBadges() {
  const fb = document.querySelector('footer .foot-bottom');
  if (!fb || document.getElementById('footPay')) return;
  const P = [
    ['twint', 'TWINT'], ['visa', 'Visa'], ['mastercard', 'Mastercard'],
    ['amex', 'American Express'], ['applepay', 'Apple Pay'], ['klarna', 'Klarna']
  ];
  fb.insertAdjacentHTML('beforebegin', `
    <div class="foot-pay" id="footPay" role="group" aria-label="Akzeptierte Zahlungsmethoden">
      <span id="footPayLbl"></span>
      ${P.map(([f, alt]) => `<img src="assets/img/pay/${f}.svg" alt="${alt}" loading="lazy" height="26">`).join('')}
    </div>`);
  const setLbl = () => {
    const el = document.getElementById('footPayLbl');
    if (el) el.textContent = lang === 'en' ? 'Secure payment:' : 'Sichere Zahlung:';
  };
  setLbl();
  document.addEventListener('love:lang', setLbl);
})();

window.LoveSite = { t, applyLang, lang: () => lang, validEmail, todayISO, chf };
})();
