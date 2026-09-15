/* LOVE Creative — Online-Shop (Sortiment, Warenkorb, Kasse)
 *
 * WICHTIG — Abgrenzung: Hier geht es um FERTIGE Ware zum Weiterverkauf
 * (bedruckte Tassen, Karten, Schlüsselanhänger, Papeterie). Diese Artikel
 * werden NICHT bemalt. Das Keramik-Bemalen ist ein eigenes Angebot
 * (walkin.html / workshop.html) und hat mit dem Shop nichts zu tun.
 *
 * Bestand: LoveData.listProducts() — derselbe Bestand wie im CRM und in der
 * SumUp-Kasse. Verkauft die Theke ein Stück, sinkt der Online-Bestand mit.
 *
 * Einbindung (nach love-data.js, love-site.js, love-cloud.js, love-pay.js):
 *   <link rel="stylesheet" href="assets/css/love-shop.css">
 *   <script src="assets/js/love-shop-data.js"></script>
 *   <script src="assets/js/love-shop.js"></script>
 */
(() => {
'use strict';
if (typeof LoveData === 'undefined' || !window.LoveSite) return;

const CART_KEY = 'love.cart.v1';
const CATS = window.LOVE_SHOP_CATS || {};
const $ = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));
const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[m]));
const en = () => LoveSite.lang() === 'en';
const chf = n => 'CHF ' + (Math.round(Number(n) * 20) / 20).toFixed(2);

const TX = {
  de: {
    all: 'Alles', search: 'Suchen…', count: n => `${n} Artikel`,
    add: 'In den Warenkorb', out: 'Ausverkauft', low: n => `nur noch ${n}`,
    inStock: 'an Lager', cart: 'Warenkorb', empty: 'Dein Warenkorb ist noch leer.',
    emptyHint: 'Stöber im Sortiment — alles ist bei uns im Studio an Lager.',
    sub: 'Zwischensumme', memberOff: p => `Member-Rabatt ${p} %`, ship: 'Porto', shipNone: '—',
    total: 'Total', pickup: 'Im Studio abholen', pickupD: 'gratis · bereit innert 24 Std.',
    post: 'Per Post', postD: () => `zzgl. ${chf(LoveData.SHOP_SHIPPING)} Porto`,
    toCheckout: 'Zur Kasse', back: '← Weiter stöbern', edit: 'Warenkorb ändern',
    name: 'Name', email: 'E-Mail', phone: 'Telefon (optional)', addr: 'Adresse',
    addrPh: 'Strasse Nr., PLZ Ort', note: 'Bemerkung (optional)',
    memberNo: 'Member-Nummer (optional)', memberPh: 'M-0042',
    pay: 'Bestellung abschliessen', payOffline: 'Bestellung aufgeben',
    okTitle: 'Danke für deine Bestellung!',
    okPickup: c => `Deine Bestellung <b>${c}</b> ist reserviert. Wir melden uns, sobald sie an der Theke bereitliegt — meist noch am selben Tag. <b>Bezahlt wird bei der Abholung</b> (Karte, TWINT oder bar).`,
    okPost: c => `Deine Bestellung <b>${c}</b> ist eingegangen. Wir schicken dir die Zahlungsangaben per E-Mail; sobald der Betrag da ist, geht das Paket in 2–3 Werktagen raus.`,
    okClose: 'Alles klar ♥',
    errName: 'Bitte gib deinen Namen an.', errMail: 'Bitte gib eine gültige E-Mail an.',
    errAddr: 'Für den Versand brauchen wir deine Adresse.',
    errStock: n => `Von diesem Artikel haben wir nur noch ${n} Stück.`,
    errMember: 'Diese Member-Nummer kennen wir nicht — bitte prüfen oder Feld leer lassen.',
    memberOk: (n, p) => `${n} · ${p} % Member-Rabatt aktiv`,
    sku: 'Artikel-Nr.', supplier: 'Marke',
    payHint: 'Zahlung mit TWINT oder Karte im nächsten Schritt.',
    payOfflineHint: 'Bezahlt wird bei der Abholung im Studio.',
    pkt: 'Rabattcode (Punkte-Gutschein aus deinem LOVE-Konto)', pktApply: 'Anwenden',
    pktOk: a => `Rabatt angewendet: −${chf(a)}`, pktBad: 'Code ungültig, nicht freigegeben oder schon eingelöst.',
    pktRow: c => `Punkte-Gutschein ${c}`
  },
  en: {
    all: 'Everything', search: 'Search…', count: n => `${n} items`,
    add: 'Add to basket', out: 'Sold out', low: n => `only ${n} left`,
    inStock: 'in stock', cart: 'Basket', empty: 'Your basket is still empty.',
    emptyHint: 'Have a browse — everything is in stock at the studio.',
    sub: 'Subtotal', memberOff: p => `Member discount ${p}%`, ship: 'Postage', shipNone: '—',
    total: 'Total', pickup: 'Pick up at the studio', pickupD: 'free · ready within 24 hrs',
    post: 'By post', postD: () => `plus ${chf(LoveData.SHOP_SHIPPING)} postage`,
    toCheckout: 'Checkout', back: '← Keep browsing', edit: 'Edit basket',
    name: 'Name', email: 'E-mail', phone: 'Phone (optional)', addr: 'Address',
    addrPh: 'Street no., postcode town', note: 'Note (optional)',
    memberNo: 'Member number (optional)', memberPh: 'M-0042',
    pay: 'Complete order', payOffline: 'Place order',
    okTitle: 'Thank you for your order!',
    okPickup: c => `Your order <b>${c}</b> is reserved. We'll let you know as soon as it's ready at the counter — usually the same day. <b>You pay on pick-up</b> (card, TWINT or cash).`,
    okPost: c => `We've received your order <b>${c}</b>. We'll e-mail you the payment details; once the amount arrives, the parcel goes out within 2–3 working days.`,
    okClose: 'All set ♥',
    errName: 'Please tell us your name.', errMail: 'Please enter a valid e-mail.',
    errAddr: 'We need your address for shipping.',
    errStock: n => `We only have ${n} of this item left.`,
    errMember: "We don't know this member number — please check or leave it empty.",
    memberOk: (n, p) => `${n} · ${p}% member discount active`,
    sku: 'Item no.', supplier: 'Brand',
    payHint: 'Pay by TWINT or card in the next step.',
    payOfflineHint: 'You pay on pick-up at the studio.',
    pkt: 'Discount code (point voucher from your LOVE account)', pktApply: 'Apply',
    pktOk: a => `Discount applied: −${chf(a)}`, pktBad: 'Code invalid, not approved or already redeemed.',
    pktRow: c => `Point voucher ${c}`
  }
};
const t = () => TX[en() ? 'en' : 'de'];

