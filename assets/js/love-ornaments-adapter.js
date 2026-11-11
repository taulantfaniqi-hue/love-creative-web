/* Release gate: enable ONLY after matching backend, capacity, and payment tests pass. */
window.LOVE_ORNAMENTS_RELEASE={enabled:true};
window.OrnamentsAdapter=LoveOrnamentsPurchase.createAdapter({
  enabled:window.LOVE_ORNAMENTS_RELEASE.enabled,
  call:(action,data)=>LoveCloud.call(action,data),
  storage:{getItem:key=>sessionStorage.getItem(key),setItem:(key,value)=>sessionStorage.setItem(key,value),removeItem:key=>sessionStorage.removeItem(key)},
  randomBytes:n=>crypto.getRandomValues(new Uint8Array(n)),
  navigate:url=>location.assign(url)
});
