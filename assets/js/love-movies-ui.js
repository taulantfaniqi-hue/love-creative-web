(()=>{'use strict';
const d=document.getElementById('purchase-dialog'),f=document.getElementById('purchase-form'),fields=document.getElementById('purchase-fields'),submit=document.getElementById('purchase-submit'),err=document.getElementById('purchase-error'),result=document.getElementById('purchase-result'),resume=document.getElementById('purchase-resume'),check=document.getElementById('purchase-check'),availability=document.getElementById('availability'),adapter=window.MoviesAdapter;
const newBooking=document.getElementById('purchase-new');
let available=null,statusBusy=false;
const en=()=>document.documentElement.lang==='en',say=(de,english)=>en()?english:de;
const errors={
 'event-not-configured':['Die Onlinebuchung wird in Kürze freigeschaltet.','Online booking will open soon.'],
 'full':['Leider sind nicht mehr genügend Plätze verfügbar. Bitte wähle einen anderen Termin.','There are not enough places available. Please choose another date.'],
 'pending-existing':['Bitte setze deinen bestehenden Checkout fort.','Please resume your existing checkout.'],
 'booking-check-required':['Deine Anfrage muss geprüft werden. Bitte kontaktiere hello@lovecreative.ch, bevor du erneut buchst.','Your request needs checking. Please contact hello@lovecreative.ch before booking again.'],
 'payment-check-required':['Bitte lasse den Zahlungsstatus von hello@lovecreative.ch prüfen.','Please ask hello@lovecreative.ch to check your payment status.'],
 'hold-expired':['Deine Reservierungsfrist ist abgelaufen. Es gibt keinen aktiven Zahlungslink. Prüfe den Status und starte bei Bedarf eine neue Buchung.','Your reservation hold has expired. There is no active payment link. Check the status and start a new booking if needed.'],
 'privacy-required':['Bitte bestätige den Datenschutz.','Please confirm the privacy policy.'],
 'terms-required':['Bitte akzeptiere die AGB, um fortzufahren.','Please accept the terms and conditions to continue.'],
 'consent':['Bitte bestätige die AGB und den Datenschutz.','Please confirm the terms and privacy policy.'],
 'invalid-persons':['Bitte wähle eine gültige Anzahl Personen.','Please choose a valid number of people.'],
 'invalid-contact':['Bitte prüfe deinen Namen, deine E-Mail-Adresse und Telefonnummer.','Please check your name, email address and phone number.'],
 'invalid-event':['Bitte wähle einen gültigen Termin.','Please select a valid event date.'],
 'storage-required':['Bitte erlaube Sitzungsspeicherung im Browser. Falls du schon gebucht hast, kontaktiere uns vor einem weiteren Versuch.','Please allow session storage in your browser. If you already submitted a booking, contact us before trying again.'],
 'payment-closed':['Dieser Checkout ist geschlossen. Bitte kontaktiere uns.','This checkout is closed. Please contact us.']
};
function showError(code){err.textContent=(errors[code]||['Der Vorgang konnte nicht abgeschlossen werden. Es wurde keine Zahlung bestätigt. Bitte prüfe den Status oder kontaktiere uns.','The request could not be completed. No payment has been confirmed. Please check the status or contact us.'])[en()?1:0];if(adapter.reference())err.textContent+=' '+adapter.reference();}
function update(){
 const n=Number(f.elements.persons.value),entry=available&&available.find(x=>x.date===f.elements.date.value);
 document.getElementById('purchase-total').textContent=Number.isInteger(n)&&n>0&&Number.isSafeInteger(n)?'CHF '+(n*55).toFixed(2):'—';
 availability.textContent=!adapter.enabled?say('Onlinebuchung noch nicht freigeschaltet.','Online booking is not open yet.'):entry?say(entry.remaining+' Plätze verfügbar.',''+entry.remaining+' places available.'):say('Verfügbarkeit wird geprüft.','Checking availability.');
 submit.disabled=!adapter.enabled||!entry||!Number.isSafeInteger(n)||n<1||n>entry.remaining||entry.remaining<1||adapter.busy;
 if(entry)f.elements.persons.max=Math.max(1,entry.remaining);else f.elements.persons.removeAttribute('max');
 for(const option of f.elements.date.options){const row=available&&available.find(x=>x.date===option.value);option.disabled=!!row&&row.remaining===0;}
}
async function refresh(){available=null;update();if(!adapter.enabled)return;try{const r=await adapter.availability();if(r.price_cents!==5500||!Array.isArray(r.dates)||!LoveMoviesPurchase.EVENT.dates.every(date=>r.dates.some(x=>x.date===date&&x.capacity===LoveMoviesPurchase.EVENT.capacity&&Number.isInteger(x.remaining)&&x.remaining>=0&&x.remaining<=x.capacity)))throw Error('event-not-configured');available=r.dates;update();}catch(e){showError(e.message);availability.textContent=say('Verfügbarkeit konnte nicht geladen werden.','Availability could not be loaded.');}}
async function status(){
 if(statusBusy)return;statusBusy=true;f.hidden=true;resume.hidden=true;newBooking.hidden=true;check.hidden=false;check.disabled=true;
 try{const r=await adapter.status();const paid=r.paid===true;result.textContent=paid?say('Zahlung bestätigt. Deine Plätze sind gebucht.','Payment confirmed. Your places are booked.'):say('Noch keine bestätigte Zahlung. Prüfe den Status, bevor du erneut bezahlst.','No confirmed payment yet. Check the status before paying again.');
 if(paid&&LoveMoviesPurchase.EVENT.dates.includes(r.date)&&Number.isInteger(r.persons)&&r.persons>0&&Number.isSafeInteger(r.persons)){
   const date=new Intl.DateTimeFormat(en()?'en-GB':'de-CH',{day:'numeric',month:'long',year:'numeric',timeZone:'Europe/Zurich'}).format(new Date(r.date+'T12:00:00Z'));
   result.textContent=say('Zahlung bestätigt: '+r.persons+' Person(en) am '+date+', 18:30 Uhr.','Payment confirmed: '+r.persons+' guest(s) on '+date+', 6:30 pm.');
   // Display only a validated server total (CHF major units).
   if(Number.isFinite(Number(r.amount))&&Number(r.amount)===r.persons*55)result.textContent+=' CHF '+Number(r.amount).toFixed(2)+'.';
 }
 if(!paid&&r.expired===true)result.textContent=say('Deine Reservierungsfrist ist abgelaufen. Es gibt keinen aktiven Zahlungslink. Du kannst eine neue Buchung starten.','Your reservation hold has expired. There is no active payment link. You can start a new booking.');
 if(adapter.reference())result.textContent+=' '+adapter.reference();
 newBooking.hidden=!(paid||r.expired===true);
 resume.hidden=paid||r.expired===true||['storniert','abgelehnt','verloren','cancelled','expired','failed'].includes(r.status);
 }catch(e){showError(e.message);}finally{statusBusy=false;check.disabled=false;}
}
document.getElementById('release-note').hidden=adapter.enabled;
document.querySelectorAll('[data-purchase]').forEach(button=>button.addEventListener('click',()=>{if(!d.open)d.showModal();err.textContent='';if(adapter.hasPending())status();else refresh();}));
d.querySelector('[data-close-purchase]').addEventListener('click',()=>d.close());
f.addEventListener('input',update);f.elements.date.addEventListener('change',update);
f.addEventListener('submit',async e=>{e.preventDefault();if(adapter.busy||submit.disabled||!f.reportValidity())return;
 const data=Object.fromEntries(new FormData(f));data.terms=f.elements.terms.checked;data.privacy=f.elements.privacy.checked;data.lang=en()?'en':'de';
 fields.disabled=true;err.textContent='';
 try{const r=await adapter.purchase(data);if(r.paid===true)await status();}catch(e){showError(e.message);if(adapter.hasPending()){f.hidden=true;check.hidden=!adapter.hasToken();resume.hidden=true;}else if(e.message==='full')await refresh();}finally{fields.disabled=false;update();}
});
resume.addEventListener('click',async()=>{resume.disabled=true;err.textContent='';try{const r=await adapter.resume();if(r.paid===true)await status();}catch(e){showError(e.message);resume.hidden=true;}finally{resume.disabled=false;}});
check.addEventListener('click',()=>{err.textContent='';status();});
newBooking.addEventListener('click',async()=>{
 newBooking.disabled=true;err.textContent='';
 try{await adapter.startNew();f.reset();f.hidden=false;result.textContent='';resume.hidden=true;check.hidden=true;newBooking.hidden=true;
   // Remove old return flags so a reload cannot be mistaken for a new payment.
   const url=new URL(location.href);for(const key of ['paid','payfail','cancel'])url.searchParams.delete(key);history.replaceState(null,'',url.href);
   await refresh();f.elements.date.focus();
 }catch(e){showError(e.message);}finally{newBooking.disabled=false;}
});
document.addEventListener('love:lang',()=>{update();if(d.open&&adapter.hasToken())status();});
const q=new URLSearchParams(location.search);
if(q.has('paid')||q.has('payfail')||q.has('cancel')||adapter.hasPending()){d.showModal();if(adapter.hasPending())status();else result.textContent=say('Die Zahlung kann in diesem Browser nicht geprüft werden. Bitte prüfe deine Bestätigungs-E-Mail oder kontaktiere uns.','Payment cannot be verified in this browser. Please check your confirmation email or contact us.');}
update();
})();
