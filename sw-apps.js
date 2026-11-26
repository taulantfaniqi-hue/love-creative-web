/* LOVE Creative — Service Worker nur für die zwei internen Apps (Termine, Team).
   Er sorgt dafür, dass die Apps sich installieren lassen und auch ohne Internet starten.
   Die öffentliche Website fasst er nicht an: Alles ausser den Dateien in APP_DATEIEN
   läuft unverändert übers Netz. Daten vom Server werden hier nie gespeichert. */
const VERSION = 'love-apps-v1';
const APP_DATEIEN = ['termine.html', 'mitarbeiter.html', 'termine.webmanifest', 'mitarbeiter.webmanifest',
  'assets/app/termine-192.png', 'assets/app/termine-512.png', 'assets/app/team-192.png', 'assets/app/team-512.png', 'assets/logo/logo-dark.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(APP_DATEIEN)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(k => Promise.all(k.filter(n => n.startsWith('love-apps-') && n !== VERSION).map(n => caches.delete(n)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== self.location.origin) return;
  const pfad = u.pathname.replace(/^\//, '');
  if (!APP_DATEIEN.includes(pfad)) return;
  /* Zuerst das Netz (damit neue Versionen ankommen), ohne Netz die gespeicherte Fassung. */
  e.respondWith(fetch(e.request).then(r => {
    if (r.ok) { const kopie = r.clone(); caches.open(VERSION).then(c => c.put(pfad, kopie)); }
    return r;
  }).catch(() => caches.match(pfad)));
});
