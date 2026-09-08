/* LOVE Creative — Online-Zahlung über Payrexx
 *
 * ⚠️ WICHTIG — API-Key: Der geheime Payrexx-API-Key gehört NIEMALS in den
 * Website-Code! Alles, was hier steht, kann jeder Besucher im Quelltext
 * lesen. Der API-Key wird erst gebraucht, wenn ein Server-Backend dazukommt
 * (z. B. PHP auf dem Infomaniak-Hosting) — dort liegt er dann in einer
 * Datei ausserhalb des Web-Verzeichnisses.
 *
 * Für die statische Website nutzen wir stattdessen PAYLINKS:
 *   Payrexx-Backoffice → «Paylink» → Neuer Paylink → Betrag/Zweck festlegen
 *   → den Link (https://DEIN-NAME.payrexx.com/pay?tid=…) unten eintragen.
 * Für Gutscheine einen Paylink mit «offenem Betrag» anlegen.
 *
 * Sobald ein Link eingetragen ist, erscheinen die Zahlen-Knöpfe automatisch
 * (Membership-Anmeldung, Gutschein-Kauf, Kino-Night-Buchung).
 */
const LovePay = (() => {
  'use strict';

  const CONFIG = {
    /* Dein Payrexx-Instanzname, z. B. 'lovecreative' für
       https://lovecreative.payrexx.com — nur für den Fallback-Link. */
    instance: '',

    /* Paylinks: Schlüssel → Payrexx-Paylink-URL */
    links: {
      'membership:member-halbjahr': '',   // CHF 25
      'membership:member-jahr':     '',   // CHF 40
      'membership:pro-halbjahr':    '',   // CHF 80
      'membership:pro-jahr':        '',   // CHF 140
      'kino':                       '',   // Kino-Night (z. B. offener Betrag oder Varianten im Paylink)
      'gutschein':                  ''    // Gutschein, Paylink mit offenem Betrag
    }
  };

  function url(key) {
    const u = CONFIG.links[key] || '';
    if (u) return u;
    /* Fallback: membership:* → generischer Instanz-Link, falls gesetzt */
    if (key.includes(':') && CONFIG.links[key.split(':')[0]]) return CONFIG.links[key.split(':')[0]];
    return '';
  }
  const available = key => !!url(key);

  /* Zahlungsseite öffnen; E-Mail/Name werden als Prefill-Parameter angehängt
     (Payrexx übernimmt sie, wenn die Felder im Paylink aktiviert sind). */
  function checkout(key, opts) {
    let u = url(key);
    if (!u) return false;
    const p = new URLSearchParams();
    if (opts && opts.email) p.set('contact_email', opts.email);
    if (opts && opts.name) p.set('contact_forename', opts.name);
    const q = p.toString();
    if (q) u += (u.includes('?') ? '&' : '?') + q;
    window.open(u, '_blank', 'noopener');
    return true;
  }

  /* Hängt einen «Jetzt online bezahlen»-Knopf in einen Container,
     wenn für `key` ein Paylink konfiguriert ist. */
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

  return { available, url, checkout, mountButton, CONFIG };
})();
