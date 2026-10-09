/* Native packaging only. Browsers never load the generated Capacitor adapter. */
(function () {
  if (!window.Capacitor || !window.Capacitor.isNativePlatform()) return;
  const script=document.createElement('script');
  script.src='native-bridge.js';
  script.onerror=()=>console.error('NYMERIA native navigation adapter could not load.');
  document.head.append(script);
})();