const catLabel = c => (CATS[c] && (en() ? CATS[c].en : CATS[c].de)) || c;
const photo = p => p.img || `assets/img/shop/_${p.cat}.svg`;

/* ═══════════ Warenkorb (überlebt den Seitenwechsel) ═══════════ */
let cart = [];
try { cart = JSON.parse(localStorage.getItem(CART_KEY)) || []; } catch (e) { cart = []; }
const saveCart = () => { try { localStorage.setItem(CART_KEY, JSON.stringify(cart)); } catch (e) {} };
const cartCount = () => cart.reduce((s, l) => s + l.qty, 0);

function cartLines() {
  return cart.map(l => {
    const p = LoveData.getProduct(l.sku);
    return p ? { p, qty: Math.min(l.qty, p.stock || 0) } : null;
  }).filter(l => l && l.qty > 0);
}
function addToCart(sku, qty) {
  const p = LoveData.getProduct(sku); if (!p || !(p.stock > 0)) return false;
  const line = cart.find(l => l.sku === sku);
  const want = (line ? line.qty : 0) + (qty || 1);
  if (want > p.stock) { flash(t().errStock(p.stock)); return false; }
  if (line) line.qty = want; else cart.push({ sku, qty: qty || 1 });
  saveCart(); renderCartBadge(); renderCart(); return true;
}
function setQty(sku, qty) {
  const p = LoveData.getProduct(sku); if (!p) return;
  qty = Math.max(0, Math.min(qty, p.stock || 0));
  const i = cart.findIndex(l => l.sku === sku);
  if (i < 0) return;
  if (!qty) cart.splice(i, 1); else cart[i].qty = qty;
  saveCart(); renderCartBadge(); renderCart();
}

