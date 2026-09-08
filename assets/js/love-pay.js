/* LOVE Creative — Online-Zahlung über Payrexx (dynamischer Betrag)
 *
 * ⚠️ WICHTIG — API-Key: Der geheime Payrexx-API-Key gehört NIEMALS in den
 * Website-Code! Alles hier ist im Quelltext öffentlich sichtbar.
 *
 * Der Zahlungsbetrag wird automatisch an Payrexx übergeben — wie im
 * Online-Shop. Zwei Wege (einer reicht):
 *
 *  1) EIN Paylink mit OFFENEM Betrag (Backoffice → Paylink → Betrag offen):
 *     URL unten bei links.gutschein eintragen. Der Betrag wird per
 *     ?invoice_amount=… vorbefüllt.
 *  2) Oder nur den Instanznamen eintragen (z. B. 'lovecreative' für
 *     lovecreative.payrexx.com): dann läuft die Zahlung über das
 *     Payrexx-Terminal (…/vpos?amount=…&purpose=…) — ganz ohne Paylink.
 *
 * Quelle: docs.payrexx.com → Tools → Paylink/Terminal (URL-Parameter).
 */
const LovePay = (() => {
  'use strict';

  /* Wählbare Geschenkkarten-Beträge (CHF) */
  const GIFT_AMOUNTS = [20, 30, 40, 50, 60, 70, 80, 100, 150, 200, 300, 400, 500];

  const CONFIG = {
    /* Payrexx-Instanzname, z. B. 'lovecreative' → lovecreative.payrexx.com */
    instance: '',
    links: {
      /* Ein Paylink mit offenem Betrag für Geschenkkarten (optional,
         hat Vorrang vor dem Terminal-Weg über instance) */
      'gutschein': ''
    }
  };

  const round2 = n => (Math.round(Number(n) * 100) / 100).toFixed(2);

  function available(key) {
    /* Online-Zahlung ist bewusst nur für Geschenkkarten frei —
       andere Bereiche erst, wenn dafür ein eigener Link hinterlegt wird. */
    return !!CONFIG.links[key] || (key === 'gutschein' && !!CONFIG.instance);
  }

  /* Zahlungsseite mit automatisch übergebenem Betrag öffnen. */
  function checkout(key, opts) {
    opts = opts || {};
    let u = '';
    const p = new URLSearchParams();
    if (CONFIG.links[key]) {
      u = CONFIG.links[key];
      if (opts.amount) p.set('invoice_amount', round2(opts.amount));
    } else if (CONFIG.instance) {
      u = 'https://' + CONFIG.instance + '.payrexx.com/de-CH/vpos';
      if (opts.amount) p.set('amount', round2(opts.amount));
    } else {
      return false;
    }
    if (opts.purpose) p.set('purpose', opts.purpose);
    if (opts.email) p.set('contact_email', opts.email);
    if (opts.name) p.set('contact_forename', opts.name);
    const q = p.toString();
    if (q) u += (u.includes('?') ? '&' : '?') + q;
    window.open(u, '_blank', 'noopener');
    return true;
  }

  /* «Jetzt online bezahlen»-Knopf in einen Container hängen (falls konfiguriert). */
  function mountButton(container, key, opts) {
    if (!container || !available(key)) return null;
    const en = window.LoveSite && LoveSite.lang() === 'en';
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn btn-green btn-block';
    btn.style.marginTop = '.8rem';
    btn.textContent = (en ? 'Pay online now' : 'Jetzt online bezahlen') + ' — TWINT / Karte';
    btn.addEventListener('click', () => checkout(key, opts));
    container.appendChild(btn);
    return btn;
  }

  return { available, checkout, mountButton, CONFIG, GIFT_AMOUNTS };
})();
