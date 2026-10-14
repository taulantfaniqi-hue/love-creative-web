/* LOVE Creative — Geschenkkarte auf der Design-Vorlage rendern
 *
 * Nimmt die Karten-Vorlage (assets/img/giftcard.webp) und legt den
 * CODE128-Strichcode mit der Gutschein-Nummer auf das weisse Feld.
 * Braucht JsBarcode (Barcode) und jsPDF (PDF-Download) — beide per CDN.
 *
 * Verwendung:
 *   LoveGiftcard.render({code, amount})        → Promise<canvas>
 *   LoveGiftcard.mount(el, v)                  → Karte als <img> in ein Element
 *   LoveGiftcard.download(v)                   → PDF-Download im Browser
 *   LoveGiftcard.pdfBase64(v)                  → Promise<base64> (für den Mail-Versand)
 *   LoveGiftcard.renderA4(v)                   → Promise<canvas> A4-Geschenkgutschein
 *   v = { code, amount, title, recipient, from, message, design, issued, lang } — PDF ist A4
 */
const LoveGiftcard = (() => {
  'use strict';

  const SRC = 'assets/img/giftcard.webp';
  /* Weisses Feld der Vorlage (relativ zur Bildgrösse) — wird zur Sicherheit
     beim Laden per Pixel-Analyse nachgemessen; das hier ist der Fallback. */
  const FIELD_REL = { x: 0.289, y: 0.756, w: 0.418, h: 0.213 };

  let _img = null;
  function loadImg() {
    return new Promise((res, rej) => {
      if (_img) return res(_img);
      const im = new Image();
      im.onload = () => { _img = im; res(im); };
      im.onerror = () => rej(new Error('giftcard-template'));
      im.src = SRC;
    });
  }

  /* Das weisse Feld in der unteren Bildhälfte finden: lange, helle Pixel-Reihen.
     Rottöne/Schleifen/Hände fallen durch die Schwellwerte, der weisse Kasten bleibt. */
  function detectField(ctx, W, H) {
    try {
      const y0 = Math.floor(H * 0.5);
      const data = ctx.getImageData(0, y0, W, H - y0).data;
      const bright = i => {
        const r = data[i], g = data[i + 1], b = data[i + 2];
        return r > 228 && g > 214 && b > 204 && Math.abs(r - g) < 36 && Math.abs(g - b) < 36;
      };
      let top = -1, bottom = -1, left = W, right = 0;
      for (let y = 0; y < H - y0; y += 2) {
        let run = 0, best = 0, bs = 0, bestStart = 0;
        for (let x = 0; x < W; x++) {
          if (bright((y * W + x) * 4)) { if (!run) bs = x; run++; if (run > best) { best = run; bestStart = bs; } }
          else run = 0;
        }
        if (best >= W * 0.3) {
          if (top < 0) top = y;
          bottom = y;
          left = Math.min(left, bestStart);
          right = Math.max(right, bestStart + best);
        }
      }
      if (top >= 0) {
        const f = { x: left, y: y0 + top, w: right - left, h: bottom - top };
        /* Plausibel? (Feld ist ca. 40 % breit und 15–30 % hoch) */
        if (f.w > W * 0.28 && f.w < W * 0.62 && f.h > H * 0.1 && f.h < H * 0.32) return f;
      }
    } catch (e) { /* z. B. getImageData blockiert → Fallback */ }
    return { x: FIELD_REL.x * W, y: FIELD_REL.y * H, w: FIELD_REL.w * W, h: FIELD_REL.h * H };
  }

  /* Karte zeichnen: Vorlage + Barcode + Nummer (+ Betrag) auf dem weissen Feld */
  async function render(v) {
    const img = await loadImg();
    const W = Math.max(1200, img.naturalWidth), H = Math.round(W * img.naturalHeight / img.naturalWidth);
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const ctx = c.getContext('2d');
    ctx.drawImage(img, 0, 0, W, H);
    const f = detectField(ctx, W, H);
    const cx = f.x + f.w / 2;
    const pad = f.h * 0.1;
    let y = f.y + pad;
    /* Betrag (klein, über dem Barcode) */
    const amount = Number(v.amount) || 0;
    if (amount > 0) {
      ctx.fillStyle = '#2C3A31';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.font = '700 ' + Math.round(f.h * 0.155) + "px 'Jost','Segoe UI',sans-serif";
      ctx.fillText('CHF ' + (Math.round(amount * 100) % 100 ? amount.toFixed(2) : String(Math.round(amount))), cx, y);
      y += f.h * 0.2;
    }
    /* Barcode (CODE128) — auf transparentem Grund, damit das Feld der Vorlage durchscheint */
    const code = String(v.code || 'LOVE-0000-0000');
    const bc = document.createElement('canvas');
    let hasBar = false;
    if (typeof JsBarcode !== 'undefined') {
      try {
        JsBarcode(bc, code, { format: 'CODE128', displayValue: false, height: 120, width: 3, margin: 0, lineColor: '#2C3A31', background: 'rgba(0,0,0,0)' });
        hasBar = bc.width > 0;
      } catch (e) { /* ohne Barcode weiter — Nummer bleibt lesbar */ }
    }
    const textH = f.h * 0.17;
    const barH = Math.max(10, f.y + f.h - pad - textH - (f.h * 0.06) - y);
    if (hasBar) {
      const barW = Math.min(f.w * 0.82, bc.width * (barH / bc.height) * 2.2);
      ctx.drawImage(bc, cx - barW / 2, y, barW, barH);
    }
    y += barH + f.h * 0.05;
    /* Nummer unter dem Strichcode */
    ctx.fillStyle = '#2C3A31';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.font = '600 ' + Math.round(textH) + "px 'Jost','Segoe UI',sans-serif";
    try { ctx.letterSpacing = Math.round(textH * 0.18) + 'px'; } catch (e) { /* ältere Browser */ }
    ctx.fillText(code, cx, y);
    try { ctx.letterSpacing = '0px'; } catch (e) { /* egal */ }
    return c;
  }


  /* ═══════════ A4-Geschenkgutschein (seit 14.10.2026) ═══════════
     Taulant: «Geschenkgutschein» muss draufstehen, als A4 ausdruckbar, Motiv wählbar
     (weniger ist mehr, Markenfarben), Felder «Für», «Von» und ein eigener Text.
     Gezeichnet auf einer Leinwand in 150 dpi (1240 × 1754 px) und als Bild ins PDF gelegt —
     so stimmen Schriften (Playfair Display, Lexend) und Farben genau mit der Website überein. */
  const A4 = { W: 1240, H: 1754 };
  const MOTIVE = {
    mimi:    { bg: '#FFDBE5', panel: '#FFFFFF', ink: '#2C3A31', head: '#337357', accent: '#E27396', line: '#EA9AB2' },
    celadon: { bg: '#FFF0F4', panel: '#FFFFFF', ink: '#2C3A31', head: '#337357', accent: '#337357', line: '#C9DCCF' },
    green:   { bg: '#337357', panel: '#FBF7F1', ink: '#2C3A31', head: '#337357', accent: '#E27396', line: '#6D9F71' },
    karte:   { bg: '#FFF0F4', panel: '#FFFFFF', ink: '#2C3A31', head: '#337357', accent: '#E27396', line: '#EA9AB2', bild: true }
  };
  const TXT = {
    de: { kicker: 'GESCHENKGUTSCHEIN', fuer: 'für', von: 'von', wert: 'Wert', gueltig: 'Gültig bis',
          einloesen: 'Einlösbar im LOVE Creative Café, Seestrasse 287B, 8804 Au ZH — oder mit dem Code online auf lovecreative.ch',
          bed: 'Keine Barauszahlung · kein Storno · Restguthaben bleibt bis zum Ablaufdatum gültig', fallback: 'Wertgutschein' },
    en: { kicker: 'GIFT VOUCHER', fuer: 'for', von: 'from', wert: 'Value', gueltig: 'Valid until',
          einloesen: 'Redeemable at LOVE Creative Café, Seestrasse 287B, 8804 Au ZH — or online with the code at lovecreative.ch',
          bed: 'No cash payout · no cancellation · remaining balance stays valid until expiry', fallback: 'Gift voucher' }
  };
  let _logo = null;
  function loadLogo() {
    return new Promise(res => {
      if (_logo) return res(_logo);
      const im = new Image();
      im.onload = () => { _logo = im; res(im); };
      im.onerror = () => res(null);
      im.src = 'assets/logo/logo-love.svg';
    });
  }
  async function schriften() {
    if (!document.fonts || !document.fonts.load) return;
    try {
      await Promise.all(['600 40px Lexend', '400 34px Lexend', '700 64px "Playfair Display"', 'italic 600 76px "Playfair Display"']
        .map(f => document.fonts.load(f)));
    } catch (e) { /* Ersatzschrift */ }
  }
  function rund(ctx, x, y, w, h, r) {
    ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }
  /* Zeilen umbrechen (max. Breite), höchstens maxZ Zeilen */
  function umbrechen(ctx, text, breite, maxZ) {
    const zeilen = [];
    String(text || '').split(/\n+/).forEach(absatz => {
      let z = '';
      absatz.split(/\s+/).filter(Boolean).forEach(w => {
        const t = z ? z + ' ' + w : w;
        if (ctx.measureText(t).width > breite && z) { zeilen.push(z); z = w; } else z = t;
      });
      if (z) zeilen.push(z);
    });
    if (zeilen.length > maxZ) { zeilen.length = maxZ; zeilen[maxZ - 1] = zeilen[maxZ - 1].replace(/\s*\S*$/, '') + ' …'; }
    return zeilen;
  }
  const chfText = a => 'CHF ' + (Math.round(a * 100) % 100 ? Number(a).toFixed(2) : String(Math.round(a)));
  function gueltigBis(issued, lang) {
    const d = issued ? new Date(issued) : new Date();
    const b = isNaN(d) ? new Date() : d;
    b.setFullYear(b.getFullYear() + 2);
    return b.toLocaleDateString(lang === 'en' ? 'en-GB' : 'de-CH', { day: 'numeric', month: 'long', year: 'numeric' });
  }

  /* v = { code, amount, title, recipient, from, message, design, issued, lang } */
  async function renderA4(v) {
    await schriften();
    const lang = v.lang === 'en' ? 'en' : 'de', T = TXT[lang];
    const m = MOTIVE[v.design] || MOTIVE.mimi;
    const c = document.createElement('canvas'); c.width = A4.W; c.height = A4.H;
    const ctx = c.getContext('2d');
    const cx = A4.W / 2;
    ctx.fillStyle = m.bg; ctx.fillRect(0, 0, A4.W, A4.H);
    /* Innenfläche mit feiner Linie */
    const P = { x: 80, y: 80, w: A4.W - 160, h: A4.H - 160 };
    ctx.fillStyle = m.panel; rund(ctx, P.x, P.y, P.w, P.h, 42); ctx.fill();
    ctx.strokeStyle = m.line; ctx.lineWidth = 3; rund(ctx, P.x + 26, P.y + 26, P.w - 52, P.h - 52, 30); ctx.stroke();
    ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    /* Unterer Block von unten nach oben verankert: Bedingungen, Einlösung, Gültigkeit, Code, Wert */
    let u = P.y + P.h - 70;
    ctx.fillStyle = '#56685D'; ctx.font = "400 22px Lexend, 'Segoe UI', sans-serif";
    ctx.fillText(T.bed, cx, u); u -= 44;
    umbrechen(ctx, T.einloesen, P.w - 240, 2).reverse().forEach(z => { ctx.fillText(z, cx, u); u -= 34; });
    u -= 14;
    ctx.fillStyle = m.head; ctx.font = "600 30px Lexend, 'Segoe UI', sans-serif";
    ctx.fillText(T.gueltig + ' ' + gueltigBis(v.issued, lang), cx, u); u -= 50;
    /* Barcode-Feld */
    const bw = 620, bh = 210, bx = cx - bw / 2, by = u - bh;
    ctx.fillStyle = '#FFFFFF'; rund(ctx, bx, by, bw, bh, 22); ctx.fill();
    ctx.strokeStyle = m.line; ctx.lineWidth = 2; rund(ctx, bx, by, bw, bh, 22); ctx.stroke();
    const code = String(v.code || 'LOVE-····-····');
    if (typeof JsBarcode !== 'undefined' && /^LOVE-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(code)) {
      try {
        const bc = document.createElement('canvas');
        JsBarcode(bc, code, { format: 'CODE128', displayValue: false, height: 100, width: 3, margin: 0, lineColor: '#2C3A31', background: '#FFFFFF' });
        const w = Math.min(bw - 80, bc.width); ctx.drawImage(bc, cx - w / 2, by + 30, w, 100);
      } catch (e) { }
    }
    ctx.fillStyle = m.ink; ctx.font = "600 34px Lexend, 'Segoe UI', sans-serif";
    try { ctx.letterSpacing = '6px'; } catch (e) { }
    ctx.fillText(code, cx, by + bh - 34); try { ctx.letterSpacing = '0px'; } catch (e) { }
    /* Wert */
    const amount = Number(v.amount) || 0;
    if (amount > 0) {
      ctx.fillStyle = m.head; ctx.font = "700 92px 'Playfair Display', Georgia, serif";
      ctx.fillText(chfText(amount), cx, by - 50);
    }
    /* Bis hierhin darf der obere Teil reichen */
    const grenze = amount > 0 ? by - 50 - 80 - 24 : by - 40;
    let y = P.y + 70;
    if (m.bild) {
      /* Motiv «Illustration»: die LOVE-Geschenkkarte als Bild oben */
      try {
        const img = await loadImg();
        const sh = Math.round(img.naturalHeight * 0.66);   // ohne das weisse Barcode-Feld der Vorlage
        const w = 640, h = Math.round(w * sh / img.naturalWidth);
        ctx.save(); rund(ctx, cx - w / 2, y, w, h, 26); ctx.clip(); ctx.drawImage(img, 0, 0, img.naturalWidth, sh, cx - w / 2, y, w, h); ctx.restore();
        y += h + 64;
      } catch (e) { y += 20; }
    } else {
      const logo = await loadLogo();
      if (logo) { ctx.drawImage(logo, cx - 85, y, 170, 170); y += 170 + 70; } else y += 40;
    }
    /* «GESCHENKGUTSCHEIN» */
    ctx.fillStyle = m.accent; ctx.font = "600 40px Lexend, 'Segoe UI', sans-serif";
    try { ctx.letterSpacing = '12px'; } catch (e) { }
    ctx.fillText(T.kicker, cx, y); try { ctx.letterSpacing = '0px'; } catch (e) { }
    y += 30;
    ctx.fillStyle = m.accent; ctx.fillRect(cx - 60, y, 120, 4); y += 90;
    /* Titel des Erlebnisses bzw. «Wertgutschein» */
    if (v.title) {
      ctx.fillStyle = m.head; ctx.font = "700 64px 'Playfair Display', Georgia, serif";
      umbrechen(ctx, v.title, P.w - 220, 2).forEach(z => { ctx.fillText(z, cx, y); y += 78; });
    }
    /* «für …» */
    if (v.recipient) {
      y += 24; ctx.fillStyle = m.accent; ctx.font = "italic 600 76px 'Playfair Display', Georgia, serif";
      umbrechen(ctx, T.fuer + ' ' + v.recipient, P.w - 220, 2).forEach(z => { ctx.fillText(z, cx, y); y += 90; });
    }
    /* Persönlicher Text */
    if (v.message) {
      y += 30; ctx.fillStyle = m.ink; ctx.font = "400 34px Lexend, 'Segoe UI', sans-serif";
      const platz = grenze - y - (v.from ? 70 : 0);
      const maxZ = Math.max(1, Math.min(6, Math.floor(platz / 52)));
      umbrechen(ctx, v.message, P.w - 300, maxZ).forEach(z => { ctx.fillText(z, cx, y); y += 52; });
    }
    if (v.from) {
      y += 26; ctx.fillStyle = m.head; ctx.font = "500 34px Lexend, 'Segoe UI', sans-serif";
      ctx.fillText(T.von + ' ' + v.from, cx, y); y += 40;
    }
    return c;
  }
  async function pdfDocA4(v) {
    const c = await renderA4(v);
    const J = window.jspdf && window.jspdf.jsPDF;
    if (!J) throw new Error('jspdf-missing');
    const doc = new J({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    doc.addImage(c.toDataURL('image/jpeg', 0.9), 'JPEG', 0, 0, 210, 297);
    return doc;
  }

  /* Karte als Bild in ein Element hängen (Bestätigungsseite, Kartenansicht) — mit v.a4 als A4-Gutschein */
  async function mount(el, v) {
    const c = v && v.a4 ? await renderA4(v) : await render(v);
    const im = new Image();
    im.src = c.toDataURL('image/jpeg', 0.92);
    im.alt = 'LOVE Geschenkkarte ' + (v.code || '');
    im.style.cssText = 'width:100%;height:auto;border-radius:18px;box-shadow:0 14px 34px rgba(51,115,87,.22)';
    el.innerHTML = '';
    el.appendChild(im);
    return c;
  }

  /* jsPDF-Dokument im Kartenformat (160 mm breit) */
  async function pdfDoc(v) {
    const c = await render(v);
    const J = window.jspdf && window.jspdf.jsPDF;
    if (!J) throw new Error('jspdf-missing');
    const wmm = 160, hmm = Math.round(wmm * c.height / c.width * 100) / 100;
    const doc = new J({ orientation: wmm > hmm ? 'landscape' : 'portrait', unit: 'mm', format: [wmm, hmm] });
    doc.addImage(c.toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, wmm, hmm);
    return doc;
  }
  /* PDF: seit 14.10.2026 der A4-Geschenkgutschein; das alte Kartenformat nur noch mit v.format === 'karte' */
  const pdfFuer = v => (v && v.format === 'karte' ? pdfDoc(v) : pdfDocA4(v));
  async function download(v) {
    const doc = await pdfFuer(v);
    doc.save('LOVE-Geschenkgutschein-' + (v.code || 'karte') + '.pdf');
  }
  /* Base64 fürs Mailen über die Cloud-API (voucher_pdf_mail) */
  async function pdfBase64(v) {
    const doc = await pdfFuer(v);
    return doc.output('datauristring').split(',')[1] || '';
  }

  return { render, renderA4, mount, download, pdfBase64, MOTIVE };
})();