/* ═══════════ Punkte-Rabattcode aus dem Kundenkonto (PKT-…) ═══════════ */
let pkt = null;  // {code, amount} — der Server prüft den Code und zieht den Betrag ab
const pktOff = () => (pkt ? pkt.amount : 0);

/* ═══════════ Member-Rabatt ═══════════ */
let member = null;  // {id, name, discount}
function applyMember(input) {
  const q = String(input || '').trim();
  if (!q) { member = null; return { ok: true }; }
  const m = LoveData.getMember(q);
  if (!m) return { ok: false };
  const b = LoveData.memberBenefits(m);
  member = { id: m.id, name: m.name, discount: b.discount };
  return { ok: true, member };
}

function sums(delivery) {
  const lines = cartLines();
  const sub = lines.reduce((s, l) => s + l.p.price * l.qty, 0);
  /* Rabatt auf 5 Rappen runden — sonst weicht der gespeicherte Betrag von dem ab, was der Gast sieht */
  const disc = member ? Math.round(sub * member.discount / 5) / 20 : 0;
  /* Porto kommt IMMER dazu — es ist in den Artikelpreisen nicht enthalten. */
  const ship = delivery === 'post' ? LoveData.SHOP_SHIPPING : 0;
  return { lines, sub, disc, ship, total: Math.round((sub - disc + ship) * 20) / 20 };
}

/* ═══════════ Sortiment rendern ═══════════ */
let filter = '', query = '';

function renderGrid() {
  const host = $('#shopGrid'); if (!host) return;
  let rows = LoveData.listProducts();
  if (filter) rows = rows.filter(p => p.cat === filter);
  const q = query.trim().toLowerCase();
  if (q) rows = rows.filter(p => p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q) || catLabel(p.cat).toLowerCase().includes(q));
  rows = rows.filter(p => p.visible !== false);
  const cnt = $('#shopCount'); if (cnt) cnt.textContent = t().count(rows.length);

  if (!rows.length) { host.innerHTML = `<div class="shop-empty">${esc(en() ? 'Nothing found — try another category.' : 'Nichts gefunden — probier eine andere Kategorie.')}</div>`; return; }
  host.innerHTML = rows.map(p => {
    const out = !(p.stock > 0);
    const price = member && member.discount
      ? `${chf(p.price * (100 - member.discount) / 100)}<span class="was">${chf(p.price)}</span>`
      : chf(p.price);
    return `<article class="shop-card">
      <div class="shop-photo">
        <img src="${esc(photo(p))}" alt="${esc(p.name)}" loading="lazy" width="400" height="400"
             onerror="this.onerror=null;this.src='assets/img/shop/_${esc(p.cat)}.svg'">
        ${out ? `<span class="shop-flag out">${esc(t().out)}</span>` : (p.low ? `<span class="shop-flag">${esc(t().low(p.stock))}</span>` : '')}
      </div>
      <div class="body">
        <span class="shop-cat">${esc(catLabel(p.cat))}</span>
        <h3>${esc(p.name)}</h3>
        <p class="shop-price">${price}</p>
        <p class="shop-stock ${out ? 'out' : (p.low ? 'low' : '')}">${out ? esc(t().out) : (p.stock + ' ' + esc(t().inStock))}</p>
        <button type="button" class="btn btn-rose btn-sm" data-add="${esc(p.sku)}"${out ? ' disabled' : ''}>${esc(out ? t().out : t().add)}</button>
      </div>
    </article>`;
  }).join('');
  $$('#shopGrid [data-add]').forEach(b => b.addEventListener('click', () => {
    if (addToCart(b.dataset.add, 1)) openCart();
  }));
}

function renderChips() {
  const host = $('#shopChips'); if (!host) return;
  const cats = [['', t().all]].concat(Object.keys(CATS).map(c => [c, catLabel(c)]));
  host.innerHTML = cats.map(([v, l]) =>
    `<button type="button" class="shop-chip" data-cat="${esc(v)}" aria-pressed="${filter === v}">${esc(l)}</button>`).join('');
  $$('#shopChips [data-cat]').forEach(b => b.addEventListener('click', () => { filter = b.dataset.cat; renderChips(); renderGrid(); }));
  const s = $('#shopSearch'); if (s) s.placeholder = t().search;
}

