/* Standalone viewer: no game scripts, game state or storage APIs. */
(function () {
  'use strict';
  var models = {
    base: {label: 'Base', src: 'assets/3d-comparison/base.glb'},
    peasant: {label: 'Peasant', src: 'assets/3d-comparison/peasant-with-head.glb'},
    ranger: {label: 'Ranger', src: 'assets/3d-comparison/ranger-with-head.glb'}
  };
  var viewer = document.getElementById('viewer');
  var status = document.getElementById('comparison-status');
  var buttons = document.querySelectorAll('[data-model]');
  var selected = 'base';
  function select(id) {
    if (!models[id] || id === selected) return;
    selected = id;
    viewer.alt = 'Personaggio ' + models[id].label;
    status.textContent = 'Caricamento ' + models[id].label + '…';
    buttons.forEach(function (button) { button.setAttribute('aria-pressed', String(button.dataset.model === id)); });
    viewer.setAttribute('src', models[id].src);
  }
  buttons.forEach(function (button) { button.addEventListener('click', function () { select(button.dataset.model); }); });
  viewer.addEventListener('load', function (event) {
    // Ignore a late event from a superseded load during rapid selections.
    var expected = new URL(models[selected].src, document.baseURI).href;
    var source = event.detail && event.detail.url;
    if (viewer.loaded && new URL(viewer.src, document.baseURI).href === expected && (!source || new URL(source, document.baseURI).href === expected))
      status.textContent = 'Modello caricato: ' + models[selected].label;
  });
  viewer.addEventListener('error', function () { status.textContent = 'Impossibile caricare ' + models[selected].label + '. Riprova ricaricando la pagina.'; });
  setTimeout(function () {
    if (!customElements.get('model-viewer')) status.textContent = 'Viewer 3D non disponibile. Verifica che JavaScript e WebGL siano abilitati.';
  }, 15000);
})();
