/* LOVE Creative — Online-Zahlung über Payrexx (echter Shop-Checkout)
 *
 * Ablauf wie in jedem Online-Shop:
 *   1. Website meldet den exakten Warenkorb-Betrag an unsere Cloud-API
 *   2. Die API erstellt serverseitig (API-Key bleibt auf dem Server!) die
 *      Payrexx-Zahlungsseite und liefert deren Link
 *   3. Der Browser wird DIREKT auf die Payrexx-Zahlungsseite weitergeleitet
 *   4. Nach der Zahlung leitet Payrexx zurück auf die Bestellbestätigung
 *      (geschenk.html?paid=CODE); der Webhook aktiviert den Gutschein.
 *
 * Konfiguriert wird alles serverseitig in api/config.php
 * (PAYREXX_INSTANCE + PAYREXX_API_KEY) — im Website-Code liegt kein Geheimnis.
 */
const LovePay = (() => {
  'use strict';

  /* Schnellwahl-Beträge für Geschenkkarten (CHF); daneben ist jeder
     individuelle Betrag zwischen MIN und MAX erlaubt. */
  const GIFT_AMOUNTS = [20, 30, 40, 50, 60, 70, 80, 100, 150, 200, 300, 400, 500];
  const GIFT_MIN = 20;
  const GIFT_MAX = 500;

  const cloud = () => (typeof LoveCloud !== 'undefined' && LoveCloud.isOnline());

  /* Online-Zahlung möglich? (Cloud erreichbar → der Server entscheidet den Rest) */
  function available() { return cloud(); }

  /* Checkout starten: Betrag an die API, dann direkte Weiterleitung zu Payrexx.
     Gibt ein Promise auf {ok, error} zurück — bei ok folgt sofort der Redirect. */
  async function checkout(opts) {
    if (!cloud()) return { ok: false, error: 'offline' };
    try {
      const r = await LoveCloud.call('gateway_create', {
        amount: opts.amount, code: opts.code, purpose: opts.purpose, email: opts.email
      });
      if (r.ok && r.link) {
        window.location.href = r.link; // direkte Weiterleitung auf die Payrexx-Zahlungsseite
        return { ok: true };
      }
      return { ok: false, error: r.error || 'payrexx-error' };
    } catch (e) {
      return { ok: false, error: 'network' };
    }
  }

  /* Zahlstatus für die Bestellbestätigung abfragen */
  async function status(code) {
    try {
      return await LoveCloud.call('voucher_status&code=' + encodeURIComponent(code));
    } catch (e) { return { ok: false }; }
  }

  return { available, checkout, status, GIFT_AMOUNTS, GIFT_MIN, GIFT_MAX };
})();