/* ═══════════ Warenkorb-Panel ═══════════ */
function renderCartBadge() {
  const b = $('#cartLauncher'); if (!b) return;
  const n = cartCount();
  b.hidden = !n;
  b.innerHTML = `<span aria-hidden="true">🛍</span> ${esc(t().cart)} <span class="n">${n}</span>`;
}
const openCart = () => {
  $('#cartPanel').classList.add('open'); $('#cartBackdrop').classList.add('open');
  $('#cartPanel').setAttribute('aria-hidden', 'false');
  document.body.classList.add('cart-open');   // blendet Sticky-Leiste und Reservations-Knopf aus
  $('#cartClose').focus();
};
const closeCart = () => {
  $('#cartPanel').classList.remove('open'); $('#cartBackdrop').classList.remove('open');
  $('#cartPanel').setAttribute('aria-hidden', 'true');
  document.body.classList.remove('cart-open');
};

let checkout = false;
/* Eingetippte Angaben überleben ein Neuzeichnen (z. B. Wechsel auf Postversand) —
   sonst steht der Gast plötzlich wieder vor leeren Feldern. */
const CO_FELDER = ['coName', 'coMail', 'coPhone', 'coAddr', 'coMember', 'coPkt', 'coNote'];
let coDraft = {};
const merkeEingaben = () => CO_FELDER.forEach(id => { const e = $('#' + id); if (e) coDraft[id] = e.value; });
const setzeEingaben = () => CO_FELDER.forEach(id => { const e = $('#' + id); if (e && coDraft[id]) e.value = coDraft[id]; });

function renderCart() {
  const body = $('#cartBody'), foot = $('#cartFoot'); if (!body) return;
  merkeEingaben();
  const delivery = ($('input[name="delivery"]:checked') || {}).value || 'abholung';
  const s = sums(delivery);
  $('#cartTitle').textContent = t().cart;

  if (!s.lines.length) {
    body.innerHTML = `<div class="shop-empty"><p><b>${esc(t().empty)}</b></p><p style="margin-top:.4rem">${esc(t().emptyHint)}</p></div>`;
    foot.innerHTML = '';
    checkout = false;
    return;
  }

  /* An der Kasse schrumpfen die Positionen zu einer Zusammenfassung — das lange
     Formular gehört in den scrollbaren Bereich, der Bezahlknopf bleibt unten stehen. */
  const positionen = checkout
    ? `<ul class="cart-sum-list">${s.lines.map(({ p, qty }) => `<li><span>${qty}× ${esc(p.name)}</span><span>${chf(p.price * qty)}</span></li>`).join('')}
         <li class="edit"><button type="button" id="cartEdit">${esc(t().edit)}</button>
             <button type="button" id="coBack">${esc(t().back)}</button></li></ul>`
    : s.lines.map(({ p, qty }) => `
    <div class="cart-line">
      <img src="${esc(photo(p))}" alt="" onerror="this.onerror=null;this.src='assets/img/shop/_${esc(p.cat)}.svg'">
      <div class="t">
        <b>${esc(p.name)}</b>
        <span>${esc(catLabel(p.cat))} · ${chf(p.price)}</span>
        <div class="qty">
          <button type="button" data-minus="${esc(p.sku)}" aria-label="−">−</button>
          <span>${qty}</span>
          <button type="button" data-plus="${esc(p.sku)}" aria-label="+"${qty >= p.stock ? ' disabled' : ''}>+</button>
        </div>
      </div>
      <div class="p">${chf(p.price * qty)}<button type="button" class="rm" data-rm="${esc(p.sku)}">${esc(en() ? 'remove' : 'entfernen')}</button></div>
    </div>`).join('');
  body.innerHTML = positionen;
  $$('#cartBody [data-plus]').forEach(b => b.addEventListener('click', () => addToCart(b.dataset.plus, 1)));
  $$('#cartBody [data-minus]').forEach(b => b.addEventListener('click', () => { const l = cart.find(x => x.sku === b.dataset.minus); setQty(b.dataset.minus, (l ? l.qty : 1) - 1); }));
  $$('#cartBody [data-rm]').forEach(b => b.addEventListener('click', () => setQty(b.dataset.rm, 0)));
  if ($('#cartEdit')) $('#cartEdit').addEventListener('click', () => { checkout = false; renderCart(); });

  if (checkout) { renderCheckout(s, delivery); return; }

  foot.innerHTML = `
    <div class="cart-sums">
      <div><span>${esc(t().sub)}</span><span>${chf(s.sub)}</span></div>
      ${s.disc ? `<div class="save"><span>${esc(t().memberOff(member.discount))}</span><span>−${chf(s.disc)}</span></div>` : ''}
      <div class="tot"><span>${esc(t().total)}</span><span>${chf(s.sub - s.disc)}</span></div>
    </div>
    <button type="button" class="btn btn-rose btn-block" id="toCheckout">${esc(t().toCheckout)}</button>`;
  $('#toCheckout').addEventListener('click', () => { checkout = true; renderCart(); });
}

