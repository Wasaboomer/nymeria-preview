/* Presentation-only locality sections. Reuses live World/Quest/Profession controls. */
(function () {
  var lastLocation = null;
  function render() {
    var detail = document.getElementById('world-location-detail');
    if (!detail || typeof ProgressionStore === 'undefined') return;
    var route = NymeriaNavigation.route, place = ProgressionStore.state.frontier.location;
    var visible = route.screen === 'world' && route.view === 'places' && !route.activity;
    document.body.classList.toggle('locality-view',visible);
    if (route.activity === 'preparation') {
      ['world-current','world-tracked','world-location-detail'].forEach(function(id){document.getElementById(id).hidden=true;});
      document.querySelector('.world-shortcuts').hidden=true;
      return;
    }
    // WorldUI owns the flat activity markup; this presenter only controls visibility.
    detail.hidden=!visible;
    document.getElementById('world-tracked').hidden=!visible;
    document.querySelector('.world-shortcuts').hidden=!visible || document.getElementById('world-active-link').hidden;
    var tracker=document.getElementById('world-tracked');
    // One primary action: retain the activity card but remove its duplicate control.
    var primary=tracker.querySelector('.quest-primary');
    if(primary){['worldFight','worldTalk','worldExplore','questAccept','questClaim','questGiver','questDestination'].forEach(function(key){
      if(!primary.dataset[key])return;
      detail.querySelectorAll('button').forEach(function(button){
        if(button.dataset[key === 'questDestination' ? 'worldEnter' : key]===primary.dataset[key]){
          var note=document.createElement('small');note.className='locality-primary-note';note.textContent='Azione disponibile nella missione in evidenza';button.replaceWith(note);
        }
      });
    });}
    if(lastLocation!==place){lastLocation=place;document.getElementById('panel-world').scrollTop=0;}
  }
  document.addEventListener('nymeria:world-render',render);
})();
