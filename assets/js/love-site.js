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
    { id: 'EG-G1', kind: 'gross', seats: 10, label: { de: 'Grosser Tisch 1', en: 'Large table 1' } },
    { id: 'EG-G2', kind: 'gross', seats: 10, label: { de: 'Grosser Tisch 2', en: 'Large table 2' } },
    { id: 'EG-R1', kind: 'rund', seats: 3, label: { de: 'Rundtisch 1', en: 'Round table 1' } },
    { id: 'EG-R2', kind: 'rund', seats: 3, label: { de: 'Rundtisch 2', en: 'Round table 2' } },
    { id: 'EG-R3', kind: 'rund', seats: 3, label: { de: 'Rundtisch 3', en: 'Round table 3' } },
    { id: 'EG-R4', kind: 'rund', seats: 3, label: { de: 'Rundtisch 4', en: 'Round table 4' } },
    { id: 'EG-R5', kind: 'rund', seats: 3, label: { de: 'Rundtisch 5', en: 'Round table 5' } }
  ]},
  { id: 'OG', name: { de: '1. Obergeschoss · Galerie', en: 'Upper floor · gallery' }, tables: [
    { id: 'OG-G1', kind: 'gross', seats: 10, label: { de: 'Grosser Tisch (Galerie)', en: 'Large table (gallery)' } },
    { id: 'OG-R1', kind: 'rund', seats: 3, label: { de: 'Rundtisch 1', en: 'Round table 1' } },
    { id: 'OG-R2', kind: 'rund', seats: 3, label: { de: 'Rundtisch 2', en: 'Round table 2' } },
    { id: 'OG-R3', kind: 'rund', seats: 3, label: { de: 'Rundtisch 3', en: 'Round table 3' } }
  ]}
];
const SLOTS = ['09:00–12:00', '12:00–15:00', '15:00–18:00', '18:00–21:00'];
const KINO_SLOT = '18:00–21:00';

const allTables = () => ROOMS.flatMap(r => r.tables.map(t => Object.assign({ room: r.id }, t)));
const capacity = () => allTables().reduce((s, t) => s + t.seats, 0); // = 54

/* Welcher Tischtyp passt zur Gruppengrösse? */
function suggest(persons) {
  persons = Number(persons) || 0;
  if (persons <= 0) return null;
  if (persons <= 3) return 'rund';
  if (persons <= 10) return 'gross';
  return 'event';
}
function candidates(persons, area) {
  const kind = suggest(persons);
  return allTables().filter(t => t.kind === kind && (!area || area === 'egal' || t.room === area));
}
function isKinoSlot(dateISO, slot) {
  if (!dateISO || slot !== KINO_SLOT) return false;
  return new Date(dateISO + 'T12:00:00').getDay() === 5; // Freitag
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

window.LoveTables = { ROOMS, SLOTS, KINO_SLOT, allTables, capacity, suggest, candidates, isKinoSlot, occupancy };

/* ═══════════ i18n ═══════════ */
const COMMON_EN = {
  'skip': 'Skip to content',
  'brand.sub': 'Creative Café',
  'nav.menu': 'Menu',
  'nav.keramik': 'Paint ceramics', 'nav.workshop': 'Workshop', 'nav.walkin': 'Walk-in', 'nav.cafe': 'Café &amp; Bar', 'nav.kino': 'Cinema Night',
  'nav.events': 'Events', 'nav.membership': 'Membership', 'nav.geschenk': 'Gift', 'nav.kontakt': 'Contact',
  'nav.reservieren': 'Reserve',
  'cta.reserve': 'Reserve a table', 'cta.reserve2': 'Reserve a table', 'cta.reserve3': 'Reserve a table',
  'ft.social': 'Instagram · TikTok · Pinterest — profiles coming soon',
  'ft.worlds': 'Discover', 'ft.visit': 'Visit us', 'ft.hours': 'Daily 9 am – 9 pm', 'ft.kino': 'Cinema Night: every Friday',
  'ft.legal': 'Legal', 'ft.privacy': 'Privacy', 'ft.imprint': 'Imprint', 'ft.team': 'Team portal',
  'ft.cafe': 'Café &amp; menu', 'ft.res': 'Reserve a table', 'ft.member': 'Membership', 'ft.gift': 'Gift an experience',
  'ft.keramik': 'Ceramics &amp; prices', 'ft.kinoL': 'Cinema Night', 'ft.events': 'Events',
  'err.required': 'Please fill in name and a valid e-mail address.',
  'err.email': 'Please enter a valid e-mail address.',
  'err.date': 'Please choose a date.',
  'err.persons': 'For 11 or more people please use the event planner.',
  'err.plPersons': 'Events start at 6 people — for smaller groups simply reserve a table.',
  'err.amount': 'Please choose one of the gift card amounts (CHF 20-500).',
  'err.optin': 'Please confirm the checkbox so we may send you news.',
  'err.slot': 'Please choose a time slot.',
  'err.choice': 'Please make a selection first.',
  'ref.lbl': 'Reference: '
};
const COMMON_DE = { // DE-Texte, die nur in JS vorkommen
  'err.required': 'Bitte Name und eine gültige E-Mail-Adresse angeben.',
  'err.email': 'Bitte eine gültige E-Mail-Adresse angeben.',
  'err.date': 'Bitte ein Datum wählen.',
  'err.persons': 'Ab 11 Personen nutze bitte den Eventplaner.',
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

window.LoveSite = { t, applyLang, lang: () => lang, validEmail, todayISO, chf };
})();
