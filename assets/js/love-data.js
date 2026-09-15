/* LOVE Creative — Daten-Schicht (CRM-Rückgrat, Blueprint v2)
 *
 * Eine gemeinsame Datenbasis für Website-Formulare, Team-Portal und CRM.
 * Speicherung: localStorage (gleiche Domain = gleiche Daten). Für den
 * Mehrgeräte-Betrieb später per Google-Apps-Script-Web-App synchronisieren
 * (Blueprint Stufe 1) — die Datenstruktur hier entspricht 1:1 den geplanten
 * Google-Sheets-Tabs: Buchungsliste, CRM-Kontakte, Ofen-Status, Gutschein-Ledger,
 * Member, Member-Ledger, SumUp-Transaktionen.
 *
 * Eiserne Regel (wie bei den Agents): Es wird NIE gelöscht, nur Status
 * geändert ('storniert', 'erledigt'). Export/Import als JSON-Backup.
 */
const LoveData = (() => {
  const KEYS = {
    bookings: 'love.bookings.v1',   // Buchungsliste + Sales-Pipeline (inkl. Tischreservationen)
    contacts: 'love.contacts.v1',   // CRM-Kontakte (eine Zeile je E-Mail)
    kiln:     'love.kiln.v1',       // Ofen-Status (Brennliste)
    vouchers: 'love.vouchers.v1',   // Gutschein-Ledger (MWST-relevant!)
    members:  'love.members.v1',    // LOVE Member / Member Pro
    memberTx: 'love.membertx.v1',   // Member-Ledger: Beiträge, Guthaben, Einlösungen, Käufe
    sumup:    'love.sumup.v1',      // Importierte SumUp-Transaktionen (Dedup per transaction_code)
    products: 'love.products.v1',   // Shop-Sortiment: Änderungen gegenüber love-shop-data.js
    stockTx:  'love.stocktx.v1',    // Lager-Bewegungen (Wareneingang, Verkauf, Korrektur, Bruch)
    orders:   'love.orders.v1'      // Shop-Bestellungen (online)
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
  const _today = () => new Date().toISOString().slice(0, 10);

  /* ---------- Buchungen / Anfragen ----------
     type: 'tisch' | 'kino' | 'event' | 'gutschein' | 'geschenk' | 'membership' | 'shop' | 'warteliste' | 'sonstiges'
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
    if (typeof LoveCloud !== 'undefined') LoveCloud.push('booking_add', b); // Cloud zieht nach
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
     kind: 'betrag' | 'keramik-date' | 'kino-duo' | 'kino-family' | 'cafe-keramik'
     paid: erst nach Zahlungseingang true → Gutschein ist «aktiv» */
  function addVoucher(data) {
    const code = 'LOVE-' + Math.random().toString(36).slice(2, 6).toUpperCase() + '-' + Math.random().toString(36).slice(2, 6).toUpperCase();
    const v = {
      code, ts: _now(), amount: Number(data.amount) || 0, balance: Number(data.amount) || 0,
      buyer: data.buyer || '', email: (data.email || '').trim().toLowerCase(),
      recipient: data.recipient || '', from: data.from || '', message: data.message || '',
      kind: data.kind || 'betrag', design: data.design || 'mimi',
      payment: data.payment || '', paid: !!data.paid, paid_at: data.paid ? _now() : null,
      delivery: data.delivery || '', recipient_email: (data.recipient_email || '').trim().toLowerCase(),
      address: data.address || '',
      status: 'offen', redemptions: []
    };
    const all = _read(KEYS.vouchers); all.push(v); _write(KEYS.vouchers, all);
    if (v.email) upsertContact(v.email, { name: v.buyer, tag: 'format:gutschein' });
    if (typeof LoveCloud !== 'undefined') LoveCloud.push('voucher_add', {
      code: v.code, amount: v.amount, tip: Number(data.tip) || 0, buyer: v.buyer, email: v.email,
      recipient: v.recipient, from: v.from, message: v.message, kind: v.kind, design: v.design, payment: v.payment,
      delivery: v.delivery, recipient_email: v.recipient_email, address: v.address
    });
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

  /* ═══════════ MEMBERSHIP (LOVE Member / Member Pro) ═══════════
     Tarife (aus _SHARED-CONTEXT.md):
       member: 10 % Keramik & Café, 10 % Guthaben-Bonus — CHF 25 / Halbjahr · CHF 40 / Jahr
       pro:    20 % Keramik & Café, 20 % Guthaben-Bonus — CHF 80 / Halbjahr · CHF 140 / Jahr
     Status: angemeldet (Website/Theke, unbezahlt) → aktiv (bezahlt, Karte abgeholt) → abgelaufen | gekündigt
     Member-Nummer: M-0001, M-0002 … (steht auf der Karte und wird an der SumUp-Kasse als Beschreibung erfasst) */
  const PLANS = {
    member: { label: 'LOVE Member',     discount: 10, bonus: 10, price: { halbjahr: 25, jahr: 40 } },
    pro:    { label: 'LOVE Member Pro', discount: 20, bonus: 20, price: { halbjahr: 80, jahr: 140 } }
  };
  function _memberNo(all) {
    const max = all.reduce((m, x) => Math.max(m, Number(String(x.id).replace('M-', '')) || 0), 0);
    return 'M-' + String(max + 1).padStart(4, '0');
  }
  function _addMonths(iso, months) {
    const d = new Date(iso + 'T12:00:00'); d.setMonth(d.getMonth() + months);
    return d.toISOString().slice(0, 10);
  }
  function addMember(data) {
    const all = _read(KEYS.members);
    const plan = PLANS[data.plan] ? data.plan : 'member';
    const period = data.period === 'halbjahr' ? 'halbjahr' : 'jahr';
    const m = {
      id: _memberNo(all), ts: _now(), status: 'angemeldet',
      name: data.name || '', email: (data.email || '').trim().toLowerCase(), phone: data.phone || '',
      birthday: data.birthday || '', plan, period, price: PLANS[plan].price[period],
      start: '', end: '', paid_at: null, credit: 0, source: data.source || 'website',
      notes: data.notes || '', history: [{ ts: _now(), event: 'angemeldet (' + (data.source || 'website') + ')' }]
    };
    all.push(m); _write(KEYS.members, all);
    if (m.email) upsertContact(m.email, { name: m.name, phone: m.phone, tag: 'member:' + plan });
    if (typeof LoveCloud !== 'undefined') LoveCloud.push('member_add', {
      id: m.id, name: m.name, email: m.email, phone: m.phone,
      birthday: m.birthday || '', plan: m.plan, period: m.period, source: m.source || 'website'
    });
    return m;
  }
  function updateMember(id, patch, event) {
    const all = _read(KEYS.members);
    const m = all.find(x => x.id === id);
    if (!m) return null;
    Object.assign(m, patch);
    (m.history = m.history || []).push({ ts: _now(), event: event || ('geändert: ' + Object.keys(patch).join(', ')) });
    _write(KEYS.members, all);
    return m;
  }
  /* Zahlung eingegangen → Karte aktiv, Laufzeit startet heute (oder am Ablaufdatum bei Verlängerung) */
  function activateMember(id, opts) {
    const m = getMember(id); if (!m) return null;
    const months = m.period === 'halbjahr' ? 6 : 12;
    const start = (m.status === 'aktiv' && m.end && m.end >= _today()) ? m.end : _today();
    const end = _addMonths(start, months);
    const src = (opts && opts.source) || 'manuell';
    _addMemberTx({ member: m.id, kind: 'beitrag', amount: m.price, source: src, ref: opts && opts.ref, note: PLANS[m.plan].label + ' ' + m.period });
    return updateMember(id, { status: 'aktiv', paid_at: _now(), start: m.start || start, end }, 'aktiviert bis ' + end + ' (' + src + ')');
  }
  function getMember(id) {
    id = String(id || '').trim().toUpperCase();
    if (/^\d+$/.test(id)) id = 'M-' + id.padStart(4, '0');
    return _read(KEYS.members).find(x => x.id === id) || null;
  }
  function findMembers(q) {
    q = String(q || '').trim().toLowerCase();
    if (!q) return [];
    return _read(KEYS.members).filter(m => m.id.toLowerCase().includes(q) || m.name.toLowerCase().includes(q) || m.email.includes(q));
  }
  function listMembers() {
    const today = _today();
    return _read(KEYS.members).map(m => {
      if (m.status === 'aktiv' && m.end && m.end < today) m.status = 'abgelaufen';
      return m;
    }).sort((a, b) => (a.ts < b.ts ? 1 : -1));
  }
  /* Rabatt & Guthaben-Bonus gelten nur für aktive Karten */
  function memberBenefits(m) {
    if (!m) return { active: false, discount: 0, bonus: 0, label: '' };
    const active = m.status === 'aktiv' && m.end >= _today();
    const p = PLANS[m.plan] || PLANS.member;
    return { active, discount: active ? p.discount : 0, bonus: active ? p.bonus : 0, label: p.label, end: m.end };
  }
  function _addMemberTx(t) {
    const tx = { id: _id('T'), ts: _now(), member: t.member, kind: t.kind, amount: Math.round((Number(t.amount) || 0) * 100) / 100,
                 source: t.source || 'manuell', ref: t.ref || '', note: t.note || '' };
    const all = _read(KEYS.memberTx); all.push(tx); _write(KEYS.memberTx, all);
    return tx;
  }
  /* Guthaben aufladen: Einzahlung + automatischer Bonus (10 %/20 %) */
  function topUpMember(id, amount, opts) {
    const m = getMember(id); if (!m) return { ok: false, error: 'not-found' };
    amount = Number(amount) || 0;
    if (amount <= 0) return { ok: false, error: 'amount' };
    const b = memberBenefits(m);
    const bonus = Math.round(amount * b.bonus) / 100;
    _addMemberTx({ member: m.id, kind: 'aufladung', amount, source: opts && opts.source, ref: opts && opts.ref, note: 'Guthaben aufgeladen' });
    if (bonus > 0) _addMemberTx({ member: m.id, kind: 'bonus', amount: bonus, source: 'system', note: b.bonus + ' % Bonus' });
    const credit = Math.round((m.credit + amount + bonus) * 100) / 100;
    updateMember(m.id, { credit }, 'Guthaben +' + amount + (bonus ? ' +' + bonus + ' Bonus' : ''));
    return { ok: true, member: getMember(m.id), bonus };
  }
  /* Guthaben einlösen (Bezahlung an der Theke ohne SumUp-Transaktion) */
  function redeemMemberCredit(id, amount, note) {
    const m = getMember(id); if (!m) return { ok: false, error: 'not-found' };
    amount = Number(amount) || 0;
    if (amount <= 0 || amount > m.credit) return { ok: false, error: 'amount' };
    _addMemberTx({ member: m.id, kind: 'einloesung', amount: -amount, source: 'theke', note: note || '' });
    updateMember(m.id, { credit: Math.round((m.credit - amount) * 100) / 100 }, 'Guthaben −' + amount);
    return { ok: true, member: getMember(m.id) };
  }
  function listMemberTx(id) {
    const all = _read(KEYS.memberTx).sort((a, b) => (a.ts < b.ts ? 1 : -1));
    return id ? all.filter(t => t.member === id) : all;
  }

  /* ═══════════ SUMUP-SYNC (Kassensystem) ═══════════
     Protokoll an der Kasse: Bei jeder Member-Zahlung die Member-Nummer in die
     SumUp-Beschreibung tippen, z. B.
       "M-0042"                → normaler Einkauf mit Member-Rabatt (wird dem Member zugeordnet)
       "MEMBER M-0042"         → Mitgliedsbeitrag bezahlt → Karte wird aktiviert
       "GUTHABEN M-0042"       → Guthaben-Aufladung, Bonus wird automatisch gebucht
     Import: SumUp-Dashboard → Transaktionen → Export (CSV)  oder  tools/sumup-sync.js (API → JSON).
     Jede Transaktion wird nur einmal verarbeitet (transaction_code). */
  function importSumUp(rows) {
    const existing = _read(KEYS.sumup);
    const seen = new Set(existing.map(t => t.code));
    const summary = { total: rows.length, imported: 0, skipped: 0, members: 0, fees: 0, topups: 0, unmatched: 0, stockBooked: 0 };
    rows.forEach(r => {
      const code = String(r.code || r.transaction_code || r.id || '').trim();
      if (!code || seen.has(code)) { summary.skipped++; return; }
      const status = String(r.status || 'SUCCESSFUL').toUpperCase();
      const desc = String(r.desc || r.product_summary || r.description || '').trim();
      const amount = Number(String(r.amount).replace(',', '.')) || 0;
      const t = { code, ts: r.ts || r.timestamp || _now(), amount, status, type: r.type || r.payment_type || '', desc, member: '', kind: '' };
      const mm = desc.match(/M-?\s?(\d{1,5})/i);
      if (mm && status === 'SUCCESSFUL' && amount > 0) {
        const m = getMember('M-' + mm[1].padStart(4, '0'));
        if (m) {
          t.member = m.id;
          if (/GUTHABEN|AUFLAD|CREDIT/i.test(desc)) { topUpMember(m.id, amount, { source: 'sumup', ref: code }); t.kind = 'aufladung'; summary.topups++; }
          else if (/MEMBER|BEITRAG|MITGLIED/i.test(desc)) { activateMember(m.id, { source: 'sumup', ref: code }); t.kind = 'beitrag'; summary.fees++; }
          else { _addMemberTx({ member: m.id, kind: 'kauf', amount, source: 'sumup', ref: code, note: desc }); t.kind = 'kauf'; summary.members++; }
        } else summary.unmatched++;
      }
      /* Shop-Artikel aus der Kasse vom Lager abbuchen (nur erfolgreiche Verkäufe) */
      if (status === 'SUCCESSFUL' && amount > 0) {
        const n = _bookSumUpItems(t, r);
        if (n) { t.stock = n; summary.stockBooked += n; }
      }
      existing.push(t); seen.add(code); summary.imported++;
    });
    _write(KEYS.sumup, existing);
    return summary;
  }
  /* CSV-Export von SumUp einlesen (Spalten werden am Header erkannt, DE/EN) */
  function parseSumUpCSV(text) {
    const lines = String(text).replace(/\r/g, '').split('\n').filter(l => l.trim());
    if (lines.length < 2) return [];
    const sep = (lines[0].match(/;/g) || []).length >= (lines[0].match(/,/g) || []).length ? ';' : ',';
    const split = l => { const out = []; let cur = '', q = false; for (const ch of l) { if (ch === '"') q = !q; else if (ch === sep && !q) { out.push(cur); cur = ''; } else cur += ch; } out.push(cur); return out.map(s => s.trim()); };
    const head = split(lines[0]).map(h => h.toLowerCase());
    const col = (...names) => head.findIndex(h => names.some(n => h.includes(n)));
    const iCode = col('transaktions-id', 'transaction id', 'transaction_code', 'transaktionscode', 'code', 'id');
    const iTs = col('datum', 'date', 'timestamp', 'zeit');
    const iAmt = col('betrag', 'amount', 'total');
    const iStat = col('status');
    const iDesc = col('beschreibung', 'description', 'product', 'produkt', 'notiz', 'note');
    const iType = col('zahlungsart', 'payment type', 'payment_type', 'kartentyp');
    return lines.slice(1).map(split).filter(c => c.length > 1).map(c => ({
      code: iCode >= 0 ? c[iCode] : '', ts: iTs >= 0 ? c[iTs] : '', amount: iAmt >= 0 ? c[iAmt] : 0,
      status: iStat >= 0 ? (/erfolg|success|bezahlt|paid/i.test(c[iStat]) ? 'SUCCESSFUL' : c[iStat]) : 'SUCCESSFUL',
      desc: iDesc >= 0 ? c[iDesc] : '', type: iType >= 0 ? c[iType] : ''
    }));
  }
  function listSumUp() { return _read(KEYS.sumup).sort((a, b) => (a.ts < b.ts ? 1 : -1)); }

  /* ---------- Kennzahlen für Dashboards ---------- */
  /* ═══════════ Shop: Sortiment, Lager, Bestellungen ═══════════
     Das Sortiment kommt aus love-shop-data.js (Auslieferungszustand). Änderungen
     an Preis/Bestand/Foto liegen als «Overlay» im localStorage — so bleibt eine
     Aktualisierung der Stammdaten möglich, ohne den Bestand zu verlieren.
     Der Bestand wird NIE direkt gesetzt, sondern über Bewegungen geführt
     (gleiche eiserne Regel wie sonst: nichts verschwindet, alles ist nachvollziehbar). */

  const SHOP_LOW = 2;   // ab diesem Bestand gilt ein Artikel als «fast weg»
  /* LOVE Creative GmbH ist MWST-pflichtig (UID CHE-444.010.856). Handelsware im Shop
     (Tassen, Karten, Anhänger, Papeterie) läuft zum Normalsatz. Alle VK-Preise sind
     BRUTTO — für Marge und Buchhaltung zählt der Nettoerlös. */
  const SHOP_VAT = 8.1;
  /* Porto für den Postversand, in CHF. Wird IMMER zusätzlich verrechnet — es steckt
     nicht in den Artikelpreisen. Ändert die Post ihre Tarife: nur hier anpassen. */
  const SHOP_SHIPPING = 7;
  const netPrice = brutto => Math.round((Number(brutto) || 0) / (1 + SHOP_VAT / 100) * 100) / 100;

  const _base = () => (typeof window !== 'undefined' && window.LOVE_PRODUCTS) || [];
  const _overlay = () => { try { return JSON.parse(localStorage.getItem(KEYS.products)) || {}; } catch (e) { return {}; } };
  const _writeOverlay = o => localStorage.setItem(KEYS.products, JSON.stringify(o));

  function listProducts(opts) {
    const ov = _overlay();
    let rows = _base().map(p => {
      const o = ov[p.sku] || {};
      return Object.assign({}, p, o, { sku: p.sku, low: (o.stock != null ? o.stock : p.stock) <= SHOP_LOW });
    });
    /* Artikel, die es nur im Overlay gibt (im CRM neu erfasst) */
    const baseSkus = new Set(_base().map(p => p.sku));
    Object.entries(ov).forEach(([sku, o]) => { if (!baseSkus.has(sku) && o.name) rows.push(Object.assign({ sku, cat: 'sonstiges', cost: 0, supplier: '' }, o, { low: (o.stock || 0) <= SHOP_LOW })); });
    if (opts && opts.cat) rows = rows.filter(p => p.cat === opts.cat);
    if (opts && opts.onlyVisible) rows = rows.filter(p => p.visible !== false && (p.stock || 0) > 0);
    return rows.sort((a, b) => a.name.localeCompare(b.name, 'de'));
  }
  /* Artikel über die interne Nummer ODER die öffentliche ID (love-…) finden.
     Online-Bestellungen tragen die öffentliche ID — das CRM löst sie hier auf. */
  function getProduct(sku) {
    const q = String(sku).trim();
    if (!q) return null;
    const alle = listProducts();
    return alle.find(p => p.sku.toUpperCase() === q.toUpperCase())   // interne Nr. oder öffentliche ID direkt
        || (/^love-[0-9a-f]{8}$/i.test(q)                            // öffentliche ID → interne Nr. auflösen
              ? alle.find(p => shopPublicId(p.sku) === q.toLowerCase())
              : null)
        || null;
  }

  /* Artikel per Barcode (GTIN) oder SKU finden — für den Scanner an der Theke */
  function findProduct(term) {
    const q = String(term || '').trim().toUpperCase();
    if (!q) return null;
    const all = listProducts();
    return all.find(p => p.gtin === q) || getProduct(q)
        || all.find(p => p.name.toUpperCase() === q) || null;
  }

  /* Stammdaten ändern (Preis, Sichtbarkeit, Foto, Name …). Bestand NUR über adjustStock. */
  function upsertProduct(sku, patch) {
    const vorhanden = getProduct(sku);
    sku = vorhanden ? vorhanden.sku : String(sku).trim().toUpperCase();
    const ov = _overlay();
    const cur = ov[sku] || {};
    const next = Object.assign({}, cur, patch);
    delete next.low;
    if (patch.stock != null) {          // Bestand kommt über adjustStock — hier als Korrektur verbuchen
      const before = getProduct(sku);
      const diff = Number(patch.stock) - (before ? (before.stock || 0) : 0);
      next.stock = cur.stock;           // bisherigen Overlay-Bestand behalten, adjustStock rechnet weiter
      if (next.stock === undefined) delete next.stock;
      delete next._note;
      ov[sku] = next; _writeOverlay(ov);
      if (diff) adjustStock(sku, diff, 'korrektur', patch._note || 'Bestand im CRM gesetzt');
      return getProduct(sku);
    }
    delete next._note;
    ov[sku] = next; _writeOverlay(ov);
    return getProduct(sku);
  }

  /* Lagerbewegung: delta negativ = Abgang. kind: 'wareneingang'|'verkauf'|'korrektur'|'bruch'|'storno' */
  function adjustStock(sku, delta, kind, note, ref) {
    const p = getProduct(sku); if (!p) return { ok: false, error: 'not-found' };
    sku = p.sku;   // Schreibweise des Artikels übernehmen — intern gross, öffentlich klein
    delta = Number(delta) || 0; if (!delta) return { ok: false, error: 'no-change' };
    const ov = _overlay();
    const cur = ov[sku] || {};
    cur.stock = Math.max(0, (p.stock || 0) + delta);
    ov[sku] = cur; _writeOverlay(ov);
    const tx = _read(KEYS.stockTx);
    tx.unshift({ ts: _now(), sku, name: p.name, delta, stock: cur.stock, kind: kind || 'korrektur', note: note || '', ref: ref || '' });
    _write(KEYS.stockTx, tx);
    return { ok: true, product: getProduct(sku), stock: cur.stock };
  }
  const listStockTx = sku => {
    if (!sku) return _read(KEYS.stockTx);
    const p = getProduct(sku);
    const key = (p ? p.sku : String(sku).trim()).toUpperCase();
    return _read(KEYS.stockTx).filter(t => String(t.sku).toUpperCase() === key);
  };

  /* Nachgetragene Bewegungen aus love-shop-data.js einmalig buchen (siehe Kommentar dort).
     Der Browser-Speicher gilt pro Gerät — so bekommt jedes Gerät denselben Stand. */
  const SEED_KEY = 'love.stockseed.v1';
  function _applyStockSeed() {
    const seed = (typeof window !== 'undefined' && window.LOVE_STOCK_SEED) || null;
    if (!seed || !Array.isArray(seed.moves)) return;
    let done = [];
    try { done = JSON.parse(localStorage.getItem(SEED_KEY)) || []; } catch (e) { done = []; }
    if (done.includes(seed.id)) return;
    const tx = _read(KEYS.stockTx);
    const ov = _overlay();
    seed.moves.forEach(mv => {
      const p = getProduct(mv.sku);
      if (!p) return;                       // unbekannte Nummer still übergehen
      const cur = ov[p.sku] || {};
      cur.stock = Math.max(0, (p.stock || 0) + Number(mv.qty || 0));
      ov[p.sku] = cur; _writeOverlay(ov);
      tx.unshift({ ts: seed.ts || _now(), sku: p.sku, name: p.name, delta: Number(mv.qty) || 0,
                   stock: cur.stock, kind: mv.kind || 'korrektur', note: mv.note || '', ref: seed.id });
    });
    _write(KEYS.stockTx, tx);
    done.push(seed.id);
    localStorage.setItem(SEED_KEY, JSON.stringify(done));
  }

  /* Bestellung aus dem Online-Shop. items: [{sku, qty}] — Preise kommen aus dem Sortiment. */
  function addOrder(data) {
    const items = (data.items || []).map(i => {
      const p = getProduct(i.sku);
      return p ? { sku: p.sku, name: p.name, qty: Number(i.qty) || 1, price: Number(p.price) || 0 } : null;
    }).filter(Boolean);
    if (!items.length) return { ok: false, error: 'empty' };
    const sub = items.reduce((s, i) => s + i.price * i.qty, 0);
    const discount = Number(data.discount) || 0;
    const shipping = data.delivery === 'post' ? SHOP_SHIPPING : 0;
    const o = {
      /* Weltweit eindeutig — die Nummer ist auch die Zahlungs-Referenz bei Payrexx.
         Eine fortlaufende Nummer pro Gerät würde kollidieren, sobald zwei Gäste bestellen. */
      id: 'S-' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 5).toUpperCase(),
      ts: _now(), status: 'neu',
      items, sub: Math.round(sub * 20) / 20, discount, shipping,
      total: Math.round((sub - discount + shipping) * 20) / 20,
      name: data.name || '', email: (data.email || '').trim().toLowerCase(), phone: data.phone || '',
      delivery: data.delivery || 'abholung', address: data.address || '',
      member: data.member || '', note: data.note || '',
      payment: data.payment || 'online', paid: false, paid_at: null,
      history: [{ ts: _now(), event: 'Bestellung eingegangen' }]
    };
    const all = _read(KEYS.orders); all.push(o); _write(KEYS.orders, all);
    /* Bestand sofort reservieren — sonst verkaufen wir online, was an der Theke schon weg ist */
    items.forEach(i => adjustStock(i.sku, -i.qty, 'verkauf', 'Online-Bestellung', o.id));
    if (o.email) upsertContact(o.email, { name: o.name, phone: o.phone, tag: 'format:shop' });

    /* Die Bestellung muss uns erreichen — der Warenkorb liegt sonst nur im Browser
       der Kundin. Zwei Wege gleichzeitig, damit nichts verloren geht:
       1. order_add — der vorgesehene Weg, sobald die Cloud-API ihn kennt
       2. addBooking — der bereits funktionierende Kanal; die Bestellung erscheint
          damit als Buchung vom Typ «shop» im CRM und im Host-Bereich. */
    if (typeof LoveCloud !== 'undefined') LoveCloud.push('order_add', {
      id: o.id, items: o.items, total: o.total, name: o.name, email: o.email,
      delivery: o.delivery, address: o.address, member: o.member, note: o.note
    });
    const liste = o.items.map(i => i.qty + '× ' + i.name).join(' · ');
    const zustellung = o.delivery === 'post' ? 'Versand an ' + o.address : 'Abholung im Studio';
    addBooking({
      type: 'shop', name: o.name, email: o.email, phone: o.phone,
      message: `Shop-Bestellung ${o.id} · ${liste} · ${zustellung} · Total CHF ${o.total.toFixed(2)}`
        + (o.shipping ? ` (inkl. CHF ${o.shipping.toFixed(2)} Porto)` : '')
        + (o.member ? ` · Member ${o.member}` : '')
        + (o.note ? ` · Bemerkung: ${o.note}` : ''),
      lang: (typeof LoveSite !== 'undefined' && LoveSite.lang) ? LoveSite.lang() : 'de'
    });
    return { ok: true, order: o };
  }
  function updateOrder(id, patch, event) {
    const all = _read(KEYS.orders);
    const o = all.find(x => x.id === id); if (!o) return null;
    /* Storno gibt die Ware zurück ins Lager */
    if (patch.status === 'storniert' && o.status !== 'storniert') {
      o.items.forEach(i => adjustStock(i.sku, i.qty, 'storno', 'Bestellung storniert', o.id));
    }
    Object.assign(o, patch);
    if (patch.paid && !o.paid_at) o.paid_at = _now();
    o.history = o.history || [];
    o.history.push({ ts: _now(), event: event || ('Status: ' + (patch.status || 'aktualisiert')) });
    _write(KEYS.orders, all);
    return o;
  }
  const listOrders = () => _read(KEYS.orders).slice().sort((a, b) => b.ts.localeCompare(a.ts));
  const getOrder = id => _read(KEYS.orders).find(o => o.id === String(id).trim().toUpperCase()) || null;

  /* SumUp-Artikelkatalog als CSV — einmal in SumUp hochladen, dann kennt die Kasse
     Namen, Preis und Barcode. (SumUp hat keine öffentliche Artikel-API, darum CSV.) */
  /* Spalten exakt nach der SumUp-Importvorlage (englisch, auch in der Schweizer Version).
     «Display item in Online Store» bleibt «No» — unser Shop läuft auf lovecreative.ch. */
  const SHOP_IMG_HOST = 'https://lovecreative.ch/';

  /* Öffentlicher Dateiname eines Produktfotos.
     Intern heissen die Bilder nach der Artikel-Nr. (<SKU>.jpg) — praktisch bei jeder
     Nachbestellung. Öffentlich wäre das eine Spur zum Lieferanten, darum bekommt die
     Website einen neutralen Namen. Die Ableitung ist fest (gleiche Nummer = gleicher
     Name), damit Website, Kasse und Build ohne Zuordnungsliste zusammenpassen. */
  function shopPublicId(sku) {
    let h = 0x811c9dc5;                       // FNV-1a, 32 Bit
    const s = String(sku).toUpperCase();
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
    return 'love-' + h.toString(16).padStart(8, '0');
  }
  const shopImageName = sku => shopPublicId(sku) + '.jpg';
  /* Öffentliche Bildadresse — externe URLs (im CRM von Hand eingetragen) bleiben unberührt. */
  function shopImageUrl(p) {
    if (!p || !p.img) return '';
    if (/^https?:\/\//i.test(p.img)) return p.img;
    return SHOP_IMG_HOST + 'assets/img/shop/' + shopImageName(p.sku);
  }
  const SUMUP_COLS = [
    'Item name', 'Variations', 'Option set 1', 'Option 1', 'Option set 2', 'Option 2',
    'Option set 3', 'Option 3', 'Option set 4', 'Option 4', 'Is variation visible (Yes/No)',
    'Price', 'On sale in Online Store?', 'Regular price (before sale)', 'Tax rate (%)',
    'Take away price', 'Takeaway tax rate', 'Unit',
    'Track inventory?', 'Quantity', 'Low stock threshold', 'SKU', 'Barcode',
    'Modifiers', 'Description', 'Category', 'Display colour in POS checkout',
    'Image 1', 'Image 2', 'Image 3', 'Image 4', 'Image 5', 'Image 6', 'Image 7',
    'Display item in Online Store? (Yes/No)', 'SEO Title (Online Store only)',
    'SEO Description (Online Store only)', 'Shipping weight [kg] (Online Store only)'
  ];

  function sumupCatalogCSV() {
    const cats = (typeof window !== 'undefined' && window.LOVE_SHOP_CATS) || {};
    const q = v => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"';
    const lines = [SUMUP_COLS.join(',')];
    listProducts().forEach(p => {
      const row = {
        'Item name': p.name,
        'Price': (Number(p.price) || 0).toFixed(2),
        'Tax rate (%)': SHOP_VAT.toFixed(1),
        'Track inventory?': 'Yes',
        'Quantity': p.stock || 0,
        'Low stock threshold': SHOP_LOW,
        'SKU': p.sku,
        'Barcode': p.gtin || '',
        'Description': p.variant || '',
        'Category': (cats[p.cat] && cats[p.cat].de) || p.cat,
        'Image 1': shopImageUrl(p),
        'Display item in Online Store? (Yes/No)': 'No'
      };
      lines.push(SUMUP_COLS.map(c => q(row[c] !== undefined ? row[c] : '')).join(','));
    });
    return lines.join('\r\n');
  }

  /* Verkäufe aus einem SumUp-Export auf das Lager buchen.
     SumUp liefert je Transaktion eine Artikelliste (products[] mit name/quantity)
     bzw. bei kleinen Exporten nur product_summary — beides wird ausgewertet. */
  function _bookSumUpItems(t, rawRow) {
    const list = Array.isArray(rawRow.products) ? rawRow.products : [];
    let booked = 0;
    if (list.length) {
      list.forEach(it => {
        const p = findProduct(it.sku || it.name);
        if (p) { adjustStock(p.sku, -(Number(it.quantity) || 1), 'verkauf', 'SumUp-Kasse', t.code); booked++; }
      });
      return booked;
    }
    /* Fallback: die Beschreibung enthält den Artikelnamen (z. B. «Mrs Mug») */
    const desc = t.desc || '';
    if (!desc) return 0;
    const hit = listProducts().find(p => p.name && desc.toLowerCase().includes(p.name.toLowerCase()));
    if (hit) { adjustStock(hit.sku, -1, 'verkauf', 'SumUp-Kasse', t.code); booked++; }
    return booked;
  }

  try { _applyStockSeed(); } catch (e) { /* Sortiment fehlt (z. B. Seite ohne Shop) — egal */ }

  function stats() {
    const bookings = _read(KEYS.bookings);
    const weekAgo = Date.now() - 7 * 864e5;
    const isWeek = b => new Date(b.ts).getTime() > weekAgo;
    const vouchers = _read(KEYS.vouchers);
    const today = _today();
    const in30 = _addMonths(today, 1);
    const members = listMembers();
    const prods = listProducts();
    const orders = _read(KEYS.orders);
    const stockTx = _read(KEYS.stockTx);
    return {
      bookingsNew: bookings.filter(b => b.status === 'neu').length,
      bookingsWeek: bookings.filter(isWeek).length,
      tablesToday: bookings.filter(b => (b.type === 'tisch' || b.type === 'kino') && b.date === today && !['storniert','verloren'].includes(b.status)).length,
      pipelineOpen: bookings.filter(b => ['offeriert', 'follow-up-1', 'follow-up-2'].includes(b.status)).length,
      contacts: _read(KEYS.contacts).length,
      kilnOpen: _read(KEYS.kiln).filter(k => ['angemeldet', 'im-brand', 'fertig'].includes(k.status)).length,
      kilnReadyUnnotified: _read(KEYS.kiln).filter(k => k.status === 'fertig' && !k.notified_at).length,
      voucherLiability: Math.round(vouchers.filter(v => v.paid).reduce((s, v) => s + (v.balance || 0), 0)),
      vouchersUnpaid: vouchers.filter(v => !v.paid && v.status === 'offen').length,
      membersActive: members.filter(m => m.status === 'aktiv').length,
      membersPending: members.filter(m => m.status === 'angemeldet').length,
      membersExpiring: members.filter(m => m.status === 'aktiv' && m.end && m.end <= in30).length,
      memberCreditLiability: Math.round(members.reduce((s, m) => s + (m.credit || 0), 0)),
      sumupImported: _read(KEYS.sumup).length,
      shopProducts: prods.length,
      shopVisible: prods.filter(p => p.visible !== false && (p.stock || 0) > 0).length,
      shopLow: prods.filter(p => (p.stock || 0) > 0 && p.low).length,
      shopOut: prods.filter(p => !(p.stock || 0)).length,
      shopNoPhoto: prods.filter(p => !p.img).length,
      shopStockValue: Math.round(prods.reduce((s, p) => s + (p.price || 0) * (p.stock || 0), 0)),
      shopStockNet: Math.round(prods.reduce((s, p) => s + netPrice(p.price) * (p.stock || 0), 0)),
      shopStockCost: Math.round(prods.reduce((s, p) => s + (p.cost || 0) * (p.stock || 0), 0)),
      shopGifts: stockTx.filter(t => t.kind === 'geschenk').reduce((s, t) => s - t.delta, 0),
      shopGiftsValue: Math.round(stockTx.filter(t => t.kind === 'geschenk').reduce((s, t) => {
        const p = getProduct(t.sku); return s + (p ? p.price : 0) * -t.delta;
      }, 0)),
      shopSoldCounter: stockTx.filter(t => t.kind === 'verkauf' && !t.ref.startsWith('S-')).reduce((s, t) => s - t.delta, 0),
      shopOrdersNew: orders.filter(o => o.status === 'neu').length,
      shopOrdersOpen: orders.filter(o => !['abgeholt', 'versandt', 'storniert'].includes(o.status)).length,
      shopRevenueWeek: Math.round(orders.filter(o => o.paid && isWeek(o)).reduce((s, o) => s + o.total, 0))
    };
  }

  /* ---------- Backup / Export ---------- */
  function exportJSON() {
    const dump = {};
    Object.entries(KEYS).forEach(([name, key]) => { dump[name] = _read(key); });
    dump.products = _overlay();   // Sortiment-Overlay ist ein Objekt, keine Liste
    dump._exported = _now();
    return JSON.stringify(dump, null, 2);
  }
  function importJSON(json) {
    const dump = typeof json === 'string' ? JSON.parse(json) : json;
    let count = 0;
    Object.entries(KEYS).forEach(([name, key]) => {
      if (Array.isArray(dump[name])) { _write(key, dump[name]); count += dump[name].length; }
    });
    if (dump.products && !Array.isArray(dump.products)) {
      _writeOverlay(dump.products); count += Object.keys(dump.products).length;
    }
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
    PLANS, addMember, updateMember, activateMember, getMember, findMembers, listMembers, memberBenefits,
    topUpMember, redeemMemberCredit, listMemberTx,
    importSumUp, parseSumUpCSV, listSumUp,
    listProducts, getProduct, findProduct, upsertProduct, adjustStock, listStockTx,
    addOrder, updateOrder, listOrders, getOrder, sumupCatalogCSV, SHOP_LOW, SHOP_VAT, SHOP_SHIPPING, netPrice,
    shopImageName, shopImageUrl, shopPublicId,
    stats, exportJSON, importJSON, toCSV, KEYS
  };
})();
