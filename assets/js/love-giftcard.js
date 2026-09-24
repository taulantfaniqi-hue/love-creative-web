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

  /* Karte als Bild in ein Element hängen (Bestätigungsseite, Kartenansicht) */
  async function mount(el, v) {
    const c = await render(v);
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
  async function download(v) {
    const doc = await pdfDoc(v);
    doc.save('LOVE-Geschenkkarte-' + (v.code || 'karte') + '.pdf');
  }
  /* Base64 fürs Mailen über die Cloud-API (voucher_pdf_mail) */
  async function pdfBase64(v) {
    const doc = await pdfDoc(v);
    return doc.output('datauristring').split(',')[1] || '';
  }

  return { render, mount, download, pdfBase64 };
})();
