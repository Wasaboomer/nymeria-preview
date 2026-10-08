/* Opt-in visual proof. Selection is ephemeral and never writes gameplay stores. */
(() => {
  if (new URLSearchParams(location.search).get('kaelith') !== '1') return;
  const panel = document.querySelector('#panel-character');
  const stage = panel.querySelector('.stage');
  const controls = document.createElement('section');
  controls.className = 'modular-proof';
  controls.setAttribute('aria-label', 'Prova di personalizzazione visibile');
  controls.innerHTML = `<h2>Personalizzazione visibile</h2>
    <p>Prova i componenti 3D disponibili. Kaelith rimane il riferimento artistico.</p>
    <div class="proof-mode"><button type="button" data-proof-mode="reference" aria-pressed="true">Kaelith · riferimento</button><button type="button" data-proof-mode="modular" aria-pressed="false">Prova modulare</button></div>
    <div class="proof-options" hidden>
      <fieldset><legend>Abito / protezione</legend><button type="button" data-proof-armor="ranger" aria-pressed="true">Tenuta Ranger</button><button type="button" data-proof-armor="peasant" aria-pressed="false">Tunica Peasant</button></fieldset>
      <fieldset><legend>Arma provvisoria</legend><button type="button" data-proof-weapon="sword" aria-pressed="true">Spada</button><button type="button" data-proof-weapon="staff" aria-pressed="false">Bastone</button></fieldset>
      <p>Due abiti dai pacchetti Standard; armi semplici create per questa prova. La selezione modifica solo l’anteprima, senza equipaggiare oggetti o cambiare statistiche.</p>
    </div><p class="proof-status" role="status" aria-live="polite">Riferimento originale di Kaelith.</p>`;
  stage.before(controls);
  const options = controls.querySelector('.proof-options');
  const status = controls.querySelector('.proof-status');
  let mode = 'reference', armor = 'ranger', weapon = 'sword', viewer;
  let libraryPromise;
  function loadLibrary() {
    if (!libraryPromise) libraryPromise = new Promise((resolve, reject) => {
      if (customElements.get('model-viewer')) return resolve();
      const script = document.createElement('script');
      script.type = 'module'; script.src = 'vendor/model-viewer-4.1.0.min.js';
      script.addEventListener('error', reject, {once:true});
      script.addEventListener('load', () => customElements.whenDefined('model-viewer').then(resolve), {once:true});
      document.head.append(script);
    });
    return libraryPromise;
  }
  function updateStatus() {
    if (mode !== 'modular') return;
    const expected = new URL(`assets/modular-proof/${armor}-${weapon}.glb`, document.baseURI).href;
    if (viewer.loaded && new URL(viewer.src, document.baseURI).href === expected)
      status.textContent = `${armor === 'ranger' ? 'Tenuta Ranger' : 'Tunica Peasant'} · ${weapon === 'sword' ? 'Spada' : 'Bastone'}. Trascina per ruotare.`;
  }
  function selectModel() {
    const next = `assets/modular-proof/${armor}-${weapon}.glb`;
    if (viewer.src && new URL(viewer.src, document.baseURI).href === new URL(next, document.baseURI).href && viewer.loaded) { updateStatus(); return; }
    viewer.src = next;
    viewer.alt = `Personaggio modulare femminile: ${armor === 'ranger' ? 'tenuta Ranger' : 'tunica Peasant'}, ${weapon === 'sword' ? 'spada' : 'bastone'}`;
    status.textContent = 'Caricamento della personalizzazione…';
  }
  async function setMode(next) {
    mode = next;
    controls.querySelectorAll('[data-proof-mode]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.proofMode === mode)));
    options.hidden = mode !== 'modular';
    stage.classList.toggle('modular-proof-active', mode === 'modular');
    if (mode === 'reference') { status.textContent = 'Riferimento originale di Kaelith.'; return; }
    status.textContent = 'Caricamento della prova 3D…';
    try {
      await loadLibrary();
      if (mode !== 'modular') return;
      if (!viewer) {
        viewer = document.createElement('model-viewer');
        viewer.id = 'modular-proof-viewer';
        viewer.setAttribute('loading', 'eager');
        viewer.setAttribute('camera-controls', ''); viewer.setAttribute('disable-pan', '');
        viewer.setAttribute('touch-action', 'pan-y');
        viewer.setAttribute('camera-orbit', '0deg 85deg 115%');
        viewer.setAttribute('camera-target', 'auto auto auto');
        viewer.setAttribute('field-of-view', '35deg');
        viewer.setAttribute('max-camera-orbit', 'auto auto 200%');
        viewer.setAttribute('shadow-intensity', '0.7');
        viewer.setAttribute('environment-image', 'neutral');
        viewer.setAttribute('interaction-prompt', 'none');
        viewer.addEventListener('load', updateStatus);
        viewer.addEventListener('error', () => { status.textContent = 'Anteprima 3D non disponibile. Puoi tornare al riferimento di Kaelith.'; });
        stage.append(viewer);
      }
      selectModel();
    } catch { status.textContent = 'Impossibile avviare la prova 3D. Torna al riferimento di Kaelith.'; }
  }
  controls.addEventListener('click', event => {
    const button = event.target.closest('button');
    if (!button) return;
    if (button.dataset.proofMode) { setMode(button.dataset.proofMode); return; }
    if (button.dataset.proofArmor) armor = button.dataset.proofArmor;
    if (button.dataset.proofWeapon) weapon = button.dataset.proofWeapon;
    controls.querySelectorAll('[data-proof-armor]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.proofArmor === armor)));
    controls.querySelectorAll('[data-proof-weapon]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.proofWeapon === weapon)));
    if (viewer) selectModel();
  });
})();
