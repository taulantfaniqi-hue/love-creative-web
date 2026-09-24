/* LOVE Creative — Kundenkonto (öffentliche Website)
 *
 * Registrierung + Login für Gäste. Login mit E-Mail ODER Benutzername in
 * einem Feld. Passwörter werden NIE im Klartext gespeichert, nur als
 * SHA-256-Hash (pass : SALT : konto-id).
 *
 * Speicherung wie das ganze CRM: localStorage der Domain (love.customers.v1).
 * Eingeloggte Gäste sehen ihre Buchungen (Abgleich über die E-Mail) und
 * Formulare werden automatisch vorausgefüllt.
 *
 * Einbindung (nach love-data.js und love-site.js, vor love-widget.js):
 *   <link rel="stylesheet" href="assets/css/love-account.css">
 *   <script src="assets/js/love-account.js"></script>
 */
const LoveAccount = (() => {
  'use strict';
  const KEY = 'love.customers.v1';
  const SESSION_KEY = 'love.customer.session.v1';
  const SALT = 'LOVE-KUNDE-2026';
  const SESSION_DAYS = 30;

  const _read = () => { try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch (e) { return []; } };
  const _write = arr => localStorage.setItem(KEY, JSON.stringify(arr));
  const _id = () => 'K-' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 6).toUpperCase();

  async function sha256hex(str) {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
  }

  /* ---------- Cloud-Sitzung (Infomaniak-API) ---------- */
  const cloud = () => (typeof LoveCloud !== 'undefined' && LoveCloud.isOnline());
  function _cloudSession(r) {
    localStorage.setItem(SESSION_KEY, JSON.stringify({
      cloud: true, token: r.token, customer: r.customer, exp: Date.now() + SESSION_DAYS * 864e5
    }));
    document.dispatchEvent(new CustomEvent('love:account', { detail: r.customer }));
  }
  function _session() {
    try {
      const s = JSON.parse(localStorage.getItem(SESSION_KEY));
      return (s && s.exp > Date.now()) ? s : null;
    } catch (e) { return null; }
  }

  /* ---------- Konten ---------- */
  async function register({ name, email, username, phone, pass }) {
    email = String(email || '').trim().toLowerCase();
    username = String(username || '').trim().toLowerCase();
    /* Cloud zuerst — zentrales Konto, von jedem Gerät nutzbar */
    if (cloud()) {
      try {
        const r = await LoveCloud.call('register', { name, email, username, phone, pass });
        if (r.ok) { _cloudSession(r); return { ok: true, customer: r.customer }; }
        if (r.error === 'email-taken' || r.error === 'user-taken') return { ok: false, error: r.error };
      } catch (e) { /* lokal weiter */ }
    }
    const all = _read();
    if (all.some(c => c.email === email)) return { ok: false, error: 'email-taken' };
    if (username && all.some(c => c.username === username)) return { ok: false, error: 'user-taken' };
    const id = _id();
    const c = {
      id, name: String(name || '').trim(), email, username, phone: String(phone || '').trim(),
      passHash: await sha256hex(`${pass}:${SALT}:${id}`),
      created: new Date().toISOString(), lastLogin: new Date().toISOString()
    };
    all.push(c); _write(all);
    if (typeof LoveData !== 'undefined') LoveData.upsertContact(email, { name: c.name, phone: c.phone, tag: 'kundenkonto' });
    _startSession(c);
    return { ok: true, customer: c };
  }

  /* Login: `who` darf E-Mail ODER Benutzername sein */
  async function login(who, pass) {
    who = String(who || '').trim().toLowerCase();
    if (cloud()) {
      try {
        const r = await LoveCloud.call('login', { who, pass });
        if (r.ok) { _cloudSession(r); return { ok: true, customer: r.customer }; }
        if (r.error === 'wrong-pass') return { ok: false, error: 'wrong-pass' };
        /* 'unknown' in der Cloud → evtl. altes lokales Konto, unten weiterprüfen */
      } catch (e) { /* lokal weiter */ }
    }
    const all = _read();
    const c = all.find(x => x.email === who || (x.username && x.username === who));
    if (!c) return { ok: false, error: 'unknown' };
    const hash = await sha256hex(`${pass}:${SALT}:${c.id}`);
    if (hash !== c.passHash) return { ok: false, error: 'wrong-pass' };
    c.lastLogin = new Date().toISOString(); _write(all);
    _startSession(c);
    return { ok: true, customer: c };
  }

  function _startSession(c) {
    localStorage.setItem(SESSION_KEY, JSON.stringify({ id: c.id, exp: Date.now() + SESSION_DAYS * 864e5 }));
    document.dispatchEvent(new CustomEvent('love:account', { detail: current() }));
  }
  function logout() {
    const s = _session();
    if (s && s.cloud && s.token && typeof LoveCloud !== 'undefined') LoveCloud.call('logout', {}, s.token).catch(() => {});
    localStorage.removeItem(SESSION_KEY);
    document.dispatchEvent(new CustomEvent('love:account', { detail: null }));
  }
  function current() {
    const s = _session();
    if (!s) return null;
    if (s.cloud) return s.customer || null;
    return _read().find(c => c.id === s.id) || null;
  }
  const listCustomers = () => _read().map(c => ({ id: c.id, name: c.name, email: c.email, username: c.username, phone: c.phone, created: c.created, lastLogin: c.lastLogin }));

  function myBookings() {
    const c = current();
    if (!c || typeof LoveData === 'undefined') return [];
    return LoveData.listBookings().filter(b => b.email === c.email);
  }

  /* ═══════════ UI: Konto-Button im Header + Modal ═══════════ */
  const TX = {
    de: {
      account: 'Konto', hello: n => n.split(' ')[0],
      title: 'Dein LOVE-Konto',
      tabLogin: 'Anmelden', tabReg: 'Konto erstellen',
      who: 'E-Mail oder Benutzername', pass: 'Passwort',
      loginBtn: 'Anmelden',
      name: 'Name', email: 'E-Mail', username: 'Benutzername (optional)', phone: 'Telefon (optional)',
      pass2: 'Passwort (mind. 6 Zeichen)', regBtn: 'Konto erstellen',
      regHint: 'Mit dem Konto siehst du deine Reservationen und musst Formulare nicht mehr ausfüllen.',
      errUnknown: 'Kein Konto mit dieser E-Mail / diesem Benutzernamen gefunden.',
      errPass: 'Falsches Passwort.', errTakenMail: 'Für diese E-Mail existiert schon ein Konto — melde dich an.',
      errTakenUser: 'Dieser Benutzername ist schon vergeben.',
      errReg: 'Bitte Name, gültige E-Mail und ein Passwort mit mind. 6 Zeichen angeben.',
      errLogin: 'Bitte beide Felder ausfüllen.',
      myData: 'Deine Angaben', myBookings: 'Deine Buchungen', noBookings: 'Noch keine Buchungen — Zeit für einen Besuch ♥',
      myVouchers: 'Deine Geschenkkarten', noVouchers: 'Noch keine Geschenkkarten.',
      myOrders: 'Deine Bestellungen', noOrders: 'Noch keine Bestellungen — schau doch mal im Shop vorbei ♥',
      track: 'Sendung verfolgen ↗',
      oStat: { neu: 'eingegangen', bezahlt: 'bezahlt', abholbereit: 'abholbereit', abgeholt: 'abgeholt', versendet: 'versendet', zugestellt: 'zugestellt', storniert: 'storniert' },
      vActive: 'aktiv', vOpen: 'Zahlung offen',
      vCard: 'Karte ansehen (PDF) →',
      vAdd: 'Geschenkkarte mit Code hinzufügen', vAddPh: 'LOVE-XXXX-XXXX', vAddBtn: 'Hinzufügen',
      vAddOk: 'Geschenkkarte ist jetzt in deinem Konto ♥', vAddBad: 'Code nicht gefunden — bitte prüfen (Format LOVE-XXXX-XXXX).',
      user: 'Benutzername', since: 'Konto seit', logoutBtn: 'Abmelden', close: 'Schliessen',
      stat: { neu: 'eingegangen', 'bestätigt': 'bestätigt', gewonnen: 'bestätigt', offeriert: 'Offerte', storniert: 'storniert', verloren: 'storniert' },
      next: 'Weiter', changeWho: 'ändern', forgot: 'Passwort vergessen?',
      resetSent: 'Anfrage gesendet — unser Team gibt den Passwort-Reset frei. Das dauert in der Regel nur kurz.',
      resetCheck: 'Freigabe prüfen', resetPendingStill: 'Noch nicht freigegeben — bitte später erneut prüfen.',
      resetApproved: 'Freigegeben! Setz jetzt dein neues Passwort:',
      newPass: 'Neues Passwort (mind. 6 Zeichen)', setPass: 'Passwort speichern',
      resetErr: 'Das hat nicht geklappt — bitte prüf die Eingaben.',
      myPoints: 'Deine Treuepunkte', pointsLine: (p, chf) => `<b>${p} Punkte</b> · Guthaben CHF ${chf}`,
      pointsHint: '1 Punkt pro ausgegebenem Franken · 100 Punkte = CHF 2 Gutschrift',
      redeemBtn: 'Einlösen (100 Punkte = CHF 2)', redeemWhere: 'Wo möchtest du einlösen?',
      redeemStore: 'Im Laden', redeemOnline: 'Online', redeemCancel: 'Abbrechen',
      myRedeems: 'Punkte-Gutscheine',
      rStat: { offen: 'ausstehend', genehmigt: 'freigegeben', abgelehnt: 'abgelehnt', 'eingelöst': 'eingelöst' },
      switchTo: m => m === 'laden' ? 'Zu Online wechseln' : 'Zu Im Laden wechseln',
      modeLbl: m => m === 'laden' ? 'Im Laden' : 'Online-Rabattcode',
      onlineHint: 'Rabattcode im Geschenkkarten-Warenkorb eingeben.',
      storeHint: 'Referenz an der Kasse zeigen.',
      cancelBtn: 'Stornieren', cancelOk: 'Buchung storniert.',
      cancelLate: 'Stornierung ist nur bis 24 h vor dem Termin möglich.',
      cancelHint: 'Kostenlos stornierbar bis 24 h vor dem Termin.',
      cancelConfirm: 'Diese Buchung wirklich stornieren?',
      noAccount: 'Zu dieser E-Mail gibt es noch kein Konto — wir erstellen es jetzt für dich. Deine bisherigen Buchungen und Treuepunkte sind danach automatisch drin.',
      sendCode: 'Bestätigungscode senden',
      codeSent: 'Code verschickt! Schau in dein Postfach (auch im Spam) und gib den Code hier ein:',
      codePh: 'Bestätigungscode (6 Ziffern)',
      claimBtn: 'Konto erstellen & anmelden',
      codeErr: 'Der Code stimmt nicht oder ist abgelaufen — bitte neu senden.',
      linkPass: 'Fast geschafft — setz jetzt dein Passwort. Deine Buchungen und Treuepunkte sind schon in deinem Konto.',
      resend: 'Code neu senden'
    },
    en: {
      account: 'Account', hello: n => n.split(' ')[0],
      title: 'Your LOVE account',
      tabLogin: 'Sign in', tabReg: 'Create account',
      who: 'E-mail or username', pass: 'Password',
      loginBtn: 'Sign in',
      name: 'Name', email: 'E-mail', username: 'Username (optional)', phone: 'Phone (optional)',
      pass2: 'Password (min. 6 characters)', regBtn: 'Create account',
      regHint: 'With an account you see your reservations and forms are pre-filled for you.',
      errUnknown: 'No account found for this e-mail / username.',
      errPass: 'Wrong password.', errTakenMail: 'An account already exists for this e-mail — sign in instead.',
      errTakenUser: 'This username is already taken.',
      errReg: 'Please enter your name, a valid e-mail and a password with at least 6 characters.',
      errLogin: 'Please fill in both fields.',
      myData: 'Your details', myBookings: 'Your bookings', noBookings: 'No bookings yet — time for a visit ♥',
      myVouchers: 'Your gift cards', noVouchers: 'No gift cards yet.',
      myOrders: 'Your orders', noOrders: 'No orders yet — have a look at the shop ♥',
      track: 'Track shipment ↗',
      oStat: { neu: 'received', bezahlt: 'paid', abholbereit: 'ready for pick-up', abgeholt: 'picked up', versendet: 'shipped', zugestellt: 'delivered', storniert: 'cancelled' },
      vActive: 'active', vOpen: 'payment pending',
      vCard: 'View card (PDF) →',
      vAdd: 'Add a gift card by code', vAddPh: 'LOVE-XXXX-XXXX', vAddBtn: 'Add',
      vAddOk: 'The gift card is now in your account ♥', vAddBad: 'Code not found — please check (format LOVE-XXXX-XXXX).',
      user: 'Username', since: 'Member since', logoutBtn: 'Sign out', close: 'Close',
      stat: { neu: 'received', 'bestätigt': 'confirmed', gewonnen: 'confirmed', offeriert: 'offer sent', storniert: 'cancelled', verloren: 'cancelled' },
      next: 'Continue', changeWho: 'change', forgot: 'Forgot password?',
      resetSent: 'Request sent — our team approves the password reset. This usually only takes a moment.',
      resetCheck: 'Check approval', resetPendingStill: 'Not approved yet — please check again later.',
      resetApproved: 'Approved! Set your new password now:',
      newPass: 'New password (min. 6 characters)', setPass: 'Save password',
      resetErr: 'That did not work — please check your input.',
      myPoints: 'Your loyalty points', pointsLine: (p, chf) => `<b>${p} points</b> · credit CHF ${chf}`,
      pointsHint: '1 point per franc spent · 100 points = CHF 2 credit',
      redeemBtn: 'Redeem (100 points = CHF 2)', redeemWhere: 'Where would you like to redeem?',
      redeemStore: 'In store', redeemOnline: 'Online', redeemCancel: 'Cancel',
      myRedeems: 'Point vouchers',
      rStat: { offen: 'pending', genehmigt: 'approved', abgelehnt: 'declined', 'eingelöst': 'redeemed' },
      switchTo: m => m === 'laden' ? 'Switch to online' : 'Switch to in store',
      modeLbl: m => m === 'laden' ? 'In store' : 'Online discount code',
      onlineHint: 'Enter the code in the gift card cart.',
      storeHint: 'Show the reference at the counter.',
      cancelBtn: 'Cancel booking', cancelOk: 'Booking cancelled.',
      cancelLate: 'Cancellation is only possible up to 24 h before your visit.',
      cancelHint: 'Free cancellation up to 24 h before your visit.',
      cancelConfirm: 'Really cancel this booking?',
      noAccount: 'There is no account for this e-mail yet — we will create it now. Your existing bookings and loyalty points will be in it automatically.',
      sendCode: 'Send confirmation code',
      codeSent: 'Code sent! Check your inbox (and spam) and enter the code here:',
      codePh: 'Confirmation code (6 digits)',
      claimBtn: 'Create account & sign in',
      codeErr: 'The code is wrong or expired — please resend it.',
      linkPass: 'Almost there — set your password now. Your bookings and loyalty points are already in your account.',
      resend: 'Resend code'
    }
  };
  const tx = () => (window.LoveSite && LoveSite.lang() === 'en') ? TX.en : TX.de;
  const esc = s => String(s || '').replace(/[&<>"]/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[m]));

  let tab = 'login';
  function initUI() {
    /* Header-UI nur auf den öffentlichen Seiten (host.html nutzt nur die Daten-API) */
    const navIn = document.querySelector('.nav-in');
    if (!navIn || !window.LoveSite) return;
    const btn = document.createElement('button');
    btn.id = 'accBtn'; btn.className = 'acc-btn'; btn.type = 'button';
    btn.setAttribute('aria-haspopup', 'dialog');
    /* Nur die Sprachwahl DIREKT in der Kopfzeile meinen: Im aufklappbaren Menü liegt seit dem
       22.09.2026 eine zweite (fürs Handy). Ohne «:scope >» fand querySelector jene zuerst — sie ist
       kein direktes Kind der Kopfzeile, insertBefore scheiterte, und der Knopf fehlte ganz. */
    navIn.insertBefore(btn, navIn.querySelector(':scope > .lang-switch'));

    document.body.insertAdjacentHTML('beforeend', `
      <div class="acc-backdrop" id="accBackdrop"></div>
      <div class="acc-modal" id="accModal" role="dialog" aria-modal="true" aria-labelledby="accTitle">
        <div class="acc-head"><span class="acc-script" id="accTitle"></span>
        <button class="acc-close" id="accClose" type="button">✕</button></div>
        <div class="acc-body" id="accBody"></div>
      </div>`);
    document.getElementById('accBtn').addEventListener('click', openModal);
    document.getElementById('accClose').addEventListener('click', closeModal);
    document.getElementById('accBackdrop').addEventListener('click', closeModal);
    addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });
    renderBtn();
    document.addEventListener('love:lang', () => { renderBtn(); if (isOpen()) renderModal(); });
    document.addEventListener('love:account', () => { renderBtn(); prefillForms(); });
    prefillForms();

    /* «Hier anmelden»-Link aus der Bestätigungs-Mail: ?konto=<token>
       → Modal öffnet sich, E-Mail ist erkannt, nur noch Passwort setzen/eingeben. */
    const claimParam = new URLSearchParams(location.search).get('konto');
    if (claimParam && /^[a-f0-9]{64}$/.test(claimParam) && !current()) {
      history.replaceState(null, '', location.pathname + location.hash);
      (async () => {
        if (typeof LoveCloud !== 'undefined') {
          try {
            const r = await LoveCloud.call('claim_info&token=' + claimParam);
            if (r.ok) {
              tab = 'login'; loginWho = r.email; claimToken = claimParam;
              if (r.account) { loginStep = 'pass'; }
              else { loginStep = 'claim'; claimPhase = 'set'; }
            }
          } catch (e) { /* Modal öffnet trotzdem */ }
        }
        openModal();
      })();
    }
  }
  const isOpen = () => document.getElementById('accModal').classList.contains('open');
  function openModal() {
    renderModal();
    document.getElementById('accModal').classList.add('open');
    document.getElementById('accBackdrop').classList.add('open');
    /* Punktestand & Daten frisch vom Server holen */
    refreshMe().then(() => { if (isOpen() && current()) renderModal(); });
  }
  function closeModal() { document.getElementById('accModal').classList.remove('open'); document.getElementById('accBackdrop').classList.remove('open'); }

  function renderBtn() {
    const x = tx(); const c = current();
    const b = document.getElementById('accBtn');
    /* Text in eigener Hülle: auf dem Handy zeigt die Kopfzeile nur das Herz (love-account.css) */
    const etikett = c ? x.hello(c.name || c.email) : x.account;
    if (b) { b.innerHTML = `<span aria-hidden="true">♥</span><span class="acc-txt"> ${esc(etikett)}</span>`; b.setAttribute('aria-label', etikett); }
  }

  /* Zweistufiger Login: zuerst E-Mail/Benutzername — der Server erkennt dann,
     ob ein Konto existiert (→ Passwort) oder nicht (→ Konto per Code anlegen). */
  let loginStep = 'who';   // 'who' | 'pass' | 'reset' | 'claim'
  let loginWho = '';
  let resetApproved = false;
  let claimPhase = 'ask';  // 'ask' (Code anfordern) | 'code' (Code + Passwort) | 'set' (nur Passwort, per Mail-Link)
  let claimToken = '';     // Einmal-Token aus der Bestätigungs-Mail

  /* Frische Kundendaten (inkl. Punkte) vom Server holen */
  function refreshMe() {
    const s = _session();
    if (!(s && s.cloud && s.token && typeof LoveCloud !== 'undefined')) return Promise.resolve();
    return LoveCloud.call('me', undefined, s.token).then(r => {
      if (r.ok) {
        s.customer = r.customer;
        localStorage.setItem(SESSION_KEY, JSON.stringify(s));
      }
    }).catch(() => {});
  }

  /* Kann diese Buchung noch kostenlos storniert werden? (bis 24 h vorher) */
  function cancellable(b) {
    if (!b.date || ['storniert', 'verloren'].includes(b.status)) return false;
    const m = /^(\d{1,2}[:.]\d{2})/.exec(String(b.time || ''));
    const start = new Date(b.date + 'T' + (m ? m[1].replace('.', ':').padStart(5, '0') : '09:00') + ':00');
    return !isNaN(start) && (start.getTime() - Date.now()) > 24 * 3600 * 1000;
  }

  function renderModal() {
    const x = tx(); const c = current();
    document.getElementById('accTitle').textContent = x.title;
    const body = document.getElementById('accBody');
    if (c) {
      const s = _session();
      const isCloud = !!(s && s.cloud && s.token && typeof LoveCloud !== 'undefined');
      const fmt = iso => new Date(iso).toLocaleDateString(LoveSite.lang() === 'en' ? 'en-GB' : 'de-CH', { day: 'numeric', month: 'long', year: 'numeric' });
      const bookingsHtml = list => list.length ? list.slice(0, 8).map(b => `
          <div class="acc-card acc-booking">
            <span><b>${esc(b.type === 'kino' ? 'Kino-Night' : b.type === 'tisch' ? (LoveSite.lang() === 'en' ? 'Table' : 'Tisch') : b.type)}</b>
            ${b.date ? ' · ' + String(b.date).split('-').reverse().join('.') : ''}${b.time ? ' · ' + b.time : ''}${b.persons ? ' · ' + b.persons + ' P.' : ''}</span>
            <span style="display:flex;gap:.5rem;align-items:center">
              <span class="acc-status">${x.stat[b.status] || esc(b.status)}</span>
              ${cancellable(b) ? `<button type="button" class="btn btn-ghost btn-sm acc-cancel" data-id="${esc(b.id)}">${x.cancelBtn}</button>` : ''}
            </span>
          </div>`).join('') + `<p class="acc-dim" style="margin-top:.4rem">${x.cancelHint}</p>`
        : `<p class="acc-dim">${x.noBookings}</p>`;
      const points = Number(c.points || 0);
      const chfCredit = (points / 50).toFixed(2);
      body.innerHTML = `
        <p class="acc-sub">${x.myData}</p>
        <div class="acc-card">
          <p><b>${esc(c.name)}</b></p>
          <p>${esc(c.email)}</p>
          ${c.username ? `<p>${x.user}: ${esc(c.username)}</p>` : ''}
          <p class="acc-dim">${x.since} ${fmt(c.created)}</p>
        </div>
        ${'' /* Treuepunkte und Punkte-Gutscheine sind ausgeblendet: Rabatte wurden
                von der Website genommen (Entscheid 20.09.2026). Der Server zählt die
                Punkte weiter, es geht also nichts verloren — zum Wiedereinschalten
                genügt es, diesen Block und die Rabattfelder an den Kassen zurückzuholen. */}
        <p class="acc-sub">${x.myBookings}</p>
        <div id="accBookings">${bookingsHtml(myBookings())}</div>
        <p class="acc-sub">${x.myOrders}</p>
        <div id="accOrders"><p class="acc-dim">${x.noOrders}</p></div>
        <p class="acc-sub">${x.myVouchers}</p>
        <div id="accVouchers"><p class="acc-dim">${x.noVouchers}</p></div>
        ${isCloud ? `<form id="accVClaim" style="display:flex;gap:.4rem;margin-top:.55rem" novalidate>
          <input type="text" id="accVCode" placeholder="${x.vAddPh}" aria-label="${x.vAdd}" autocomplete="off" style="flex:1;min-width:0">
          <button type="submit" class="btn btn-ghost btn-sm">${x.vAddBtn}</button>
        </form>
        <p class="acc-dim" id="accVMsg" aria-live="polite">${x.vAdd}</p>` : ''}
        <button type="button" class="btn btn-ghost btn-block" id="accLogout" style="margin-top:1rem">${x.logoutBtn}</button>`;
      document.getElementById('accLogout').addEventListener('click', () => { logout(); renderModal(); });

      /* Geschenkkarte per Code ins Konto übernehmen (Code = Besitznachweis) */
      const vc = document.getElementById('accVClaim');
      if (vc) vc.addEventListener('submit', async e => {
        e.preventDefault();
        const msg = document.getElementById('accVMsg');
        const code = document.getElementById('accVCode').value.trim().toUpperCase();
        if (!/^LOVE-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(code)) { msg.textContent = x.vAddBad; return; }
        try {
          const r = await LoveCloud.call('voucher_claim', { code }, s.token);
          if (r.ok) { msg.textContent = x.vAddOk; renderModal(); return; }
        } catch (er) { /* unten gemeinsame Fehlermeldung */ }
        msg.textContent = x.vAddBad;
      });

      /* Stornieren (Cloud oder lokal) */
      const wireCancel = () => body.querySelectorAll('.acc-cancel').forEach(btn => btn.addEventListener('click', async () => {
        if (!confirm(x.cancelConfirm)) return;
        btn.disabled = true;
        if (isCloud) {
          try {
            const r = await LoveCloud.call('booking_cancel', { id: btn.dataset.id }, s.token);
            if (!r.ok) { alert(r.error === 'too-late' ? x.cancelLate : x.resetErr); btn.disabled = false; return; }
          } catch (e) { btn.disabled = false; return; }
        } else if (typeof LoveData !== 'undefined') {
          LoveData.updateBooking(btn.dataset.id, { status: 'storniert' });
        }
        renderModal();
      }));
      wireCancel();

      /* Punkte einlösen: Ort wählen → Anfrage an den Host */
      const redeemBtn = document.getElementById('accRedeem');
      if (redeemBtn) redeemBtn.addEventListener('click', () => {
        document.getElementById('accRedeemBox').innerHTML = `
          <p style="margin-bottom:.4rem"><b>${x.redeemWhere}</b></p>
          <div style="display:flex;gap:.5rem;flex-wrap:wrap">
            <button type="button" class="btn btn-rose btn-sm" data-mode="laden">${x.redeemStore}</button>
            <button type="button" class="btn btn-rose btn-sm" data-mode="online">${x.redeemOnline}</button>
            <button type="button" class="btn btn-ghost btn-sm" data-mode="">${x.redeemCancel}</button>
          </div>`;
        document.getElementById('accRedeemBox').querySelectorAll('button').forEach(mb => mb.addEventListener('click', async () => {
          if (!mb.dataset.mode) { renderModal(); return; }
          try { await LoveCloud.call('redeem_request', { mode: mb.dataset.mode }, s.token); } catch (e) { }
          refreshMe().then(renderModal);
        }));
      });

      if (isCloud) {
        LoveCloud.call('my_bookings', undefined, s.token).then(r => {
          const box = document.getElementById('accBookings');
          if (r.ok && box) { box.innerHTML = bookingsHtml(r.bookings); wireCancel(); }
        }).catch(() => {});
        LoveCloud.call('my_vouchers', undefined, s.token).then(r => {
          const box = document.getElementById('accVouchers');
          if (r.ok && box && r.vouchers.length) {
            box.innerHTML = r.vouchers.slice(0, 8).map(v => `
              <div class="acc-card" style="margin-bottom:.4rem">
                <div class="acc-booking">
                  <span><b>${esc(v.code)}</b> · CHF ${Number(v.balance).toFixed(0)} / ${Number(v.amount).toFixed(0)}</span>
                  <span class="acc-status">${(v.paid == 1) ? x.vActive : x.vOpen}</span>
                </div>
                ${(v.paid == 1) ? `<p style="margin-top:.3rem"><a href="geschenk.html?card=${encodeURIComponent(v.code)}"><b>${x.vCard}</b></a></p>` : ''}
              </div>`).join('');
          }
        }).catch(() => {});
        LoveCloud.call('my_orders', undefined, s.token).then(r => {
          const box = document.getElementById('accOrders');
          if (!(r.ok && box && r.orders.length)) return;
          /* «versendet» gilt 3 Tage nach dem Versand automatisch als «zugestellt» */
          const oStat = o => (o.status === 'versendet' && o.shipped_at
            && (Date.now() - new Date(String(o.shipped_at).replace(' ', 'T')).getTime()) > 3 * 864e5) ? 'zugestellt' : o.status;
          const itemsList = o => {
            try {
              return (JSON.parse(o.items) || []).map(i =>
                `<span style="display:block">${esc(i.qty + '× ' + (i.name || i.sku))}</span>`).join('');
            } catch (e) { return ''; }
          };
          box.innerHTML = r.orders.slice(0, 10).map(o => `
            <div class="acc-card" style="margin-bottom:.4rem">
              <div class="acc-booking">
                <span><b>${esc(o.id)}</b> · ${fmt(String(o.ts).replace(' ', 'T'))} · CHF ${Number(o.total).toFixed(2)}</span>
                <span class="acc-status">${x.oStat[oStat(o)] || esc(o.status)}</span>
              </div>
              <div class="acc-dim" style="margin-top:.3rem">${itemsList(o)}</div>
              ${o.tracking ? `<p style="margin-top:.4rem"><a href="${esc(o.tracking)}" target="_blank" rel="noopener"><b>${x.track}</b></a></p>` : ''}
            </div>`).join('');
        }).catch(() => {});
        LoveCloud.call('my_redemptions', undefined, s.token).then(r => {
          const box = document.getElementById('accRedeems');
          if (!(r.ok && box && r.redemptions.length)) return;
          box.innerHTML = `<div style="margin-top:.5rem">` + r.redemptions.map(rd => `
            <div class="acc-card" style="margin-bottom:.4rem">
              <div class="acc-booking">
                <span><b>${esc(rd.code)}</b> · CHF ${Number(rd.amount).toFixed(2)} · ${x.modeLbl(rd.mode)}</span>
                <span class="acc-status">${x.rStat[rd.status] || esc(rd.status)}</span>
              </div>
              <p class="acc-dim" style="margin-top:.25rem">${rd.mode === 'online' ? x.onlineHint : x.storeHint}</p>
              ${['offen', 'genehmigt'].includes(rd.status) ? `<button type="button" class="btn btn-ghost btn-sm acc-switch" data-id="${esc(rd.id)}" data-mode="${rd.mode === 'laden' ? 'online' : 'laden'}" style="margin-top:.35rem">${x.switchTo(rd.mode)}</button>` : ''}
            </div>`).join('') + '</div>';
          box.querySelectorAll('.acc-switch').forEach(sb => sb.addEventListener('click', async () => {
            try { await LoveCloud.call('redeem_mode', { id: sb.dataset.id, mode: sb.dataset.mode }, s.token); } catch (e) { }
            renderModal();
          }));
        }).catch(() => {});
      }
    } else {
      /* ── Nicht eingeloggt: Tabs Anmelden / Konto erstellen ── */
      const whoEsc = esc(loginWho);
      let formHtml = '';
      if (tab === 'login' && loginStep === 'who') {
        formHtml = `
          <input type="text" id="accWho" placeholder="${x.who}" autocomplete="username" value="${whoEsc}">
          <p class="acc-err" id="accErr" aria-live="polite"></p>
          <button type="submit" class="btn btn-rose btn-block">${x.next}</button>`;
      } else if (tab === 'login' && loginStep === 'pass') {
        formHtml = `
          <p class="acc-card" style="display:flex;justify-content:space-between;align-items:center;gap:.6rem">
            <b style="overflow-wrap:anywhere">${whoEsc}</b>
            <button type="button" class="btn btn-ghost btn-sm" id="accBackWho">${x.changeWho}</button>
          </p>
          <input type="password" id="accPass" placeholder="${x.pass}" autocomplete="current-password">
          <p class="acc-err" id="accErr" aria-live="polite"></p>
          <button type="submit" class="btn btn-rose btn-block">${x.loginBtn}</button>
          <p style="margin-top:.7rem;text-align:center"><a href="#" id="accForgot">${x.forgot}</a></p>`;
      } else if (tab === 'login' && loginStep === 'claim') {
        const whoRow = `
          <p class="acc-card" style="display:flex;justify-content:space-between;align-items:center;gap:.6rem">
            <b style="overflow-wrap:anywhere">${whoEsc}</b>
            <button type="button" class="btn btn-ghost btn-sm" id="accBackWho">${x.changeWho}</button>
          </p>`;
        if (claimPhase === 'set') {
          formHtml = whoRow + `
            <p class="acc-card">${x.linkPass}</p>
            <input type="password" id="accPass" placeholder="${x.newPass}" autocomplete="new-password">
            <p class="acc-err" id="accErr" aria-live="polite"></p>
            <button type="submit" class="btn btn-rose btn-block">${x.setPass}</button>`;
        } else if (claimPhase === 'code') {
          formHtml = whoRow + `
            <p class="acc-card">${x.codeSent}</p>
            <input type="text" id="accCode" placeholder="${x.codePh}" inputmode="numeric" autocomplete="one-time-code">
            <input type="password" id="accPass" placeholder="${x.newPass}" autocomplete="new-password">
            <p class="acc-err" id="accErr" aria-live="polite"></p>
            <button type="submit" class="btn btn-rose btn-block">${x.claimBtn}</button>
            <p style="margin-top:.7rem;text-align:center"><a href="#" id="accResend">${x.resend}</a></p>`;
        } else {
          formHtml = whoRow + `
            <p class="acc-card">${x.noAccount}</p>
            <p class="acc-err" id="accErr" aria-live="polite"></p>
            <button type="submit" class="btn btn-rose btn-block">${x.sendCode}</button>`;
        }
      } else if (tab === 'login' && loginStep === 'reset') {
        formHtml = resetApproved ? `
          <p class="acc-card">${x.resetApproved}</p>
          <input type="password" id="accPass" placeholder="${x.newPass}" autocomplete="new-password">
          <p class="acc-err" id="accErr" aria-live="polite"></p>
          <button type="submit" class="btn btn-rose btn-block">${x.setPass}</button>` : `
          <p class="acc-card">${x.resetSent}</p>
          <p class="acc-err" id="accErr" aria-live="polite"></p>
          <button type="submit" class="btn btn-rose btn-block">${x.resetCheck}</button>
          <p style="margin-top:.7rem;text-align:center"><a href="#" id="accBackWho">${x.changeWho}</a></p>`;
      } else {
        formHtml = `
          <input type="text" id="accName" placeholder="${x.name}" autocomplete="name">
          <input type="email" id="accEmail" placeholder="${x.email}" autocomplete="email">
          <input type="text" id="accUser" placeholder="${x.username}" autocomplete="username">
          <input type="tel" id="accPhone" placeholder="${x.phone}" autocomplete="tel">
          <input type="password" id="accPass" placeholder="${x.pass2}" autocomplete="new-password">
          <p class="acc-err" id="accErr" aria-live="polite"></p>
          <button type="submit" class="btn btn-rose btn-block">${x.regBtn}</button>
          <p class="acc-dim" style="margin-top:.7rem">${x.regHint}</p>`;
      }
      body.innerHTML = `
        <div class="acc-tabs" role="tablist">
          <button type="button" class="acc-tab" data-tab="login" aria-pressed="${tab === 'login'}">${x.tabLogin}</button>
          <button type="button" class="acc-tab" data-tab="reg" aria-pressed="${tab === 'reg'}">${x.tabReg}</button>
        </div>
        <form id="accForm" novalidate>${formHtml}</form>`;
      body.querySelectorAll('.acc-tab').forEach(b => b.addEventListener('click', () => { tab = b.dataset.tab; loginStep = 'who'; renderModal(); }));
      document.getElementById('accForm').addEventListener('submit', onSubmit);
      const back = document.getElementById('accBackWho');
      if (back) back.addEventListener('click', e => { e.preventDefault(); loginStep = 'who'; resetApproved = false; claimPhase = 'ask'; claimToken = ''; renderModal(); });
      const resend = document.getElementById('accResend');
      if (resend) resend.addEventListener('click', async e => {
        e.preventDefault();
        try { await LoveCloud.call('claim_request', { email: loginWho }); } catch (er) { }
        const errEl = document.getElementById('accErr');
        if (errEl) errEl.textContent = tx().codeSent;
      });
      const forgot = document.getElementById('accForgot');
      if (forgot) forgot.addEventListener('click', async e => {
        e.preventDefault();
        /* Kommt der Gast über den Mail-Link, ist die E-Mail schon bestätigt →
           Passwort direkt neu setzen, ohne Host-Freigabe. */
        if (claimToken) { loginStep = 'claim'; claimPhase = 'set'; renderModal(); return; }
        resetApproved = false;
        if (typeof LoveCloud !== 'undefined') { try { await LoveCloud.call('pw_reset_request', { email: loginWho }); } catch (err) { } }
        loginStep = 'reset';
        renderModal();
      });
      const p = document.getElementById('accPass') || document.getElementById('accWho');
      if (p) p.focus();
    }
  }

  async function onSubmit(e) {
    e.preventDefault();
    const x = tx(); const err = document.getElementById('accErr');
    if (tab === 'login' && loginStep === 'who') {
      const who = document.getElementById('accWho').value.trim();
      if (!who) { err.textContent = x.errLogin; return; }
      loginWho = who.toLowerCase();
      /* Server erkennt selbstständig: Konto vorhanden → Passwort, sonst → Konto anlegen */
      if (cloud()) {
        try {
          const r = await LoveCloud.call('login_probe', { who: loginWho });
          if (r.ok && !r.account && LoveSite.validEmail(loginWho)) {
            loginStep = 'claim'; claimPhase = 'ask'; claimToken = '';
            renderModal();
            return;
          }
        } catch (er) { /* offline → normaler Passwort-Schritt */ }
      }
      loginStep = 'pass';
      renderModal();
      return;
    }
    if (tab === 'login' && loginStep === 'claim') {
      if (claimPhase === 'ask') {
        try { await LoveCloud.call('claim_request', { email: loginWho }); } catch (er) { }
        claimPhase = 'code';
        renderModal();
        return;
      }
      const pass = document.getElementById('accPass').value;
      if (pass.length < 6) { err.textContent = x.errReg; return; }
      const payload = claimPhase === 'set' && claimToken
        ? { token: claimToken, pass }
        : { email: loginWho, code: (document.getElementById('accCode') || { value: '' }).value.trim(), pass };
      try {
        const r = await LoveCloud.call('claim_set', payload);
        if (r.ok) { _cloudSession(r); loginStep = 'who'; claimPhase = 'ask'; claimToken = ''; renderModal(); return; }
        err.textContent = r.error === 'wrong-code' ? x.codeErr : x.resetErr;
      } catch (er) { err.textContent = x.resetErr; }
      return;
    }
    if (tab === 'login' && loginStep === 'reset') {
      if (!resetApproved) {
        /* Freigabe beim Server prüfen */
        try {
          const r = await LoveCloud.call('pw_reset_status&email=' + encodeURIComponent(loginWho));
          if (r.ok && r.status === 'genehmigt') { resetApproved = true; renderModal(); return; }
        } catch (er) { }
        err.textContent = x.resetPendingStill;
        return;
      }
      const pass = document.getElementById('accPass').value;
      if (pass.length < 6) { err.textContent = x.errReg; return; }
      try {
        const r = await LoveCloud.call('pw_reset_set', { email: loginWho, pass });
        if (r.ok) { _cloudSession(r); loginStep = 'who'; resetApproved = false; renderModal(); return; }
      } catch (er) { }
      err.textContent = x.resetErr;
      return;
    }
    if (tab === 'login') {
      const pass = document.getElementById('accPass').value;
      if (!pass) { err.textContent = x.errLogin; return; }
      const r = await login(loginWho, pass);
      if (!r.ok) { err.textContent = r.error === 'unknown' ? x.errUnknown : x.errPass; return; }
    } else {
      const pass = document.getElementById('accPass').value;
      const name = document.getElementById('accName').value.trim();
      const email = document.getElementById('accEmail').value.trim();
      if (!name || !LoveSite.validEmail(email) || pass.length < 6) { err.textContent = x.errReg; return; }
      const r = await register({ name, email, username: document.getElementById('accUser').value, phone: document.getElementById('accPhone').value, pass });
      if (!r.ok) { err.textContent = r.error === 'email-taken' ? x.errTakenMail : x.errTakenUser; return; }
    }
    renderModal();
  }

  /* Formulare der Seite vorausfüllen (nur leere Felder) */
  function prefillForms() {
    const c = current(); if (!c) return;
    const map = { rName: c.name, rEmail: c.email, rPhone: c.phone, mName: c.name, mEmail: c.email, mPhone: c.phone };
    Object.entries(map).forEach(([id, val]) => {
      const el = document.getElementById(id);
      if (el && !el.value && val) el.value = val;
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initUI);
  else initUI();

  /* Cloud-Token der laufenden Sitzung — für Seiten, die Konto-Endpunkte direkt
     aufrufen (z. B. Geschenkkarte ins Konto laden auf geschenk.html) */
  function token() {
    const s = _session();
    return (s && s.cloud && s.token) ? s.token : '';
  }
  return { register, login, logout, current, listCustomers, myBookings, token };
})();