function renderCheckout(s, delivery) {
  const online = typeof LovePay !== 'undefined' && LovePay.available();
  /* Formular in den scrollbaren Bereich, Summe und Bezahlknopf fest im Fuss —
     so ist der Abschluss immer sichtbar, egal wie lang das Formular wird. */
  $('#cartBody').insertAdjacentHTML('beforeend', `
    <form id="coForm" novalidate>
      <div class="pay-opts" style="margin:.9rem 0 .7rem">
        <label class="choice" style="display:block;cursor:pointer">
          <input type="radio" name="delivery" value="abholung"${delivery === 'abholung' ? ' checked' : ''} style="margin-right:.5rem">
          <span class="t">${esc(t().pickup)}</span> <span class="d">${esc(t().pickupD)}</span>
        </label>
        <label class="choice" style="display:block;cursor:pointer;margin-top:.4rem">
          <input type="radio" name="delivery" value="post"${delivery === 'post' ? ' checked' : ''} style="margin-right:.5rem">
          <span class="t">${esc(t().post)}</span> <span class="d">${esc(t().postD())}</span>
        </label>
      </div>
      <div class="field"><label for="coName">${esc(t().name)}</label><input id="coName" autocomplete="name" required></div>
      <div class="field"><label for="coMail">${esc(t().email)}</label><input id="coMail" type="email" autocomplete="email" required></div>
      <div class="field"><label for="coPhone">${esc(t().phone)}</label><input id="coPhone" type="tel" autocomplete="tel"></div>
      <div class="field" id="coAddrWrap"${delivery === 'post' ? '' : ' hidden'}>
        <label for="coAddr">${esc(t().addr)}</label>
        <textarea id="coAddr" rows="2" placeholder="${esc(t().addrPh)}" autocomplete="street-address"></textarea>
      </div>
      <div class="field"><label for="coMember">${esc(t().memberNo)}</label><input id="coMember" placeholder="${esc(t().memberPh)}" value="${esc(member ? member.id : '')}"></div>
      <p class="hint" id="coMemberMsg" aria-live="polite">${member ? esc(t().memberOk(member.name, member.discount)) : ''}</p>
      <div class="field"><label for="coPkt">${esc(t().pkt)}</label>
        <div style="display:flex;gap:.5rem;align-items:center">
          <input id="coPkt" placeholder="PKT-XXXX-XXXX" style="flex:1;text-transform:uppercase" autocomplete="off" value="${esc(pkt ? pkt.code : '')}">
          <button type="button" class="btn btn-ghost btn-sm" id="coPktApply">${esc(t().pktApply)}</button>
        </div>
        <p class="hint" id="coPktMsg" aria-live="polite">${pkt ? esc(t().pktOk(pkt.amount)) : ''}</p>
      </div>
      <div class="field"><label for="coNote">${esc(t().note)}</label><input id="coNote"></div>
    </form>`);
  /* Der Fuss bleibt bewusst schlank: Summen, Fehlermeldung, ein Knopf. Jede
     weitere Zeile hier nimmt dem Formular Platz — und dann füllt jemand nur
     den Namen aus, weil er die E-Mail gar nicht sieht. */
  $('#cartFoot').innerHTML = `
    <div class="cart-sums">
      <div><span>${esc(t().sub)}</span><span>${chf(s.sub)}</span></div>
      ${s.disc ? `<div class="save"><span>${esc(t().memberOff(member.discount))}</span><span>−${chf(s.disc)}</span></div>` : ''}
      ${pkt ? `<div class="save"><span>${esc(t().pktRow(pkt.code))}</span><span>−${chf(pkt.amount)}</span></div>` : ''}
      <div><span>${esc(t().ship)}</span><span>${s.ship ? chf(s.ship) : esc(t().shipNone)}</span></div>
      <div class="tot"><span>${esc(t().total)}</span><span>${chf(Math.max(1, s.total - pktOff()))}</span></div>
    </div>
    <p class="form-err" id="coErr" aria-live="assertive"></p>
    <button type="submit" form="coForm" class="btn btn-rose btn-block" id="coSubmit">${esc(online ? t().pay : t().payOffline)}</button>
    <p class="hint hint-pay">${esc(online ? t().payHint : t().payOfflineHint)}</p>`;

  /* Eingeloggte Gäste bekommen ihre Angaben vorausgefüllt … */
  if (typeof LoveAccount !== 'undefined' && LoveAccount.current()) {
    const c = LoveAccount.current();
    if (c.name) $('#coName').value = c.name;
    if (c.email) $('#coMail').value = c.email;
    if (c.phone) $('#coPhone').value = c.phone;
  }
  setzeEingaben();   // … selbst Getipptes hat Vorrang
  $$('input[name="delivery"]').forEach(r => r.addEventListener('change', () => {
    $('#coAddrWrap').hidden = r.value !== 'post' || !r.checked;
    renderCart();
  }));
  $('#coMember').addEventListener('change', e => {
    const r = applyMember(e.target.value);
    $('#coMemberMsg').textContent = !r.ok ? t().errMember : (member ? t().memberOk(member.name, member.discount) : '');
    $('#coMemberMsg').style.color = r.ok ? '' : '#a4243b';
    renderGrid(); renderCart();
  });
  /* Punkte-Rabattcode serverseitig prüfen (100 Punkte = CHF 2, siehe Kundenkonto) */
  $('#coPktApply').addEventListener('click', async () => {
    const msg = $('#coPktMsg');
    const code = $('#coPkt').value.trim().toUpperCase();
    pkt = null;
    if (!code) { msg.textContent = ''; renderCart(); return; }
    if (typeof LoveCloud !== 'undefined') {
      try {
        const r = await LoveCloud.call('discount_check&code=' + encodeURIComponent(code));
        if (r.ok) { pkt = { code, amount: Number(r.amount) || 0 }; renderCart(); return; }
      } catch (er) { /* unten Fehlermeldung */ }
    }
    msg.textContent = t().pktBad;
    msg.style.color = '#a4243b';
  });
  $('#coBack').addEventListener('click', () => { checkout = false; renderCart(); });
  $('#coForm').addEventListener('submit', submitOrder);
}

