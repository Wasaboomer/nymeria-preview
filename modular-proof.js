/* Opt-in visual proof. Selection is ephemeral and never writes gameplay stores. */
(() => {
  if (new URLSearchParams(location.search).get('kaelith') !== '1') return;
  const panel = document.querySelector('#panel-character');
  const stage = panel.querySelector('.stage');
  const definitions = {
    torso: {label:'Torso',choices:{ranger:'Ranger',peasant:'Peasant'}},
    arms: {label:'Braccia e guanti',choices:{ranger:'Ranger',peasant:'Peasant'}},
    legs: {label:'Gambe',choices:{ranger:'Ranger',peasant:'Peasant'}},
    boots: {label:'Stivali',choices:{ranger:'Ranger',peasant:'Peasant'}},
    shoulders: {label:'Spallacci',choices:{ranger:'Ranger',none:'Nessuno'}},
    weapon: {label:'Arma provvisoria',choices:{sword:'Spada',staff:'Bastone'}}
  };
  const selection = {torso:'ranger',arms:'ranger',legs:'ranger',boots:'ranger',shoulders:'ranger',weapon:'sword'};
  const controls = document.createElement('section');
  controls.className = 'modular-proof';
  controls.setAttribute('aria-label', 'Prova di personalizzazione visibile');
  controls.innerHTML = `<h2>Personalizzazione visibile</h2>
    <p>Prova i componenti 3D disponibili. Kaelith rimane il riferimento artistico.</p>
    <div class="proof-mode"><button type="button" data-proof-mode="reference" aria-pressed="true">Kaelith · riferimento</button><button type="button" data-proof-mode="modular" aria-pressed="false">Prova modulare</button></div>
    <div class="proof-options" hidden>
      <fieldset><legend>Tenute complete</legend><button type="button" data-proof-armor="ranger" aria-pressed="true">Tutto Ranger</button><button type="button" data-proof-armor="peasant" aria-pressed="false">Tutto Peasant</button></fieldset>
      <div class="proof-slot-grid">${Object.entries(definitions).map(([slot,d]) => `<label>${d.label}<select data-proof-slot="${slot}" aria-label="${d.label}">${Object.entries(d.choices).map(([id,label]) => `<option value="${id}">${label}</option>`).join('')}</select></label>`).join('')}</div>
      <p>Cambia ogni parte separatamente. La selezione modifica solo l’anteprima; equipaggiamento e statistiche del gioco restano quelli della scheda.</p>
    </div><p class="proof-status" role="status" aria-live="polite">Riferimento originale di Kaelith.</p>`;
  stage.before(controls);
  const options = controls.querySelector('.proof-options');
  const status = controls.querySelector('.proof-status');
  let mode = 'reference', viewer;
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
  function syncControls() {
    controls.querySelectorAll('[data-proof-slot]').forEach(select => { select.value = selection[select.dataset.proofSlot]; });
    const ranger = ['torso','arms','legs','boots','shoulders'].every(slot => selection[slot] === 'ranger');
    const peasant = ['torso','arms','legs','boots'].every(slot => selection[slot] === 'peasant') && selection.shoulders === 'none';
    controls.querySelectorAll('[data-proof-armor]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.proofArmor === 'ranger' ? ranger : peasant)));
  }
  function applySelection() {
    if (!viewer?.loaded || !viewer.model) return;
    // Every component has its own material. Transparent alternatives stay hidden
    // without changing identity geometry or downloading another model.
    for (const material of viewer.model.materials) {
      if (!material.name.startsWith('slot:')) continue;
      const [,slot,variant] = material.name.split(':');
      const factor = [...material.pbrMetallicRoughness.baseColorFactor];
      factor[3] = selection[slot] === variant ? 1 : 0;
      material.setAlphaMode(selection[slot] === variant ? 'OPAQUE' : 'BLEND');
      material.pbrMetallicRoughness.setBaseColorFactor(factor);
    }
    viewer.alt = 'Personaggio modulare femminile. ' + Object.entries(definitions).map(([slot,d]) => `${d.label}: ${d.choices[selection[slot]]}`).join('; ');
    if (mode === 'modular') status.textContent = 'Anteprima aggiornata per singoli slot. Trascina il personaggio per ruotare.';
  }
  function selectModel() {
    if (!viewer.src) {
      viewer.src = 'assets/modular-proof/slots-combined.glb';
      status.textContent = 'Caricamento dei componenti…';
    } else applySelection();
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
        viewer.addEventListener('load', applySelection);
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
    if (button.dataset.proofArmor) {
      const preset = button.dataset.proofArmor;
      for (const slot of ['torso','arms','legs','boots']) selection[slot] = preset;
      selection.shoulders = preset === 'ranger' ? 'ranger' : 'none';
      syncControls();
      applySelection();
    }
  });
  controls.addEventListener('change', event => {
    const slot = event.target.dataset.proofSlot;
    if (!definitions[slot] || !(event.target.value in definitions[slot].choices)) return;
    selection[slot] = event.target.value;
    syncControls();
    applySelection();
  });
  syncControls();
})();
