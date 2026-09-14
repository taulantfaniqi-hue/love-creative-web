/* LOVE Creative — Vorab-Sperre der Website (bis zur Eröffnung)
 *
 * Wird als ERSTES Skript im <head> jeder öffentlichen Seite geladen.
 * Ohne gültige Freischaltung geht es sofort zur Willkommensseite
 * (willkommen.html), wo das Passwort abgefragt wird.
 *
 * AUSNAHME: Die Rechtsseiten (Impressum, AGB, Datenschutz) bleiben immer
 * öffentlich. Sie müssen ohne Passwort erreichbar sein — das verlangen
 * sowohl das Gesetz (Impressumspflicht) als auch die Kontoprüfung des
 * Zahlungsanbieters, die die Website von aussen besucht.
 *
 * Das Passwort steht nicht im Code, nur der SHA-256-Hash.
 * Freischaltung gilt 30 Tage pro Browser. Zum Entsperren der Sperre
 * einfach diese Zeile aus den Seiten entfernen:
 *   <script src="assets/js/love-gate.js"></script>
 */
(function () {
  'use strict';
  var KEY = 'love.gate.v1';
  var HASH = '97d5e196c8387b7bb2a3f7fcf16b5f6d4fafa09a997f910a61e4f8c69e8cf364';

  /* Immer öffentlich — ohne Passwort erreichbar */
  var OFFEN = ['impressum.html', 'agb.html', 'datenschutz.html', 'leistungen.html', 'willkommen.html'];
  var seite = location.pathname.split('/').pop().toLowerCase();
  if (OFFEN.indexOf(seite) !== -1) return;

  try {
    var v = JSON.parse(localStorage.getItem(KEY));
    if (v && v.h === HASH && v.exp > Date.now()) return; // freigeschaltet
  } catch (e) { /* weiter zur Sperre */ }
  location.replace('willkommen.html');
})();
