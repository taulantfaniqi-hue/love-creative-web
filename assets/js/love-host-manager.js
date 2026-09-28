/* LOVE Creative — Booking-Manager im Host-Bereich (seit 28.09.2026)
 *
 * WAS ER TUT: Prüft jede offene Anfrage gegen die Regeln des Betriebs und macht einen
 * VORSCHLAG — annehmen, zurückfragen, Alternative anbieten, auf Zahlung warten oder ablehnen —
 * samt Begründung und einer ausgefüllten Antwortvorlage. Entscheiden und handeln tut immer
 * der Mensch im Host: Er passt den Text an und klickt «Direkt senden» (optional gleich mit
 * «annehmen» oder «ablehnen»), jedes Mal mit Rückfrage. Der Manager ändert nie selbst eine
 * Buchung und sendet nie selbst.
 *
 * VERSAND: über die Server-Aktion «booking_reply» (Baustein live/server/booking_reply.php, muss
 * auf dem Infomaniak-Server eingebunden sein). Fehlt sie, meldet der Host das und bietet «Kopieren».
 *
 * WIE ER ENTSCHEIDET: feste Regeln, kein Sprachmodell. Die Regeln spiegeln
 * agents/_SHARED-CONTEXT.md und assets/js/love-site.js (Öffnungszeiten, Zeitfenster,
 * Tischbestand). Ändern sich dort Öffnungszeiten, Tische oder Preise, HIER nachführen.
 *
 * VORLAGEN: Standardtexte unten (DE/EN). Im Host unter «Anfragen» → «Antwortvorlagen»
 * anpassbar; Anpassungen gelten nur auf dem Gerät, auf dem sie gemacht wurden.
 */