let busy = false;
async function submitOrder(e) {
  e.preventDefault();
  if (busy) return;
  const err = $('#coErr');
  const name = $('#coName').value.trim();
  const email = $('#coMail').value.trim();
  const delivery = ($('input[name="delivery"]:checked') || {}).value || 'abholung';
  const address = $('#coAddr') ? $('#coAddr').value.trim() : '';
  if (!name) { err.textContent = t().errName; $('#coName').focus(); return; }
  if (!LoveSite.validEmail(email)) { err.textContent = t().errMail; $('#coMail').focus(); return; }
  if (delivery === 'post' && address.length < 8) { err.textContent = t().errAddr; $('#coAddr').focus(); return; }
  err.textContent = '';
  busy = true; $('#coSubmit').disabled = true;

  const s = sums(delivery);
  const res = LoveData.addOrder({
    items: s.lines.map(l => ({ sku: l.p.sku, qty: l.qty })),
    name, email, phone: $('#coPhone').value.trim(),
    delivery, address, discount: s.disc,
    member: member ? member.id : '', note: $('#coNote').value.trim(),
    payment: 'online'
  });
  if (!res.ok) { busy = false; $('#coSubmit').disabled = false; err.textContent = 'Fehler'; return; }
  const o = res.order;

  cart = []; coDraft = {}; saveCart(); renderCartBadge(); renderGrid();

  /* Online zahlen, wenn die Cloud erreichbar ist — sonst bleibt die Bestellung reserviert */
  if (typeof LovePay !== 'undefined' && LovePay.available()) {
    /* Der Server zieht den Punkte-Rabatt selbst ab — hier den vollen Betrag mitgeben */
    const r = await LovePay.checkout({
      amount: o.total, code: o.id,
      purpose: 'LOVE Shop ' + o.id + ' · ' + o.items.reduce((n, i) => n + i.qty, 0) + ' Artikel',
      email, discount_code: pkt ? pkt.code : ''
    });
    if (r.ok) return;  // Weiterleitung zu Payrexx läuft
  }
  showDone(o);
  busy = false;
}

