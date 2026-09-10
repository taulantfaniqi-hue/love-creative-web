/* LOVE Creative — Cloud-Verbindung (Infomaniak-API)
 *
 * Dünne Schicht über fetch(): prüft beim Laden, ob die API erreichbar ist,
 * und bietet call() (mit Antwort) sowie push() (Feuer-und-vergessen für
 * Schreibzugriffe). Ist die Cloud nicht erreichbar, arbeitet die Website
 * wie bisher rein lokal weiter — es geht nichts verloren.
 *
 * Einbindung: nach love-site.js, vor love-account.js.
 */
const LoveCloud = (() => {
  'use strict';
  /* Website läuft auf GitHub Pages, die Cloud-API auf Infomaniak —
     deshalb spricht die Website die API über die Subdomain an.
     Lokal (Vorschau) wird derselbe Ordner relativ verwendet. */
  const API = (location.hostname === 'localhost' || location.hostname === '127.0.0.1')
    ? 'api/index.php'
    : 'https://api.lovecreative.ch/api/index.php';
  let online = null; // null = noch unbekannt

  async function call(action, data, token) {
    const opts = {
      method: data === undefined ? 'GET' : 'POST',
      headers: {},
    };
    if (data !== undefined) {
      opts.headers['Content-Type'] = 'application/json';
      opts.body = JSON.stringify(data);
    }
    if (token) opts.headers['Authorization'] = 'Bearer ' + token;
    const r = await fetch(API + '?action=' + encodeURIComponent(action), opts);
    return r.json();
  }

  async function check() {
    try { const r = await call('ping'); online = !!(r && r.cloud); }
    catch (e) { online = false; }
    document.dispatchEvent(new CustomEvent('love:cloud', { detail: online }));
    return online;
  }

  /* Schreibzugriff ohne Warten — lokal ist schon gespeichert, Cloud zieht nach */
  function push(action, data) {
    const send = () => call(action, data).catch(() => {});
    if (online === true) send();
    else if (online === null) check().then(ok => { if (ok) send(); });
  }

  check();
  return { call, push, check, isOnline: () => online === true };
})();
