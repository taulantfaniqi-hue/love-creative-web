/* LOVE Creative — Special enquiries.
 * Separate, non-binding event enquiries inside the existing reservation sheet.
 * Load after love-widget.js. Uses the existing acknowledged event enquiry route.
 */
(function (root) {
  'use strict';
  const MIN_PEOPLE = 6;
  const COPY = {
    de: {
      button: 'Spezielle Anfrage', back: '← Zur Tischreservation', title: 'Spezielle Anfrage',
      intro: 'Du planst etwas Besonderes? Sag uns, was du dir wünschst.',
      hours: 'Montag bis Sonntag, 10:00–21:00 Uhr. Gesetzliche Zürcher Feiertage sind ausgenommen. Alle Zeiten gelten für Zürich.',
      date: 'Wunschdatum', start: 'Gewünschte Startzeit', end: 'Gewünschte Endzeit (optional)', persons: 'Anzahl Personen (ab 6)',
      motif: 'Anlass / Motiv', motifPlaceholder: 'z. B. Geburtstag, Team-Event oder ein eigenes Thema',
      name: 'Vor- und Nachname', email: 'E-Mail', phone: 'Telefon (optional)', note: 'Weitere Wünsche (optional)',
      consent: 'Ich bin einverstanden, dass LOVE Creative diese Angaben zur Bearbeitung meiner Anfrage verwendet – gemäss',
      privacy: 'Datenschutzerklärung', submit: 'Anfrage senden', sending: 'Wird gesendet …',
      disclaimer: 'Dies ist eine unverbindliche Anfrage, keine bestätigte Reservation. Wir klären Verfügbarkeit und Details mit dir.',
      success: 'Anfrage eingegangen', successBody: 'Danke! Wir prüfen deinen Wunsch und melden uns bei dir. Dein Termin ist noch nicht bestätigt.',
      uncertain: 'Eingang nicht bestätigt', uncertainBody: 'Wir konnten die Übermittlung nicht bestätigen. Bitte kontaktiere uns unter hello@lovecreative.ch und nenne, falls vorhanden, die Referenz. Bitte sende die Anfrage nicht mehrfach.',
      preview: 'Vorschau – nichts gesendet', previewBody: 'Dies ist nur eine lokale Vorschau. Es wurde keine Anfrage gespeichert oder übermittelt.',
      reference: 'Referenz: ', required: 'Bitte fülle die Pflichtfelder aus.', badDate: 'Bitte wähle ein gültiges Datum ab heute.',
      holiday: 'An gesetzlichen Zürcher Feiertagen sind keine Anfragen möglich. Bitte wähle einen anderen Tag.',
      time: 'Bitte wähle eine Startzeit zwischen 10:00 und 21:00 Uhr.', endTime: 'Die Endzeit muss nach der Startzeit und spätestens um 21:00 Uhr liegen.',
      past: 'Diese Uhrzeit ist bereits vorbei. Bitte wähle einen späteren Zeitpunkt.', people: 'Bitte gib eine ganze Anzahl von mindestens 6 Personen ein.',
      badEmail: 'Bitte gib eine gültige E-Mail-Adresse ein.', consentError: 'Bitte bestätige die Bearbeitung deiner Angaben.',
      dateAvailable: 'Dieses Datum kann angefragt werden. Die Verfügbarkeit wird noch geprüft.'
    },
    en: {
      button: 'Special enquiry', back: '← Back to table reservation', title: 'Special enquiry',
      intro: 'Planning something special? Tell us what you have in mind.',
      hours: 'Monday to Sunday, 10:00–21:00. Statutory Zurich public holidays are excluded. All times are Zurich local time.',
      date: 'Preferred date', start: 'Preferred start time', end: 'Preferred end time (optional)', persons: 'Number of people (min. 6)',
      motif: 'Occasion / theme', motifPlaceholder: 'e.g. birthday, team event or your own theme',
      name: 'Full name', email: 'Email', phone: 'Phone (optional)', note: 'Additional wishes (optional)',
      consent: 'I agree that LOVE Creative may use these details to handle my enquiry, in accordance with the',
      privacy: 'privacy policy', submit: 'Send enquiry', sending: 'Sending …',
      disclaimer: 'This is a non-binding enquiry, not a confirmed reservation. We will discuss availability and details with you.',
      success: 'Enquiry received', successBody: 'Thank you! We will review your request and get back to you. Your date is not confirmed yet.',
      uncertain: 'Receipt not confirmed', uncertainBody: 'We could not confirm delivery. Please contact hello@lovecreative.ch and include the reference if available. Please do not send the enquiry more than once.',
      preview: 'Preview – nothing sent', previewBody: 'This is a local preview only. No enquiry was saved or sent.',
      reference: 'Reference: ', required: 'Please complete the required fields.', badDate: 'Please choose a valid date from today onwards.',
      holiday: 'Enquiries are not available on statutory Zurich public holidays. Please choose another day.',
      time: 'Please choose a start time between 10:00 and 21:00.', endTime: 'The end time must be after the start time and no later than 21:00.',
      past: 'This time has already passed. Please choose a later time.', people: 'Please enter a whole number of people, with a minimum of 6.',
      badEmail: 'Please enter a valid email address.', consentError: 'Please confirm consent to using your details.',
      dateAvailable: 'You can enquire about this date. Availability still needs to be checked.'
    }
  };
  const esc = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  function zurichNow(date = new Date()) {
    const p = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Zurich', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(date).filter(x => x.type !== 'literal').map(x => [x.type, x.value]));
    return { date: `${p.year}-${p.month}-${p.day}`, minutes: Number(p.hour) * 60 + Number(p.minute) };
  }
  function dateValid(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const d = new Date(value + 'T12:00:00Z');
    return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
  }
  const minutes = value => /^\d{2}:\d{2}$/.test(value) && Number(value.slice(0, 2)) < 24 && Number(value.slice(3)) < 60 ? Number(value.slice(0, 2)) * 60 + Number(value.slice(3)) : NaN;
  function bounded(promise, waitMs = 20000) {
    let timer;
    return Promise.race([promise, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Receipt not confirmed')), waitMs); })]).finally(() => clearTimeout(timer));
  }
  function personCount(value) {
    const n = Number(value);
    return Number.isSafeInteger(n) && n >= MIN_PEOPLE ? n : null;
  }
  function validate(data, isHoliday, now = zurichNow()) {
    if (!dateValid(data.date) || data.date < now.date) return 'badDate';
    if (isHoliday(data.date)) return 'holiday';
    const start = minutes(data.start), end = minutes(data.end || '');
    if (!Number.isFinite(start) || start < 600 || start > 1260) return 'time';
    if (data.date === now.date && start <= now.minutes) return 'past';
    if (data.end && (!Number.isFinite(end) || end <= start || end > 1260)) return 'endTime';
    if (personCount(data.persons) === null) return 'people';
    if (!data.name.trim() || !data.motif.trim()) return 'required';
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(data.email)) return 'badEmail';
    if (!data.consent) return 'consentError';
    return '';
  }
  function payload(data, lang) {
    const persons = personCount(data.persons);
    if (persons === null) throw new RangeError('A special enquiry requires at least 6 people (whole number).');
    return {
      type: 'event', world: 'Spezielle Anfrage', name: data.name.trim(), email: data.email.trim(), phone: data.phone.trim(),
      date: data.date, time: data.start + (data.end ? '–' + data.end : ''), persons, lang,
      message: [
        '[Spezielle Anfrage – unverbindlich]', 'Anlass / Motiv: ' + data.motif.trim(),
        'Wunschdatum: ' + data.date, 'Gewünschter Beginn: ' + data.start + ' (Europe/Zurich)',
        data.end ? 'Gewünschtes Ende: ' + data.end : 'Endzeit / Dauer: noch abzusprechen',
        'Anzahl Personen: ' + persons, data.note.trim() ? 'Weitere Wünsche: ' + data.note.trim() : ''
      ].filter(Boolean).join('\n')
    };
  }
  function markup(lang = 'de') {
    const x = COPY[lang] || COPY.de;
    const field = (id, key, type, attrs = '') => `<label class="ls-field" for="ls-${id}"><span data-ls-text="${key}">${esc(x[key])}</span><input id="ls-${id}" name="${id}" type="${type}" ${attrs}></label>`;
    return `<h2 id="ls-title" tabindex="-1" data-ls-text="title">${esc(x.title)}</h2>
      <p class="ls-intro" data-ls-text="intro">${esc(x.intro)}</p><p class="ls-hours" data-ls-text="hours">${esc(x.hours)}</p>
      <form id="ls-form" novalidate>
        <div class="ls-grid">${field('date', 'date', 'date', 'required')}${field('persons', 'persons', 'number', `min="${MIN_PEOPLE}" value="${MIN_PEOPLE}" step="1" inputmode="numeric" required`)}</div>
        <p class="ls-hint" id="ls-date-hint" aria-live="polite"></p>
        <div class="ls-grid">${field('start', 'start', 'time', 'min="10:00" max="21:00" step="60" required')}${field('end', 'end', 'time', 'min="10:00" max="21:00" step="60"')}</div>
        ${field('motif', 'motif', 'text', `maxlength="300" placeholder="${esc(x.motifPlaceholder)}" required`)}
        ${field('name', 'name', 'text', 'maxlength="150" autocomplete="name" required')}
        <div class="ls-grid">${field('email', 'email', 'email', 'maxlength="254" autocomplete="email" required')}${field('phone', 'phone', 'tel', 'maxlength="50" autocomplete="tel"')}</div>
        <label class="ls-field" for="ls-note"><span data-ls-text="note">${esc(x.note)}</span><textarea id="ls-note" name="note" rows="2" maxlength="2000"></textarea></label>
        <label class="ls-consent"><input id="ls-consent" type="checkbox" required><span><span data-ls-text="consent">${esc(x.consent)}</span> <a href="datenschutz.html" target="_blank" rel="noopener" data-ls-text="privacy">${esc(x.privacy)}</a>.</span></label>
        <p class="ls-disclaimer" data-ls-text="disclaimer">${esc(x.disclaimer)}</p>
        <p id="ls-error" class="ls-error" role="alert"></p>
        <button class="ls-submit" id="ls-submit" type="submit" data-ls-text="submit">${esc(x.submit)}</button>
      </form><section id="ls-result" hidden aria-live="polite"><h3 id="ls-result-title" tabindex="-1"></h3><p id="ls-result-body"></p><p id="ls-reference"></p></section>`;
  }
  const API = { COPY, MIN_PEOPLE, personCount, zurichNow, dateValid, minutes, validate, payload, markup, bounded };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  root.LoveSpecialRequest = API;
  if (typeof document === 'undefined' || !root.LoveSite || !root.LoveTables) return;
  const sheet = document.getElementById('lwSheet');
  if (!sheet || document.getElementById('ls-toggle')) return;
  const scroll = sheet.querySelector('.lw-scroll');
  const toggle = document.createElement('button');
  toggle.id = 'ls-toggle'; toggle.type = 'button'; toggle.className = 'ls-toggle'; toggle.setAttribute('aria-controls', 'ls-pane'); toggle.setAttribute('aria-expanded', 'false');
  sheet.querySelector('.lw-head').insertAdjacentElement('afterend', toggle);
  const pane = document.createElement('section');
  pane.id = 'ls-pane'; pane.className = 'ls-pane'; pane.hidden = true; pane.setAttribute('aria-labelledby', 'ls-title');
  pane.innerHTML = markup(root.LoveSite.lang()); scroll.append(pane);
  const $ = id => document.getElementById('ls-' + id);
  const state = { active: false, busy: false, attempted: false, result: null, error: '' };
  const lang = () => root.LoveSite.lang() === 'en' ? 'en' : 'de';
  const x = () => COPY[lang()];
  const read = () => Object.assign(Object.fromEntries(['date', 'start', 'end', 'persons', 'motif', 'name', 'email', 'phone', 'note'].map(k => [k, $(k).value.trim()])), { consent: $('consent').checked });
  function dateHint() {
    const d = $('date').value;
    $('date').min = zurichNow().date;
    $('date-hint').textContent = !d ? '' : !dateValid(d) || d < zurichNow().date ? x().badDate : root.LoveTables.isHoliday(d) ? x().holiday : x().dateAvailable;
  }
  function translate() {
    pane.querySelectorAll('[data-ls-text]').forEach(el => { el.textContent = x()[el.dataset.lsText]; });
    toggle.textContent = state.active ? x().back : x().button;
    $('motif').placeholder = x().motifPlaceholder;
    $('error').textContent = state.error ? x()[state.error] : '';
    if (state.busy) $('submit').textContent = x().sending;
    dateHint();
    if (state.result) renderResult();
  }
  function setActive(active, focus = true) {
    state.active = active; pane.hidden = !active;
    sheet.classList.toggle('lw-special-active', active);
    toggle.setAttribute('aria-expanded', String(active)); toggle.textContent = active ? x().back : x().button;
    if (active) {
      const cal = document.getElementById('lwCal'); if (cal) cal.classList.add('hidden');
      const dateButton = document.getElementById('lwDateBtn'); if (dateButton) dateButton.setAttribute('aria-expanded', 'false');
      dateHint(); scroll.scrollTop = 0;
      if (focus) $('title').focus({ preventScroll: true });
    } else if (focus) toggle.focus({ preventScroll: true });
  }
  function renderResult() {
    const kind = state.result.preview ? 'preview' : state.result.delivered ? 'success' : 'uncertain';
    $('form').hidden = true; $('result').hidden = false;
    $('result-title').textContent = x()[kind]; $('result-body').textContent = x()[kind + 'Body'];
    $('reference').textContent = state.result.id ? x().reference + state.result.id : '';
  }
  toggle.addEventListener('click', () => setActive(!state.active));
  $('date').addEventListener('input', dateHint);
  $('form').addEventListener('submit', async e => {
    e.preventDefault();
    if (state.busy || state.attempted) return;
    const data = read(), error = validate(data, root.LoveTables.isHoliday);
    state.error = error;
    $('error').textContent = error ? x()[error] : '';
    if (error) { $('error').scrollIntoView({ block: 'nearest' }); return; }
    state.busy = true; state.attempted = true; $('submit').disabled = true; $('submit').textContent = x().sending;
    try {
      if (root.LOVE_SPECIAL_REQUEST_PREVIEW === true) {
        state.result = { preview: true, delivered: false, id: '' };
      } else {
        if (typeof LoveData === 'undefined' || typeof LoveData.addRegistration !== 'function') throw new Error('Inquiry client unavailable');
        const result = await bounded(LoveData.addRegistration(payload(data, lang())));
        state.result = { delivered: result.delivered === true, id: result.booking && result.booking.id || '' };
      }
    } catch (_) { state.result = { delivered: false, id: '' }; }
    state.busy = false; renderResult();
    if (state.active && sheet.classList.contains('open')) $('result-title').focus({ preventScroll: true });
  });
  // Do not reopen or steal focus if the guest closes the sheet while a request is pending.
  new MutationObserver(() => { if (!sheet.classList.contains('open') && state.active) setActive(false, false); }).observe(sheet, { attributes: true, attributeFilter: ['class'] });
  document.addEventListener('love:lang', translate);
  translate();
})(typeof window !== 'undefined' ? window : globalThis);
