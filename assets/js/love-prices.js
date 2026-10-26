/* LOVE Creative — price example; no booking or payment side effects. */
(() => {
let selected='S',price=18;
function summary(){const language=LoveSite.lang();document.getElementById('calculation').textContent='CHF 25 '+(language==='de'?'Service + CHF ':'service + CHF ')+price+(language==='de'?' Keramik (':' pottery (')+selected+')';document.getElementById('total').textContent='CHF '+(25+price);}
document.querySelectorAll('[data-size]').forEach(b=>b.addEventListener('click',()=>{selected=b.dataset.size;price=Number(b.dataset.price);document.querySelectorAll('[data-size]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));summary();}));
document.addEventListener('love:lang',summary);summary();
})();
