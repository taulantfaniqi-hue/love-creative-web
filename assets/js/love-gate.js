/* LOVE Creative — Vorab-Sperre der Website (bis zur Eröffnung)
 *
 * Wird als ERSTES Skript im <head> jeder öffentlichen Seite geladen.
 * Ohne gültige Freischaltung geht es sofort zur Willkommensseite
 * (willkommen.html), wo das Passwort abgefragt wird.
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
  try {
    var v = JSON.parse(localStorage.getItem(KEY));
    if (v && v.h === HASH && v.exp > Date.now()) return; // freigeschaltet
  } catch (e) { /* weiter zur Sperre */ }
  location.replace('willkommen.html');
})();
