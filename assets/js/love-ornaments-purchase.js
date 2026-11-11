/* Event-specific checkout. Injected transport and storage keep tests offline. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.LoveOrnamentsPurchase=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const EVENT=Object.freeze({dates:['2026-11-14','2026-11-20'],priceCents:8900,capacity:20});
const KEY='love-ornaments-checkout-v1';
function validate(x){
  const persons=Number(x.persons);
  if(!Number.isSafeInteger(persons)||persons<1||persons>EVENT.capacity)throw Error('invalid-persons');
  if(!EVENT.dates.includes(x.date))throw Error('invalid-event');
  if(!String(x.name||'').trim()||!String(x.phone||'').trim()||!/^\S+@[^\s@]+\.[^\s@]+$/.test(String(x.email||'').trim()))throw Error('invalid-contact');
  if(x.terms!==true||x.privacy!==true)throw Error('consent');
  return {type:'ornaments',date:x.date,name:x.name.trim(),email:x.email.trim(),phone:x.phone.trim(),persons,lang:x.lang==='en'?'en':'de',terms_accepted:true,privacy_accepted:true};
}
function createAdapter({enabled=false,call,storage,randomBytes,navigate}){
  let saved=null,busy=false;
  try{saved=JSON.parse(storage.getItem(KEY)||'null');if(saved&&!/^B-[A-F0-9]{20}$/i.test(saved.id))throw Error('invalid-storage');}catch(_){saved={state:'uncertain'};}
  function persist(value){storage.setItem(KEY,JSON.stringify(value));saved=value;}
  function ready(){if(!enabled)throw Error('event-not-configured');}
  async function request(action,data){ready();const r=await call(action,data);if(!r||r.ok!==true)throw Error(r&&r.error||'network');return r;}
  async function status(){if(!saved||!saved.token)throw Error('booking-check-required');return request('ornament_booking_status',{code:saved.id,checkout_token:saved.token});}
  async function checkout(){
    if(!saved||!saved.token)throw Error('booking-check-required');
    const current=await status();
    if(current.paid===true)return current;
    if(current.expired===true)throw Error('hold-expired');
    if(['storniert','abgelehnt','verloren','cancelled','expired','failed'].includes(current.status))throw Error('payment-closed');
    const r=await request('ornament_gateway_create',{code:saved.id,checkout_token:saved.token});
    let url;try{url=new URL(r.link);}catch(_){throw Error('payment-check-required');}
    if(url.protocol!=='https:'||!(url.hostname==='payrexx.com'||url.hostname.endsWith('.payrexx.com'))||url.username||url.password)throw Error('payment-check-required');
    navigate(url.href);return r;
  }
  async function locked(fn){if(busy)throw Error('busy');busy=true;try{return await fn();}finally{busy=false;}}
  return {
    enabled,hasPending:()=>!!saved,hasToken:()=>!!(saved&&saved.token),reference:()=>saved&&saved.id||'',
    availability:()=>request('ornament_availability'),status,
    purchase(input){return locked(async()=>{
      ready();if(saved)throw Error(saved.token?'pending-existing':'booking-check-required');
      const data=validate(input),bytes=randomBytes(10);
      const id='B-'+Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('').toUpperCase();
      // Persist before transmission. A lost response must not create another booking.
      try{persist({id,state:'uncertain'});}catch(_){throw Error('storage-required');}
      let r;try{r=await request('ornament_booking_add',{...data,id});}catch(e){
        if(['full','invalid-persons','invalid-contact','invalid-event','consent','terms-required','privacy-required','event-not-configured'].includes(e.message)){storage.removeItem(KEY);saved=null;}
        throw e;
      }
      if(r.id!==id||Number(r.amount)!==data.persons*EVENT.priceCents/100||! /^[a-f0-9]{64}$/i.test(r.checkout_token||''))throw Error('booking-check-required');
      // No contact data is retained in browser storage.
      const pending={id,token:r.checkout_token,state:'pending'};saved=pending;
      try{persist(pending);}catch(_){throw Error('storage-required');}
      return checkout();
    });},
    resume(){return locked(checkout);},
    startNew(){return locked(async()=>{
      // Fresh server verification, never a URL flag or cached UI state. Backend
      // expired=true guarantees that the expired hold has no active gateway.
      const current=await status();
      if(current.paid!==true&&current.expired!==true)throw Error('pending-existing');
      try{storage.removeItem(KEY);}catch(_){throw Error('storage-required');}
      saved=null;
      return {ok:true};
    });},
    get busy(){return busy;}
  };
}
return {EVENT,KEY,validate,createAdapter};
});