function showDone(o) {
  checkout = false;
  pkt = null; /* verwendeter Punkte-Code ist serverseitig eingelöst */
  $('#cartTitle').textContent = t().okTitle;
  $('#cartBody').innerHTML = `<div class="success" style="display:block">
      <h3>${esc(t().okTitle)}</h3>
      <p>${o.delivery === 'post' ? t().okPost(esc(o.id)) : t().okPickup(esc(o.id))}</p>
      <p class="hint" style="margin-top:.7rem">${esc(t().total)}: <b>${chf(o.total)}</b></p>
    </div>`;
  $('#cartFoot').innerHTML = `<button type="button" class="btn btn-rose btn-block" id="doneClose">${esc(t().okClose)}</button>`;
  $('#doneClose').addEventListener('click', closeCart);
}

function flash(msg) {
  let el = $('#shopFlash');
  if (!el) { el = document.createElement('div'); el.id = 'shopFlash'; el.setAttribute('role', 'status');
    el.style.cssText = 'position:fixed;left:50%;bottom:5.2rem;transform:translateX(-50%);background:var(--green);color:#fff;padding:.7rem 1.2rem;border-radius:999px;z-index:95;font-size:.9rem;box-shadow:0 10px 26px rgba(21,84,55,.3)';
    document.body.appendChild(el); }
  el.textContent = msg; el.style.opacity = '1';
  clearTimeout(flash._t); flash._t = setTimeout(() => { el.style.opacity = '0'; }, 2600);
}

/* ═══════════ Start ═══════════ */
function init() {
  if (!$('#shopGrid')) return;
  document.body.insertAdjacentHTML('beforeend', `
    <button class="cart-launcher" id="cartLauncher" type="button" hidden aria-haspopup="dialog"></button>
    <div class="cart-backdrop" id="cartBackdrop"></div>
    <aside class="cart-panel" id="cartPanel" role="dialog" aria-modal="true" aria-labelledby="cartTitle" aria-hidden="true">
      <div class="cart-head"><h2 id="cartTitle">Warenkorb</h2>
        <button class="cart-close" id="cartClose" type="button" aria-label="Schliessen">✕</button></div>
      <div class="cart-body" id="cartBody"></div>
      <div class="cart-foot" id="cartFoot"></div>
    </aside>`);
  $('#cartLauncher').addEventListener('click', openCart);
  $('#cartClose').addEventListener('click', closeCart);
  $('#cartBackdrop').addEventListener('click', closeCart);
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeCart(); });
  const s = $('#shopSearch');
  if (s) s.addEventListener('input', e => { query = e.target.value; renderGrid(); });

  renderChips(); renderGrid(); renderCartBadge(); renderCart();
  document.addEventListener('love:lang', () => { renderChips(); renderGrid(); renderCartBadge(); renderCart(); });

  /* Rückkehr von Payrexx: ?paid=S-0001 */
  const paid = new URLSearchParams(location.search).get('paid');
  if (paid) {
    const o = LoveData.getOrder(paid);
    if (o) {
      LoveData.updateOrder(o.id, { paid: true, status: 'bezahlt' }, 'Online bezahlt (Payrexx)');
      openCart(); showDone(LoveData.getOrder(o.id));
      history.replaceState(null, '', location.pathname);
    }
  }
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
else init();
})();
