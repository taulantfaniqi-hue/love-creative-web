/* LOVE Creative — Daten-Schicht (CRM-Rückgrat, Blueprint v2)
 *
 * Eine gemeinsame Datenbasis für Website-Formulare, Team-Portal und CRM.
 * Speicherung: localStorage (gleiche Domain = gleiche Daten). Für den
 * Mehrgeräte-Betrieb später per Google-Apps-Script-Web-App synchronisieren
 * (Blueprint Stufe 1) — die Datenstruktur hier entspricht 1:1 den geplanten
 * Google-Sheets-Tabs: Buchungsliste, CRM-Kontakte, Ofen-Status, Gutschein-Ledger.
 *
 * Eiserne Regel (wie bei den Agents): Es wird NIE gelöscht, nur Status
 * geändert ('storniert', 'erledigt'). Export/Import als JSON-Backup.
 */
const LoveData = (() => {
  const KEYS = {
    bookings: 'love.bookings.v1',   // Buchungsliste + Sales-Pipeline (inkl. Tischreservationen)
    contacts: 'love.contacts.v1',   // CRM-Kontakte (eine Zeile je E-Mail)
    kiln:     'love.kiln.v1',       // Ofen-Status (Brennliste)
    vouchers: 'love.vouchers.v1'    // Gutschein-Ledger (MWST-relevant!)
  };

  function _read(key) {
    try { return JSON.parse(localStorage.getItem(key)) || []; }
    catch (e) { return []; }
  }
  function _write(key, arr) { localStorage.setItem(key, JSON.stringify(arr)); }
  function _id(prefix) {
    return prefix + '-' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 5).toUpperCase();
  }
  const _now = () => new Date().toISOString();

  /* ---------- Buchungen / Anfragen ----------
     type: 'tisch' | 'kino' | 'event' | 'gutschein' | 'geschenk' | 'membership' | 'warteliste' | 'sonstiges'
     status-Pipeline (love-sales-events): neu → bestätigt | offeriert → follow-up-1 → follow-up-2 → gewonnen | verloren | storniert
     Tisch-Felder: date (ISO), time (Slot '09:00–12:00'), persons, area ('EG'|'OG'|'egal'),
                   table_type ('rund'|'gross'|'event'), table (zugewiesen im CRM, z. B. 'EG-G1') */
  function addBooking(data) {
    const b = {
      id: _id('B'), ts: _now(), status: 'neu',
      type: data.type || 'sonstiges',
      name: data.name || '', email: (data.email || '').trim().toLowerCase(),
      phone: data.phone || '', date: data.date || '', time: data.time || '',
      persons: data.persons || '', world: data.world || '',
      area: data.area || '', table_type: data.table_type || '', table: data.table || '',
      plan: data.plan || '',
      message: data.message || '', price: data.price || '', lang: data.lang || 'de',
      history: [{ ts: _now(), event: 'erstellt' }]
    };
    const all = _read(KEYS.bookings); all.push(b); _write(KEYS.bookings, all);
    if (b.email) upsertContact(b.email, { name: b.name, phone: b.phone, tag: 'format:' + b.type });
    return b;
  }
  function updateBooking(id, patch) {
    const all = _read(KEYS.bookings);
    const b = all.find(x => x.id === id);
    if (!b) return null;
    Object.assign(b, patch);
    (b.history = b.history || []).push({ ts: _now(), event: 'geändert: ' + Object.keys(patch).join(', ') });
    _write(KEYS.bookings, all);
    return b;
  }
  function listBookings(filter) {
    let all = _read(KEYS.bookings);
    if (filter && filter.type) all = all.filter(b => b.type === filter.type);
    if (filter && filter.status) all = all.filter(b => b.status === filter.status);
    return all.sort((a, b2) => (a.ts < b2.ts ? 1 : -1));
  }

  /* ---------- CRM-Kontakte (eine Zeile je E-Mail, Dedup) ---------- */
  function upsertContact(email, data) {
    email = String(email || '').trim().toLowerCase();
    if (!email) return null;
    const all = _read(KEYS.contacts);
    let c = all.find(x => x.email === email);
    if (!c) {
      c = { email, name: '', phone: '', tags: [], optin: false, firstSeen: _now(), lastSeen: _now(), notes: '' };
      all.push(c);
    }
    if (data) {
      if (data.name && !c.name) c.name = data.name;
      if (data.phone && !c.phone) c.phone = data.phone;
      if (data.tag && !c.tags.includes(data.tag)) c.tags.push(data.tag);
      if (typeof data.optin === 'boolean') c.optin = data.optin;
      if (data.notes !== undefined) c.notes = data.notes;
    }
    c.lastSeen = _now();
    _write(KEYS.contacts, all);
    return c;
  }
  function listContacts() {
    return _read(KEYS.contacts).sort((a, b) => (a.lastSeen < b.lastSeen ? 1 : -1));
  }

  /* ---------- Ofen-Status (Brennliste) ----------
     status: 'angemeldet' → 'im-brand' → 'fertig' (→ notified_at gesetzt) → 'abgeholt' */
  function addKiln(data) {
    const k = {
      id: _id('K'), ts: _now(), status: 'angemeldet',
      charge: data.charge || '', items: data.items || 1,
      owner: data.owner || '', email: (data.email || '').trim().toLowerCase(),
      piece: data.piece || '', ready: data.ready || '', notified_at: null, picked_at: null
    };
    const all = _read(KEYS.kiln); all.push(k); _write(KEYS.kiln, all);
    return k;
  }
  function updateKiln(id, patch) {
    const all = _read(KEYS.kiln);
    const k = all.find(x => x.id === id);
    if (!k) return null;
    Object.assign(k, patch);
    _write(KEYS.kiln, all);
    return k;
  }
  function listKiln() { return _read(KEYS.kiln).sort((a, b) => (a.ts < b.ts ? 1 : -1)); }

  /* ---------- Gutschein-Ledger ----------
     MWST: Verkauf steuerfrei, Steuer entsteht erst bei Einlösung (love-buchhaltung).
     Deshalb zwingend: jeder Verkauf + jede Einlösung als Ledger-Eintrag.
     kind: 'betrag' | 'keramik-date' | 'kino-duo' | 'cafe-keramik' …  (Erlebnis-Gutscheine)
     paid: erst nach Zahlungseingang true → Gutschein ist «aktiv» */
  function addVoucher(data) {
    const code = 'LOVE-' + Math.random().toString(36).slice(2, 6).toUpperCase() + '-' + Math.random().toString(36).slice(2, 6).toUpperCase();
    const v = {
      code, ts: _now(), amount: Number(data.amount) || 0, balance: Number(data.amount) || 0,
      buyer: data.buyer || '', email: (data.email || '').trim().toLowerCase(),
      recipient: data.recipient || '', from: data.from || '', message: data.message || '',
      kind: data.kind || 'betrag', design: data.design || 'mimi',
      payment: data.payment || '', paid: !!data.paid, paid_at: data.paid ? _now() : null,
      status: 'offen', redemptions: []
    };
    const all = _read(KEYS.vouchers); all.push(v); _write(KEYS.vouchers, all);
    if (v.email) upsertContact(v.email, { name: v.buyer, tag: 'format:gutschein' });
    return v;
  }
  function updateVoucher(code, patch) {
    const all = _read(KEYS.vouchers);
    const v = all.find(x => x.code === String(code).trim().toUpperCase());
    if (!v) return null;
    Object.assign(v, patch);
    if (patch.paid && !v.paid_at) v.paid_at = _now();
    _write(KEYS.vouchers, all);
    return v;
  }
  function redeemVoucher(code, amount) {
    const all = _read(KEYS.vouchers);
    const v = all.find(x => x.code === String(code).trim().toUpperCase());
    if (!v) return { ok: false, error: 'not-found' };
    amount = Number(amount) || 0;
    if (amount <= 0 || amount > v.balance) return { ok: false, error: 'amount' };
    v.balance = Math.round((v.balance - amount) * 100) / 100;
    v.redemptions.push({ ts: _now(), amount });
    if (v.balance <= 0) v.status = 'eingelöst';
    _write(KEYS.vouchers, all);
    return { ok: true, voucher: v };
  }
  function listVouchers() { return _read(KEYS.vouchers).sort((a, b) => (a.ts < b.ts ? 1 : -1)); }

  /* ---------- Kennzahlen für Dashboards ---------- */
  function stats() {
    const bookings = _read(KEYS.bookings);
    const weekAgo = Date.now() - 7 * 864e5;
    const isWeek = b => new Date(b.ts).getTime() > weekAgo;
    const vouchers = _read(KEYS.vouchers);
    const today = new Date().toISOString().slice(0, 10);
    return {
      bookingsNew: bookings.filter(b => b.status === 'neu').length,
      bookingsWeek: bookings.filter(isWeek).length,
      tablesToday: bookings.filter(b => (b.type === 'tisch' || b.type === 'kino') && b.date === today && !['storniert','verloren'].includes(b.status)).length,
      pipelineOpen: bookings.filter(b => ['offeriert', 'follow-up-1', 'follow-up-2'].includes(b.status)).length,
      contacts: _read(KEYS.contacts).length,
      kilnOpen: _read(KEYS.kiln).filter(k => ['angemeldet', 'im-brand', 'fertig'].includes(k.status)).length,
      kilnReadyUnnotified: _read(KEYS.kiln).filter(k => k.status === 'fertig' && !k.notified_at).length,
      voucherLiability: Math.round(vouchers.filter(v => v.paid).reduce((s, v) => s + (v.balance || 0), 0)),
      vouchersUnpaid: vouchers.filter(v => !v.paid && v.status === 'offen').length
    };
  }

  /* ---------- Backup / Export ---------- */
  function exportJSON() {
    const dump = {};
    Object.entries(KEYS).forEach(([name, key]) => { dump[name] = _read(key); });
    dump._exported = _now();
    return JSON.stringify(dump, null, 2);
  }
  function importJSON(json) {
    const dump = typeof json === 'string' ? JSON.parse(json) : json;
    let count = 0;
    Object.entries(KEYS).forEach(([name, key]) => {
      if (Array.isArray(dump[name])) { _write(key, dump[name]); count += dump[name].length; }
    });
    return count;
  }
  function toCSV(rows) {
    if (!rows || !rows.length) return '';
    const cols = Object.keys(rows[0]).filter(k => typeof rows[0][k] !== 'object');
    const esc = v => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"';
    return [cols.join(';')].concat(rows.map(r => cols.map(c => esc(r[c])).join(';'))).join('\r\n');
  }

  return {
    addBooking, updateBooking, listBookings,
    upsertContact, listContacts,
    addKiln, updateKiln, listKiln,
    addVoucher, updateVoucher, redeemVoucher, listVouchers,
    stats, exportJSON, importJSON, toCSV, KEYS
  };
})();
