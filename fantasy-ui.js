/* Sprint 2 decoration adapter. Read-only game data; no persistence, actions or new renderer. */
(function () {
  'use strict';
  const node = id => document.getElementById(id);
  const places = new Set(WorldData.locations.map(place => place.id));
  const roleIcons = {serah:'combat',oren:'world',mira:'discoveries',bram:'inventory',ilyen:'journal'};
  document.body.classList.add('nymeria-theme');
  function placeOn(element, id) {
    if (element && places.has(id) && element.dataset.nyPlace !== id) element.dataset.nyPlace = id;
  }
  function surfaces() {
    document.querySelectorAll('.stats,.xp-summary,#class-info,.world-enemy,.profession-card,.profession-action-card,.quest-card,.main-quest-panel,.slot-card,.world-result').forEach(element => element.classList.add('ny-surface'));
    document.querySelectorAll('.section-title h2,#world-location-detail > h4,#profession-root > h3,.journal-group > h4').forEach(element => element.classList.add('ny-heading'));
  }
  function world() {
    const frontier = ProgressionStore.state.frontier;
    let current = WorldData.location(frontier.location);
    if (current?.discoveryType && !(typeof WorldDiscovery !== 'undefined' && WorldDiscovery?.accessible(current.id))) current = WorldData.location('veyra');
    if (!current) return;
    placeOn(document.querySelector('.app'),current.id);
    const heading = node('world-current')?.querySelector('.world-place-heading');
    if (heading && !heading.parentElement.classList.contains('ny-place-banner')) {
      const frame = document.createElement('div'); frame.className = 'ny-place-banner';
      heading.before(frame); frame.append(heading); placeOn(frame,current.id);
    }
    document.querySelectorAll('[data-world-enter]').forEach(button => placeOn(button,button.dataset.worldEnter));
    document.querySelectorAll('.world-npc').forEach(card => {
      const button = card.querySelector('[data-world-talk]'), seal = card.querySelector('.npc-seal');
      const npc = button && WorldData.npcs.find(npc => npc.id === button.dataset.worldTalk);
      if (!npc) return;
      card.dataset.nyNpc = npc.id;
      if (seal && !seal.querySelector('svg')) {
        seal.innerHTML = VisualIcons.svg(roleIcons[npc.id] || 'character');
        seal.title = 'Emblema del ruolo · non un ritratto';
      }
      const dialogue = Array.from(card.children).find(element => element.tagName === 'P');
      if (dialogue) {
        dialogue.classList.add('ny-dialogue');
        if(!dialogue.querySelector('.ny-dialogue-name')) {
          const speaker=document.createElement('strong'); speaker.className='ny-dialogue-name';
          speaker.textContent=npc.name; dialogue.prepend(speaker);
        }
      }
      button.setAttribute('aria-pressed',String(!!dialogue));
    });
    document.querySelectorAll('.world-enemy').forEach(card => {
      const id = card.querySelector('[data-world-fight]')?.dataset.worldFight;
      const visual = VisualManifest.enemies[id];
      if (!visual) return; // No fabricated enemy art when the approved catalog has no asset.
      card.classList.add('ny-enemy-card');
      card.style.setProperty('--ny-enemy',`url("assets/enemies/${visual}.svg?v=m65-1")`);
    });
    battle(); surfaces();
  }
  function battle() {
    const frontier = ProgressionStore.state.frontier, ticket = frontier.activeEncounter;
    const arena = document.querySelector('.visual-battle-arena');
    if (arena) {
      arena.classList.add('ny-battle-vignette');
      placeOn(arena,ticket?.location || frontier.location);
    }
    const result = node('world-result');
    if (result) {
      result.classList.toggle('ny-result-victory',frontier.lastEncounter?.outcome === 'victory');
      result.classList.toggle('ny-result-defeat',frontier.lastEncounter?.outcome === 'defeat');
    }
  }
  function equipment() {
    const items = new Map(Equipment.state.inventory.map(item => [item.id,item]));
    document.querySelectorAll('.inventory-item').forEach(card => {
      const item = items.get(card.dataset.itemId);
      if (!item) return;
      card.dataset.nyItem = ['weapon','support'].includes(item.slot) ? 'weapons'
        : ['necklace','earring','bracelet','ring'].includes(item.slot) ? 'accessories' : 'armor';
    });
    surfaces();
  }
  function professions() {
    document.querySelectorAll('.profession-card > div:first-child').forEach(heading => {
      if (heading.querySelector('.ny-profession-seal')) return;
      const seal = document.createElement('span'); seal.className = 'ny-profession-seal'; seal.setAttribute('aria-hidden','true');
      seal.innerHTML = VisualIcons.svg('loot'); heading.prepend(seal);
    });
    surfaces();
  }
  function navigationIcons() {
    // Same original icon catalog. No replacement of character assets or existing navigation.
    for (const [id,icon] of [['tab-missions','journal'],['tab-inventory','inventory']]) {
      const element = node(id)?.querySelector('span:first-child');
      if (element && !element.querySelector('svg')) element.innerHTML = VisualIcons.svg(icon);
    }
  }
  document.addEventListener('click',event => {
    const button=event.target.closest('[data-world-talk]');
    if(button&&!button.disabled&&WorldData.npcs.some(npc=>npc.id===button.dataset.worldTalk))
      document.dispatchEvent(new CustomEvent('nymeria:content-focus',{detail:{selector:`[data-ny-npc="${button.dataset.worldTalk}"] .ny-dialogue`}}));
  });
  function refresh() { world(); equipment(); professions(); navigationIcons(); }
  document.addEventListener('nymeria:world-render',world);
  document.addEventListener('nymeria:navigation',refresh);
  // Subscribers read already-normalized states. They cannot grant, equip, travel or save.
  Equipment.subscribe(equipment);
  ProgressionStore.subscribe(refresh);
  ProfessionUI.engine.subscribe(professions);
  // Observe only replacement of top-level rows, not decorative child mutations.
  // This covers async workshop finally-render and filters without a frame loop.
  let decorationFrame = 0;
  const observer = new MutationObserver(() => {
    if (decorationFrame) return;
    decorationFrame = requestAnimationFrame(() => {
      decorationFrame = 0; equipment(); professions();
    });
  });
  for (const id of ['inventory-grid','equipment-grid','profession-root']) {
    const root = node(id); if (root) observer.observe(root,{childList:true});
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded',refresh);
  else refresh();
})();
