/* Presentation-only locality sections. Reuses live World/Quest/Profession controls. */
(function () {
  var selected = {}, lastLocation = null;
  var names = {overview:'Panoramica',missions:'Missioni',encounters:'Incontri',gathering:'Raccolta',services:'Punti e servizi'};
  function render() {
    var nav = document.getElementById('locality-tabs'), detail = document.getElementById('world-location-detail');
    if (!nav || !detail || typeof ProgressionStore === 'undefined') return;
    var route = NymeriaNavigation.route, place = ProgressionStore.state.frontier.location;
    var visible = route.screen === 'world' && route.view === 'places' && !route.activity;
    nav.hidden = !visible;
    document.body.classList.toggle('locality-view',visible);
    if (route.activity === 'preparation') {
      ['world-current','world-tracked','world-location-detail'].forEach(function(id){document.getElementById(id).hidden=true;});
      document.querySelector('.world-shortcuts').hidden=true;
      return;
    }
    // WorldUI recreates these live nodes on each state render; never clone handlers/assets.
    var sections = {};
    Object.keys(names).forEach(function(id){var section=document.createElement('section');section.dataset.localitySection=id;section.id='locality-'+id;sections[id]=section;});
    Array.from(detail.children).forEach(function(child){
      var id=child.classList.contains('world-enemies') || child.dataset.worldSection==='encounters' || child.classList.contains('compatibility') || child.hasAttribute('data-world-equipment') ? 'encounters'
        : child.classList.contains('world-professions') || (child.matches('[data-world-explore]') && WorldData.location(place).points.find(function(point){return point.id===child.dataset.worldExplore && point.collect;})) ? 'gathering'
        : child.classList.contains('world-destinations') ? 'overview' : 'services';
      // Section headings are supplied below; omit the old flat-list headings.
      if(child.tagName==='H4')return;
      sections[id].append(child);
    });
    sections.missions.innerHTML='<button data-world-view="journal">Apri tutte le missioni →</button>';
    // Canonical tracker stays outside the rebuilt detail tree; it must survive future renders.
    var tracker=document.getElementById('world-tracked');
    tracker.dataset.localitySection='missions';
    tracker.hidden=!visible || selected[place]!=='missions';
    var current=document.getElementById('world-current');
    var description=current.querySelector('p');if(description)sections.overview.prepend(description);
    var available=Object.keys(names).filter(function(id){return id==='overview'||id==='missions'||sections[id].querySelector('button,article');});
    if(!available.includes(selected[place]))selected[place]='overview';
    nav.innerHTML=available.map(function(id){return '<button data-locality-tab="'+id+'" aria-controls="locality-'+id+'" aria-pressed="'+(selected[place]===id)+'">'+names[id]+'</button>';}).join('');
    detail.replaceChildren();
    available.forEach(function(id){var section=sections[id];var heading=document.createElement('h3');heading.textContent=names[id];section.prepend(heading);section.hidden=!visible||selected[place]!==id;detail.append(section);});
    document.getElementById('world-tracked').hidden=!visible||selected[place]!=='missions';
    document.querySelector('.world-shortcuts').hidden=!visible||selected[place]!=='overview';
    if(lastLocation!==place){lastLocation=place;document.getElementById('panel-world').scrollTop=0;}
  }
  document.addEventListener('nymeria:world-render',render);
  document.addEventListener('click',function(event){
    var button=event.target.closest('[data-locality-tab]');if(!button)return;
    selected[ProgressionStore.state.frontier.location]=button.dataset.localityTab;
    // Re-render through WorldUI: every section reflects the actual current state.
    WorldUI.render();document.getElementById('panel-world').scrollTop=0;
  });
})();