const LoveBookingManager = (() => {
  'use strict';

  /* ═══════ Regeln (Stand 28.09.2026) ═══════ */
  const OEFFNUNG = {                       // 0 = Sonntag … 6 = Samstag; null = regulär geschlossen
    0: { von: '10:00', bis: '18:30', slots: ['10:00–13:00', '13:00–16:00', '16:00–18:30'] },
    1: null, 2: null, 4: null,
    3: { von: '12:00', bis: '20:00', slots: ['12:00–15:00', '15:00–18:00', '18:00–20:00'] },
    5: { von: '12:00', bis: '20:00', slots: ['12:00–15:00', '15:00–18:00', '18:00–20:00'] },
    6: { von: '10:00', bis: '18:30', slots: ['10:00–13:00', '13:00–16:00', '16:00–18:30'] }
  };
  const PRIVAT_SLOTS = ['10:00–13:00', '13:30–16:30', '17:00–20:00'];
  const INVENTORY = { rund2: 6, rund4: 2, lang8: 3 };         // 44 Plätze
  const KIND_LBL = { rund2: 'Rundtische für 2', rund4: 'Rundtische für 4', lang8: 'langen Tische für 8' };
  const VORAUSBEZAHLT = ['kidscamp', 'geburtstag', 'keramik-privat'];
  const GEB_MAX_KINDER = 20, PRIVAT_MIN = 6, PRIVAT_MAX_ONLINE = 8;
  const AKTIV = ['bestätigt', 'gewonnen'];                     // belegen Kapazität

  const TAGE = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
  const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const wtag = iso => new Date(iso + 'T12:00:00').getDay();
  const heute = () => { const d = new Date(); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10); };
  const plus = (iso, n) => new Date(new Date(iso + 'T12:00:00').getTime() + n * 864e5).toISOString().slice(0, 10);
  const zuMin = t => { const m = String(t || '').match(/(\d{1,2}):(\d{2})/); return m ? +m[1] * 60 + +m[2] : null; };
  const spanne = t => { const m = String(t || '').match(/(\d{1,2}):(\d{2})\s*[–-]\s*(\d{1,2}):(\d{2})/); return m ? [+m[1] * 60 + +m[2], +m[3] * 60 + +m[4]] : null; };
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[m]));
  const bezahlt = b => b.paid == 1 || b.paid === true;
  const tischArt = p => { p = +p || 0; return p <= 0 ? null : p <= 2 ? 'rund2' : p <= 4 ? 'rund4' : p <= 8 ? 'lang8' : 'event'; };
  const datumLang = (iso, en) => {
    if (!iso) return '';
    const d = new Date(iso + 'T12:00:00');
    return d.toLocaleDateString(en ? 'en-GB' : 'de-CH', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  };

  /* ctx.senden(data)  → Promise<{ok,error}>  schickt die Antwort über den Server (Aktion «booking_reply»)
     ctx.aktion(act,id) → Promise              löst «booking_confirm» / «booking_reject» aus (wie die Knöpfe im Host) */
  let ctx = { bookings: [], camps: [], senden: null, aktion: null };
  function setContext(c) { ctx = Object.assign({ bookings: [], camps: [], senden: null, aktion: null }, c || {}); }

  /* Freie Tische eines Typs in einem Fenster (nur bestätigte Tisch-/Kino-Buchungen zählen) */
  function frei(dateISO, slot, art, ohneId) {
    const belegt = ctx.bookings.filter(x => x.id !== ohneId && ['tisch', 'reservation', 'kino'].includes(x.type)
      && x.date === dateISO && x.time === slot && AKTIV.includes(x.status) && tischArt(x.persons) === art).length;
    return (INVENTORY[art] || 0) - belegt;
  }
  /* Alternativen: gleiche Tag andere Fenster, dann die nächsten offenen Tage (max. 4 Vorschläge) */
  function alternativen(b, art) {
    const out = [];
    const start = b.date && b.date >= heute() ? b.date : heute();
    for (let i = 0; i < 21 && out.length < 4; i++) {
      const tag = plus(start, i), o = OEFFNUNG[wtag(tag)];
      if (!o) continue;
      for (const s of o.slots) {
        if (tag === b.date && s === b.time) continue;
        if (frei(tag, s, art, b.id) > 0) { out.push({ date: tag, slot: s }); if (out.length >= 4) break; }
      }
    }
    return out;
  }
  function ueberschneidet(a, b) { const x = spanne(a), y = spanne(b); return x && y ? x[0] < y[1] && y[0] < x[1] : a === b; }

  /* ═══════ Analyse einer Anfrage ═══════
     Ergebnis: { aktion, titel, ampel, gruende[], hinweise[], vorlage, alternativen[] }
     aktion: annehmen | warten | rueckfrage | alternative | offerte | ablehnen | pruefen */
  function analyse(b) {
    const g = [], h = [];
    let aktion = 'annehmen', vorlage = 'bestaetigung', alt = [];
    const txt = (b.name || '') + ' ' + (b.message || '');
    const setze = (a, v) => {                     // strengere Aktion gewinnt
      const rang = { annehmen: 0, pruefen: 1, offerte: 2, warten: 3, rueckfrage: 4, alternative: 5, ablehnen: 6 };
      if (rang[a] >= rang[aktion]) { aktion = a; vorlage = v; }
    };

    /* Allgemein */
    if (/\bTEST/i.test(txt)) { setze('ablehnen', 'test'); g.push('Als Test markiert («TEST» in Name oder Nachricht).'); }
    if (b.date && b.date < heute()) { setze('ablehnen', 'absage'); g.push('Das Datum liegt in der Vergangenheit.'); }
    if (!b.email) h.push('Keine E-Mail-Adresse — Antwort nur per Telefon möglich.');
    if (!b.phone) h.push('Keine Telefonnummer angegeben.');
    const doppelt = ctx.bookings.filter(x => x.id !== b.id && x.email && x.email === b.email && x.date === b.date
      && x.type === b.type && !['storniert', 'verloren', 'abgelehnt'].includes(x.status));
    if (doppelt.length) h.push('Mögliche Doppelanfrage: gleiche E-Mail, gleicher Tag (' + doppelt.map(x => x.id).join(', ') + ').');

    /* Vorausbezahlte Angebote: erst annehmen, wenn bezahlt */
    if (VORAUSBEZAHLT.includes(b.type)) {
      if (bezahlt(b)) g.push('Online bezahlt ✓');
      else { setze('warten', 'zahlung_offen'); g.push('Zahlung noch nicht eingegangen — erst annehmen, wenn bezahlt.'); }
    }

    const offen = b.date ? OEFFNUNG[wtag(b.date)] : null;
    if (b.type === 'tisch' || b.type === 'reservation') {
      const art = tischArt(b.persons);
      if (art === 'event') { setze('alternative', 'event_statt_tisch'); g.push('Ab 9 Personen ist es ein Anlass — über den Eventplaner mit Offerte.'); }
      else if (!offen) { setze('alternative', 'alternative'); g.push('An diesem Tag ist regulär geschlossen.'); alt = alternativen(b, art); }
      else if (b.time && !offen.slots.includes(b.time)) { setze('rueckfrage', 'rueckfrage'); g.push('Das Zeitfenster «' + b.time + '» gibt es an diesem Tag nicht.'); }
      else if (art && b.time) {
        const f = frei(b.date, b.time, art, b.id);
        if (f > 0) g.push('Platz frei: ' + f + ' von ' + INVENTORY[art] + ' ' + KIND_LBL[art] + ' sind in diesem Fenster noch nicht vergeben.');
        else { setze('alternative', 'alternative'); g.push('Ausgebucht: alle ' + INVENTORY[art] + ' ' + KIND_LBL[art] + ' sind in diesem Fenster schon bestätigt.'); alt = alternativen(b, art); }
      }
    } else if (b.type === 'keramik-privat') {
      if (offen) h.push('Das ist ein regulärer Öffnungstag — Privat-Sessions sind für geschlossene Tage gedacht.');
      else g.push('Geschlossener Tag: Studio wird eigens geöffnet — Personal einplanen.');
      if (+b.persons < PRIVAT_MIN) { setze('rueckfrage', 'rueckfrage'); g.push('Weniger als ' + PRIVAT_MIN + ' Personen.'); }
      if (+b.persons > PRIVAT_MAX_ONLINE) h.push('Mehr als ' + PRIVAT_MAX_ONLINE + ' Personen — Tischplan prüfen.');
      if (b.time && !PRIVAT_SLOTS.includes(b.time)) h.push('Ungewohntes Zeitfenster «' + b.time + '».');
      const konflikt = ctx.bookings.filter(x => x.id !== b.id && x.date === b.date && AKTIV.includes(x.status)
        && ['keramik-privat', 'geburtstag', 'event'].includes(x.type) && ueberschneidet(x.time, b.time));
      if (konflikt.length) { setze('alternative', 'alternative'); g.push('Überschneidung mit bestätigtem Anlass: ' + konflikt.map(x => (x.name || x.id) + ' ' + x.time).join(', ') + '.'); }
    } else if (b.type === 'geburtstag') {
      if (+b.persons > GEB_MAX_KINDER) { setze('rueckfrage', 'rueckfrage'); g.push('Mehr als ' + GEB_MAX_KINDER + ' Kinder.'); }
      if (+b.persons >= 11) h.push('Ab 11 Kindern einen zweiten Tisch einplanen.');
      if (!offen) g.push('Geschlossener Tag: Studio wird eigens für das Fest geöffnet — Personal einplanen.');
      else {
        const sp = spanne(b.time), zu = zuMin(offen.bis);
        if (sp && zu && sp[1] > zu) { setze('rueckfrage', 'rueckfrage'); g.push('Das Fest endet nach Ladenschluss (' + offen.bis + ').'); }
      }
      const konflikt = ctx.bookings.filter(x => x.id !== b.id && x.date === b.date && AKTIV.includes(x.status)
        && ['geburtstag', 'keramik-privat', 'event'].includes(x.type) && ueberschneidet(x.time, b.time));
      if (konflikt.length) h.push('Gleichzeitig bestätigt: ' + konflikt.map(x => typeLbl(x.type) + ' ' + (x.name || '') + ' ' + x.time).join(', ') + ' — Platz prüfen.');
    } else if (b.type === 'kidscamp') {
      const woche = (ctx.camps || []).find(c => c.start === b.date);
      if (ctx.camps && ctx.camps.length && !woche) h.push('Diese Camp-Woche ist im Host nicht (mehr) ausgeschrieben.');
      const kinder = ctx.bookings.filter(x => x.type === 'kidscamp' && x.date === b.date && AKTIV.includes(x.status))
        .reduce((s, x) => s + (+x.persons || 0), 0);
      h.push('Bereits bestätigt für diese Woche: ' + kinder + ' Kind(er). Eine Obergrenze ist nicht festgelegt.');
      if (!/Allergien:/i.test(b.message || '')) h.push('Allergie-Angaben nicht im Nachrichtentext gefunden — prüfen.');
    } else if (b.type === 'event') {
      setze('offerte', 'offerte'); g.push('Anlass auf Anfrage — Offerte durch die Geschäftsführung (Preise nie öffentlich).');
    } else {
      setze('pruefen', 'rueckfrage'); g.push('Für diesen Anfragetyp gibt es keine feste Regel — bitte selbst prüfen.');
    }

    const TITEL = {
      annehmen: 'Annehmen', warten: 'Warten — Zahlung offen', rueckfrage: 'Zurückfragen', alternative: 'Alternative anbieten',
      offerte: 'Offerte erstellen', ablehnen: 'Ablehnen', pruefen: 'Selbst prüfen'
    };
    const AMPEL = { annehmen: 'gruen', warten: 'gelb', rueckfrage: 'gelb', alternative: 'gelb', offerte: 'gelb', pruefen: 'gelb', ablehnen: 'rot' };
    if (aktion === 'annehmen') vorlage = { kidscamp: 'bestaetigung_camp', geburtstag: 'bestaetigung_geburtstag', 'keramik-privat': 'bestaetigung_privat' }[b.type] || 'bestaetigung';
    if (aktion === 'ablehnen' && vorlage === 'absage' && bezahlt(b)) vorlage = 'absage_bezahlt';
    return { aktion, titel: TITEL[aktion], ampel: AMPEL[aktion], gruende: g, hinweise: h, vorlage, alternativen: alt };
  }
  const TYPE_LBL = { tisch: 'Tisch', reservation: 'Tisch', kino: 'Kino-Night', kidscamp: 'Kidscamp', geburtstag: 'Geburtstag', event: 'Event', 'keramik-privat': 'Privat-Session' };
  const typeLbl = t => TYPE_LBL[t] || t || '—';

  /* ═══════ Antwortvorlagen ═══════
     Platzhalter: {vorname} {datum} {zeit} {personen} {art} {ref} {betrag} {alternativen} {camptage} */
  const SIGNATUR = {
    de: '\n\nHerzliche Grüsse\nDein LOVE Creative Team\nSeestrasse 287B · 8804 Au ZH · hello@lovecreative.ch · 078 333 39 39',
    en: '\n\nWarm regards\nYour LOVE Creative team\nSeestrasse 287B · 8804 Au ZH · hello@lovecreative.ch · 078 333 39 39'
  };
  const STANDARD = {
    bestaetigung: { name: 'Bestätigung Tisch',
      de: ['Deine Reservation am {datum} ist bestätigt', 'Hallo {vorname}\n\nschön, dass du zu uns kommst! Deine Reservation ist bestätigt:\n\n{datum}, {zeit} · {personen} Personen\nReferenz: {ref}\n\nKeramik aussuchen, in Ruhe bemalen — wir glasieren und brennen dein Stück, nach rund zwei Wochen kannst du es abholen. Falls sich etwas ändert, gib uns bitte kurz Bescheid.'],
      en: ['Your reservation on {datum} is confirmed', 'Hi {vorname}\n\nwe are looking forward to your visit! Your reservation is confirmed:\n\n{datum}, {zeit} · {personen} people\nReference: {ref}\n\nPick a piece, paint it at your own pace — we glaze and fire it, and about two weeks later it is ready for pick-up. If anything changes, just let us know.'] },
    bestaetigung_camp: { name: 'Bestätigung Kidscamp',
      de: ['Anmeldung Ferien-Kidscamp bestätigt', 'Hallo {vorname}\n\nvielen Dank für die Anmeldung zum Ferien-Kidscamp — die Zahlung ist eingegangen und der Platz ist bestätigt.\n\n{camptage}\nZeiten: jeweils 09:00–15:00 Uhr (mit Randbetreuung bis 16:30 Uhr, falls gebucht)\nReferenz: {ref}\n\nMittagessen, Znüni und Getränke sind inklusive. Abholen dürfen nur die Personen, die du bei der Anmeldung angegeben hast. Hat sich bei Allergien oder Abholpersonen etwas geändert, schreib uns bitte vor Campbeginn.'],
      en: ['Holiday kids camp registration confirmed', 'Hi {vorname}\n\nthank you for registering for the holiday kids camp — your payment has arrived and the place is confirmed.\n\n{camptage}\nTimes: 9 am – 3 pm each day (extended care until 4:30 pm if booked)\nReference: {ref}\n\nLunch, snack and drinks are included. Only the persons named in the registration may pick up your child. If anything about allergies or pick-up persons has changed, please let us know before the camp starts.'] },
    bestaetigung_geburtstag: { name: 'Bestätigung Kindergeburtstag',
      de: ['Euer Kindergeburtstag am {datum} ist bestätigt', 'Hallo {vorname}\n\ndie Zahlung ist eingegangen — euer Fest ist bestätigt:\n\n{datum}, {zeit} · {personen} Kinder\nReferenz: {ref}\n\nWir bereiten den Tisch festlich vor; Wasser und Sirup sind inklusive, Kuchen dürft ihr gern mitbringen. Die bemalten Stücke sind nach rund zwei Wochen abholbereit. Ändert sich die Anzahl Kinder, gib uns bitte kurz Bescheid.'],
      en: ['Your kids\' birthday on {datum} is confirmed', 'Hi {vorname}\n\nyour payment has arrived — the party is confirmed:\n\n{datum}, {zeit} · {personen} children\nReference: {ref}\n\nWe set the table festively; water and syrup are included, and you are welcome to bring a cake. The painted pieces are ready for pick-up about two weeks later. If the number of children changes, just let us know.'] },
    bestaetigung_privat: { name: 'Bestätigung Privat-Session',
      de: ['Eure private Keramik-Session am {datum} ist bestätigt', 'Hallo {vorname}\n\nwir öffnen das Studio gern eigens für euch — eure private Keramik-Session ist bestätigt:\n\n{datum}, {zeit} · {personen} Personen\nReferenz: {ref}\n\nDie Servicegebühr ist bezahlt, die Keramikstücke bezahlt ihr vor Ort. Bis 24 Stunden vorher könnt ihr kostenlos absagen.'],
      en: ['Your private ceramic session on {datum} is confirmed', 'Hi {vorname}\n\nwe are happy to open the studio just for you — your private ceramic session is confirmed:\n\n{datum}, {zeit} · {personen} people\nReference: {ref}\n\nThe service fee is paid; you pay for the ceramic pieces on site. You can cancel free of charge up to 24 hours before.'] },
    alternative: { name: 'Alternative vorschlagen',
      de: ['Deine Anfrage für {datum} — ein Vorschlag', 'Hallo {vorname}\n\nvielen Dank für deine Anfrage. Für {datum}, {zeit} können wir dir leider keinen Platz zusagen. Diese Termine hätten wir frei:\n\n{alternativen}\n\nPasst dir einer davon? Antworte einfach auf diese Mail, dann tragen wir dich ein.'],
      en: ['Your request for {datum} — a suggestion', 'Hi {vorname}\n\nthank you for your request. Unfortunately we cannot offer you a place on {datum}, {zeit}. These slots are available:\n\n{alternativen}\n\nDoes one of them work for you? Just reply to this e-mail and we will book you in.'] },
    rueckfrage: { name: 'Rückfrage',
      de: ['Kurze Rückfrage zu deiner Anfrage', 'Hallo {vorname}\n\nvielen Dank für deine Anfrage für {datum}. Bevor wir sie bestätigen, brauchen wir noch eine Angabe:\n\n[Frage hier ergänzen]\n\nAntworte einfach auf diese Mail.'],
      en: ['A quick question about your request', 'Hi {vorname}\n\nthank you for your request for {datum}. Before we confirm it, we need one more detail:\n\n[add your question here]\n\nJust reply to this e-mail.'] },
    zahlung_offen: { name: 'Zahlung offen',
      de: ['Deine Anmeldung — Zahlung noch offen', 'Hallo {vorname}\n\nvielen Dank für deine Anmeldung ({art}, {datum}). Bei uns ist die Online-Zahlung von {betrag} noch nicht eingegangen. Sobald sie da ist, bestätigen wir dir den Termin.\n\nFalls die Zahlung abgebrochen wurde, antworte kurz auf diese Mail — wir schicken dir gern einen neuen Zahlungslink.'],
      en: ['Your registration — payment still open', 'Hi {vorname}\n\nthank you for your registration ({art}, {datum}). We have not yet received the online payment of {betrag}. As soon as it arrives, we will confirm the date.\n\nIf the payment was interrupted, just reply to this e-mail and we will send you a new payment link.'] },
    offerte: { name: 'Offerte folgt',
      de: ['Deine Anfrage für {datum}', 'Hallo {vorname}\n\nvielen Dank für deine Anfrage für {datum} mit {personen} Personen. Wir stellen dir gern eine Offerte zusammen und melden uns innert 24 Stunden.\n\nGibt es Wünsche zu Ablauf, Motiv oder Uhrzeit, die wir berücksichtigen sollen? Dann antworte einfach auf diese Mail.'],
      en: ['Your request for {datum}', 'Hi {vorname}\n\nthank you for your request for {datum} with {personen} people. We will put together a quote and get back to you within 24 hours.\n\nAny wishes regarding schedule, motif or time we should consider? Just reply to this e-mail.'] },
    event_statt_tisch: { name: 'Gruppe ab 9 → Anlass',
      de: ['Deine Anfrage für {personen} Personen', 'Hallo {vorname}\n\nvielen Dank für deine Anfrage für {datum} mit {personen} Personen. Ab 9 Personen planen wir das als eigenen Anlass mit Offerte. Wir melden uns innert 24 Stunden mit einem Vorschlag.'],
      en: ['Your request for {personen} people', 'Hi {vorname}\n\nthank you for your request for {datum} with {personen} people. From 9 people we plan this as a private event with a quote. We will get back to you with a proposal within 24 hours.'] },
    absage: { name: 'Absage',
      de: ['Deine Anfrage für {datum}', 'Hallo {vorname}\n\nvielen Dank für deine Anfrage. Leider können wir sie für {datum} nicht bestätigen. Wir freuen uns, wenn du einen anderen Termin wählst — auf lovecreative.ch oder per Antwort auf diese Mail.'],
      en: ['Your request for {datum}', 'Hi {vorname}\n\nthank you for your request. Unfortunately we cannot confirm it for {datum}. We would be happy to welcome you on another date — on lovecreative.ch or simply by replying to this e-mail.'] },
    absage_bezahlt: { name: 'Absage mit Rückerstattung',
      de: ['Deine Buchung für {datum}', 'Hallo {vorname}\n\nleider können wir deine Buchung ({art}, {datum}) nicht durchführen. Den bezahlten Betrag von {betrag} erstatten wir dir vollständig zurück — auf das Zahlungsmittel, mit dem du bezahlt hast.\n\nEs tut uns leid. Wenn du magst, finden wir gern einen anderen Termin.'],
      en: ['Your booking for {datum}', 'Hi {vorname}\n\nunfortunately we cannot hold your booking ({art}, {datum}). We will refund the full amount of {betrag} to the payment method you used.\n\nWe are sorry. If you like, we will gladly find another date.'] },
    test: { name: 'Testanmeldung (keine Mail)',
      de: ['— Testanmeldung, keine Antwort nötig —', 'Diese Anfrage ist als Test markiert. Keine Antwort an den Gast nötig — einfach ablehnen. Achtung: Beim Ablehnen verschickt der Server trotzdem seine Standard-Absage an die angegebene E-Mail.'],
      en: ['— test registration, no reply needed —', 'This request is marked as a test. No reply needed — just decline it. Note: when declining, the server still sends its standard decline e-mail to the address given.'] }
  };
  const SPEICHER = 'love.host.vorlagen.v1';
  function vorlagen() {
    let eigen = {};
    try { eigen = JSON.parse(localStorage.getItem(SPEICHER)) || {}; } catch (e) { }
    const out = {};
    for (const [id, v] of Object.entries(STANDARD)) out[id] = { name: v.name, de: (eigen[id] && eigen[id].de) || v.de, en: (eigen[id] && eigen[id].en) || v.en, eigen: !!eigen[id] };
    return out;
  }
  function speichereVorlage(id, sprache, betreff, text) {
    let eigen = {};
    try { eigen = JSON.parse(localStorage.getItem(SPEICHER)) || {}; } catch (e) { }
    eigen[id] = eigen[id] || {};
    eigen[id][sprache] = [betreff, text];
    try { localStorage.setItem(SPEICHER, JSON.stringify(eigen)); } catch (e) { }
  }
  function vorlageZuruecksetzen(id) {
    let eigen = {};
    try { eigen = JSON.parse(localStorage.getItem(SPEICHER)) || {}; } catch (e) { }
    delete eigen[id];
    try { localStorage.setItem(SPEICHER, JSON.stringify(eigen)); } catch (e) { }
  }

  function fuelle(text, b, a, en) {
    const vorname = String(b.name || '').replace(/^TEST\s+/i, '').trim().split(/\s+/)[0] || (en ? 'there' : '');
    const camp = (String(b.message || '').match(/\d+ Tag\(e\):[^\n(]*/) || [''])[0].trim();
    const alt = (a.alternativen || []).map(x => '• ' + datumLang(x.date, en) + ', ' + x.slot).join('\n') || (en ? '• [add alternative dates]' : '• [Alternativen ergänzen]');
    const werte = {
      vorname, datum: datumLang(b.date, en), zeit: b.time || '', personen: b.persons || '', art: typeLbl(b.type),
      ref: b.id || '', betrag: b.price || '', alternativen: alt,
      camptage: camp ? (en ? 'Camp days: ' : 'Camp-Tage: ') + camp.replace(/^\d+ Tag\(e\):\s*/, '') : (en ? 'Camp week from ' : 'Camp-Woche ab ') + datumLang(b.date, en)
    };
    return text.replace(/\{(\w+)\}/g, (m, k) => (k in werte ? werte[k] : m));
  }
  function entwurf(b, vorlageId, a) {
    const en = b.lang === 'en';
    const v = vorlagen()[vorlageId] || vorlagen().rueckfrage;
    const [betreff, text] = en ? v.en : v.de;
    const mitSignatur = vorlageId === 'test' ? text : text + SIGNATUR[en ? 'en' : 'de'];
    return { betreff: fuelle(betreff, b, a, en), text: fuelle(mitSignatur, b, a, en) };
  }

  /* ═══════ Darstellung im Host ═══════ */
  const AMPEL_TXT = { gruen: '🟢', gelb: '🟡', rot: '🔴' };
  function panel(b) {
    const a = analyse(b);
    const e = entwurf(b, a.vorlage, a);
    const V = vorlagen();
    return `<div class="bm" data-bm="${esc(b.id)}">
      <div class="bm-head"><span class="bm-tag">Booking-Manager · Vorschlag</span>
        <span class="bm-empf bm-${a.ampel}">${AMPEL_TXT[a.ampel]} ${esc(a.titel)}</span></div>
      ${a.gruende.length ? `<ul class="bm-list">${a.gruende.map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}
      ${a.hinweise.length ? `<ul class="bm-list bm-hint">${a.hinweise.map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}
      <details class="bm-antwort"${a.aktion === 'annehmen' ? '' : ' open'}>
        <summary>✉️ Antwort vorbereiten</summary>
        <label class="bm-lbl">Vorlage
          <select class="bm-vorlage">${Object.entries(V).map(([id, v]) => `<option value="${id}"${id === a.vorlage ? ' selected' : ''}>${esc(v.name)}${id === a.vorlage ? ' (Vorschlag)' : ''}</option>`).join('')}</select></label>
        <label class="bm-lbl">Betreff<input class="bm-betreff" value="${esc(e.betreff)}"></label>
        <label class="bm-lbl">Text<textarea class="bm-text" rows="9">${esc(e.text)}</textarea></label>
        <div class="bm-knoepfe">
          <button type="button" class="btn btn-rose btn-sm bm-send" data-folge=""${b.email ? '' : ' disabled'}>✉️ Direkt senden</button>
          ${['ablehnen', 'warten'].includes(a.aktion) ? '' : `<button type="button" class="btn btn-green btn-sm bm-send" data-folge="booking_confirm"${b.email ? '' : ' disabled'}>✉️ Senden &amp; ✓ annehmen</button>`}
          <button type="button" class="btn btn-ghost btn-sm bm-send" data-folge="booking_reject"${b.email ? '' : ' disabled'}>✉️ Senden &amp; ablehnen</button>
          <button type="button" class="btn btn-ghost btn-sm bm-kopie">📋 Kopieren</button>
        </div>
        <p class="bm-status" aria-live="polite"></p>
        <p class="bm-fuss">Gesendet wird von hello@lovecreative.ch an ${esc(b.email || '—')} — erst wenn du klickst. Der Manager selbst sendet und ändert nichts. Hinweis: <b>Annehmen</b> und <b>Ablehnen</b> verschicken zusätzlich die Standard-Mail des Servers.</p>
      </details>
    </div>`;
  }
  function wire(box) {
    box.querySelectorAll('.bm').forEach(el => {
      if (el.dataset.wired) return; el.dataset.wired = '1';
      const b = ctx.bookings.find(x => x.id === el.dataset.bm); if (!b) return;
      const a = analyse(b);
      /* Die Testvorlage ist ein interner Hinweis — nie an Gäste senden */
      const sperre = id => el.querySelectorAll('.bm-send').forEach(x => { x.disabled = id === 'test' || !b.email; });
      sperre(el.querySelector('.bm-vorlage').value);
      el.querySelector('.bm-vorlage').addEventListener('change', ev => {
        const e = entwurf(b, ev.target.value, a);
        el.querySelector('.bm-betreff').value = e.betreff; el.querySelector('.bm-text').value = e.text;
        sperre(ev.target.value);
      });
      const status = (t, art) => { const s = el.querySelector('.bm-status'); s.textContent = t; s.className = 'bm-status ' + (art || ''); };
      el.querySelectorAll('.bm-send').forEach(btn => btn.addEventListener('click', async () => {
        const folge = btn.dataset.folge;
        const betreff = el.querySelector('.bm-betreff').value.trim(), text = el.querySelector('.bm-text').value.trim();
        if (!betreff || !text) { status('Betreff und Text dürfen nicht leer sein.', 'err'); return; }
        const was = folge === 'booking_confirm' ? ' und die Anfrage ANNEHMEN' : folge === 'booking_reject' ? ' und die Anfrage ABLEHNEN' : '';
        if (!confirm('Diese Antwort jetzt an ' + b.email + ' senden' + was + '?')) return;
        if (!ctx.senden) { status('Keine Cloud-Verbindung — bitte neu anmelden.', 'err'); return; }
        el.querySelectorAll('.bm-send').forEach(x => { x.disabled = true; });
        status('Wird gesendet …');
        let r;
        try { r = await ctx.senden({ id: b.id, to: b.email, subject: betreff, text, lang: b.lang || 'de' }); }
        catch (e) { r = { ok: false, error: 'netz' }; }
        if (!r || !r.ok) {
          sperre(el.querySelector('.bm-vorlage').value);
          if (r && r.error === 'unknown-action') status('Direktversand ist auf dem Server noch nicht eingerichtet (Baustein «booking_reply» fehlt). Bis dahin: «Kopieren» und aus dem Postfach senden.', 'err');
          else status('Senden fehlgeschlagen (' + ((r && r.error) || 'unbekannt') + '). Nichts wurde geändert.', 'err');
          return;
        }
        status('✓ Gesendet an ' + b.email + (folge ? ' — Anfrage wird ' + (folge === 'booking_confirm' ? 'angenommen' : 'abgelehnt') + ' …' : '.'), 'ok');
        if (folge && ctx.aktion) await ctx.aktion(folge, b.id);
      }));
      el.querySelector('.bm-kopie').addEventListener('click', async ev => {
        const t = el.querySelector('.bm-betreff').value + '\n\n' + el.querySelector('.bm-text').value;
        try { await navigator.clipboard.writeText(t); ev.target.textContent = '✓ Kopiert'; }
        catch (e) { el.querySelector('.bm-text').select(); document.execCommand('copy'); ev.target.textContent = '✓ Kopiert'; }
        setTimeout(() => { ev.target.textContent = '📋 Text kopieren'; }, 1800);
      });
    });
    /* Vorlagen-Editor */
    const ed = box.querySelector('#bmEditor');
    if (ed && !ed.dataset.wired) {
      ed.dataset.wired = '1';
      const sel = ed.querySelector('#bmEdVorlage'), spr = ed.querySelector('#bmEdSprache');
      const lade = () => { const v = vorlagen()[sel.value]; const [bt, tx] = v[spr.value]; ed.querySelector('#bmEdBetreff').value = bt; ed.querySelector('#bmEdText').value = tx; ed.querySelector('#bmEdStatus').textContent = v.eigen ? 'angepasst auf diesem Gerät' : 'Standardtext'; };
      sel.addEventListener('change', lade); spr.addEventListener('change', lade);
      ed.querySelector('#bmEdSpeichern').addEventListener('click', () => { speichereVorlage(sel.value, spr.value, ed.querySelector('#bmEdBetreff').value, ed.querySelector('#bmEdText').value); lade(); ed.querySelector('#bmEdStatus').textContent = '✓ gespeichert (dieses Gerät)'; });
      ed.querySelector('#bmEdReset').addEventListener('click', () => { if (!confirm('Diese Vorlage auf den Standardtext zurücksetzen?')) return; vorlageZuruecksetzen(sel.value); lade(); });
      lade();
    }
  }
  function editor() {
    const V = vorlagen();
    return `<details class="bm-editor" id="bmEditor"><summary>✏️ Antwortvorlagen anpassen</summary>
      <p class="hint">Platzhalter: {vorname} {datum} {zeit} {personen} {art} {ref} {betrag} {alternativen} {camptage}. Die Grussformel mit Adresse wird automatisch angehängt. Änderungen gelten nur auf diesem Gerät.</p>
      <div class="bm-ed-row"><label class="bm-lbl">Vorlage<select id="bmEdVorlage">${Object.entries(V).map(([id, v]) => `<option value="${id}">${esc(v.name)}</option>`).join('')}</select></label>
        <label class="bm-lbl">Sprache<select id="bmEdSprache"><option value="de">Deutsch</option><option value="en">Englisch</option></select></label></div>
      <label class="bm-lbl">Betreff<input id="bmEdBetreff"></label>
      <label class="bm-lbl">Text<textarea id="bmEdText" rows="8"></textarea></label>
      <div class="bm-knoepfe"><button type="button" class="btn btn-rose btn-sm" id="bmEdSpeichern">Speichern</button>
        <button type="button" class="btn btn-ghost btn-sm" id="bmEdReset">Standard wiederherstellen</button>
        <span class="hint" id="bmEdStatus"></span></div>
    </details>`;
  }

  /* Stil einmal einfügen */
  (function stil() {
    if (document.getElementById('bmStyle')) return;
    const s = document.createElement('style'); s.id = 'bmStyle';
    s.textContent = `.bm{margin-top:.8rem;border:1.5px dashed var(--line);border-radius:14px;padding:.8rem .9rem;background:#fff}
.bm-head{display:flex;flex-wrap:wrap;gap:.5rem;align-items:center;justify-content:space-between;margin-bottom:.4rem}
.bm-tag{font-size:.72rem;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--rose)}
.bm-empf{font-weight:700;font-size:.92rem;border-radius:999px;padding:.2rem .7rem}
.bm-gruen{background:#e4f1e6;color:#1f5a35}.bm-gelb{background:#fff4d6;color:#7a5600}.bm-rot{background:#fbe1e4;color:#a4243b}
.bm-list{margin:.2rem 0 .4rem 1.1rem;font-size:.86rem;line-height:1.45}.bm-hint{color:var(--ink-soft)}
.bm-antwort summary,.bm-editor summary{cursor:pointer;font-weight:600;font-size:.9rem;color:var(--green);margin:.3rem 0}
.bm-lbl{display:block;font-size:.8rem;font-weight:600;color:var(--green);margin:.45rem 0 .15rem}
.bm-lbl select,.bm-lbl input,.bm-lbl textarea{display:block;width:100%;margin-top:.2rem;font:inherit;font-size:.88rem;font-weight:400;padding:.45rem .6rem;border:1.5px solid var(--line);border-radius:10px;background:#fff;color:var(--ink)}
.bm-lbl textarea{resize:vertical;line-height:1.45}
.bm-knoepfe{display:flex;flex-wrap:wrap;gap:.5rem;align-items:center;margin-top:.6rem}
.bm-fuss{font-size:.78rem;color:var(--ink-soft);margin-top:.5rem}
.bm-status{font-size:.85rem;font-weight:600;margin-top:.4rem;min-height:1em}.bm-status.ok{color:#1f5a35}.bm-status.err{color:#a4243b}
.bm-editor{margin:1.2rem 0;border:1.5px solid var(--line);border-radius:14px;padding:.7rem .9rem;background:#fff}
.bm-ed-row{display:grid;grid-template-columns:2fr 1fr;gap:.6rem}`;
    document.head.appendChild(s);
  })();

  return { setContext, analyse, entwurf, panel, wire, editor, vorlagen };
})();
