/* Isolated DEV presentation. Game state and the original SVG renderer remain intact. */
(() => {
  if (new URLSearchParams(location.search).get('kaelith') !== '1') return;
  const panel = document.getElementById('panel-character');
  if (!panel) return;
  panel.classList.add('kaelith-dev');
  const controls = document.createElement('nav');
  controls.className = 'kaelith-view-tabs';
  controls.setAttribute('aria-label', 'Vista di Kaelith');
  controls.innerHTML = '<button type="button" data-kaelith-view="character" aria-pressed="true">Personaggio</button><button type="button" data-kaelith-view="public" aria-pressed="false">Profilo pubblico</button>';
  const portrait = document.createElement('section');
  portrait.className = 'kaelith-portrait';
  portrait.innerHTML = '<img src="assets/kaelith-dev/portrait-2x-candidate.png" width="166" height="132" alt="Ritratto completo di Kaelith"><p>Ritratto 2× · candidato</p>';
  panel.prepend(controls, portrait);
  panel.querySelector('.identity h1').textContent = 'Kaelith';
  const identity = panel.querySelector('.identity p');
  if (identity?.firstChild?.nodeType === 3) identity.firstChild.textContent = 'Elfa del Vespro ';
  const stage = panel.querySelector('.stage');
  const figure = document.createElement('img');
  figure.className = 'kaelith-original-figure';
  figure.src = 'assets/kaelith-dev/full-original.png';
  figure.width = 231; figure.height = 335;
  figure.alt = 'Kaelith, figura originale con mantello, armatura e spada';
  stage.append(figure);
  stage.setAttribute('aria-label', 'Figura originale di Kaelith');
  stage.querySelector('.stage-heading').textContent = 'CUSTODE DELLE SOGLIE';
  stage.querySelector('.stage-caption').textContent = 'Aspetto di riferimento · equipaggiamento gestito nella scheda';
  controls.addEventListener('click', event => {
    const button = event.target.closest('[data-kaelith-view]');
    if (!button) return;
    const publicView = button.dataset.kaelithView === 'public';
    panel.classList.toggle('kaelith-public', publicView);
    panel.querySelector('.identity .eyebrow').textContent = publicView ? 'AVVENTURIERA DEL VESPRO' : 'IL TUO PERSONAGGIO';
    controls.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(b === button)));
  });
})();
