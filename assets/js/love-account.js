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
      user: 'Benutzername', since: 'Konto seit', logoutBtn: 'Abmelden', close: 'Schliessen',
      stat: { neu: 'eingegangen', 'bestätigt': 'bestätigt', gewonnen: 'bestätigt', offeriert: 'Offerte', storniert: 'storniert', verloren: 'storniert' }
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
      user: 'Username', since: 'Member since', logoutBtn: 'Sign out', close: 'Close',
      stat: { neu: 'received', 'bestätigt': 'confirmed', gewonnen: 'confirmed', offeriert: 'offer sent', storniert: 'cancelled', verloren: 'cancelled' }
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
    navIn.insertBefore(btn, navIn.querySelector('.lang-switch'));

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
  }
  const isOpen = () => document.getElementById('accModal').classList.contains('open');
  function openModal() { renderModal(); document.getElementById('accModal').classList.add('open'); document.getElementById('accBackdrop').classList.add('open'); }
  function closeModal() { document.getElementById('accModal').classList.remove('open'); document.getElementById('accBackdrop').classList.remove('open'); }

  function renderBtn() {
    const x = tx(); const c = current();
    const b = document.getElementById('accBtn');
    if (b) b.innerHTML = `<span aria-hidden="true">♥</span> ${c ? esc(x.hello(c.name || c.email)) : x.account}`;
  }

  function renderModal() {
    const x = tx(); const c = current();
    document.getElementById('accTitle').textContent = x.title;
    const body = document.getElementById('accBody');
    if (c) {
      const fmt = iso => new Date(iso).toLocaleDateString(LoveSite.lang() === 'en' ? 'en-GB' : 'de-CH', { day: 'numeric', month: 'long', year: 'numeric' });
      const bookingsHtml = list => list.length ? list.slice(0, 8).map(b => `
          <div class="acc-card acc-booking">
            <span><b>${esc(b.type === 'kino' ? 'Kino-Night' : b.type === 'tisch' ? (LoveSite.lang() === 'en' ? 'Table' : 'Tisch') : b.type)}</b>
            ${b.date ? ' · ' + String(b.date).split('-').reverse().join('.') : ''}${b.time ? ' · ' + b.time : ''}${b.persons ? ' · ' + b.persons + ' P.' : ''}</span>
            <span class="acc-status">${x.stat[b.status] || esc(b.status)}</span>
          </div>`).join('') : `<p class="acc-dim">${x.noBookings}</p>`;
      body.innerHTML = `
        <p class="acc-sub">${x.myData}</p>
        <div class="acc-card">
          <p><b>${esc(c.name)}</b></p>
          <p>${esc(c.email)}</p>
          ${c.username ? `<p>${x.user}: ${esc(c.username)}</p>` : ''}
          <p class="acc-dim">${x.since} ${fmt(c.created)}</p>
        </div>
        <p class="acc-sub">${x.myBookings}</p>
        <div id="accBookings">${bookingsHtml(myBookings())}</div>
        <button type="button" class="btn btn-ghost btn-block" id="accLogout" style="margin-top:1rem">${x.logoutBtn}</button>`;
      document.getElementById('accLogout').addEventListener('click', () => { logout(); renderModal(); });
      /* Cloud-Konto: Buchungen zentral vom Server laden (alle Geräte) */
      const s = _session();
      if (s && s.cloud && s.token && typeof LoveCloud !== 'undefined') {
        LoveCloud.call('my_bookings', undefined, s.token).then(r => {
          const box = document.getElementById('accBookings');
          if (r.ok && box) box.innerHTML = bookingsHtml(r.bookings);
        }).catch(() => {});
      }
    } else {
      body.innerHTML = `
        <div class="acc-tabs" role="tablist">
          <button type="button" class="acc-tab" data-tab="login" aria-pressed="${tab === 'login'}">${x.tabLogin}</button>
          <button type="button" class="acc-tab" data-tab="reg" aria-pressed="${tab === 'reg'}">${x.tabReg}</button>
        </div>
        <form id="accForm" novalidate>
        ${tab === 'login' ? `
          <input type="text" id="accWho" placeholder="${x.who}" autocomplete="username">
          <input type="password" id="accPass" placeholder="${x.pass}" autocomplete="current-password">
          <p class="acc-err" id="accErr" aria-live="polite"></p>
          <button type="submit" class="btn btn-rose btn-block">${x.loginBtn}</button>`
        : `
          <input type="text" id="accName" placeholder="${x.name}" autocomplete="name">
          <input type="email" id="accEmail" placeholder="${x.email}" autocomplete="email">
          <input type="text" id="accUser" placeholder="${x.username}" autocomplete="username">
          <input type="tel" id="accPhone" placeholder="${x.phone}" autocomplete="tel">
          <input type="password" id="accPass" placeholder="${x.pass2}" autocomplete="new-password">
          <p class="acc-err" id="accErr" aria-live="polite"></p>
          <button type="submit" class="btn btn-rose btn-block">${x.regBtn}</button>
          <p class="acc-dim" style="margin-top:.7rem">${x.regHint}</p>`}
        </form>`;
      body.querySelectorAll('.acc-tab').forEach(b => b.addEventListener('click', () => { tab = b.dataset.tab; renderModal(); }));
      document.getElementById('accForm').addEventListener('submit', onSubmit);
    }
  }

  async function onSubmit(e) {
    e.preventDefault();
    const x = tx(); const err = document.getElementById('accErr');
    const pass = document.getElementById('accPass').value;
    if (tab === 'login') {
      const who = document.getElementById('accWho').value;
      if (!who.trim() || !pass) { err.textContent = x.errLogin; return; }
      const r = await login(who, pass);
      if (!r.ok) { err.textContent = r.error === 'unknown' ? x.errUnknown : x.errPass; return; }
    } else {
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

  return { register, login, logout, current, listCustomers, myBookings };
})();
