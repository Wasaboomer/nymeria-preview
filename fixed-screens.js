/* UI-only adaptive pagination. Existing nodes/listeners are retained, no game/storage writes. */
(function () {
  'use strict';
  var atoms=[], pages=[], index=0, root=null, frame=0, signature='', category='main';
  var ns='http://www.w3.org/2000/svg';
  var app=document.querySelector('.app'), dialog=document.getElementById('item-dialog');
  var pager=document.createElement('nav'); pager.className='fixed-pager';pager.setAttribute('aria-label','Pagine della schermata');
  pager.innerHTML='<button data-fixed-prev>← Prima</button><output aria-live="polite"></output><button data-fixed-next>Dopo →</button>';
  app.append(pager);
  var modalPager=pager.cloneNode(true);dialog.append(modalPager);
  // Existing creator buttons are retained, but live in the viewport shell.
  app.append(document.getElementById('creator-actions'));
  var observer=new MutationObserver(schedule);
  function watch(){observer.observe(app,{childList:true,subtree:true,attributes:true,attributeFilter:['hidden','open'],characterData:true});observer.observe(dialog,{childList:true,subtree:true,attributes:true,attributeFilter:['open'],characterData:true});}
  function schedule(){if(!frame)frame=requestAnimationFrame(function(){frame=0;layout();});}
  function hidden(node){return node.hidden || getComputedStyle(node).display==='none';}
  function cleanup(scope){scope.querySelectorAll('.fixed-off,.fixed-empty').forEach(function(n){n.classList.remove('fixed-off','fixed-empty');});}
  function collect(node,budget,result){
    if(hidden(node))return;
    var box=node.getBoundingClientRect();
    if(box.height<1 && box.width<1)return;
    // A rendered unit is kept whole if it can fit, preserving headings with actions.
    if(node.tagName==='DETAILS'&&!node.open){result.push(node);return;}
    var atomic=node.matches('button, input, select, textarea, label, summary, p, h1, h2, h3, h4, svg, img, canvas, .stage, .world-fighters, .world-battle-controls, #world-resource, #fixed-battle-essential, .inventory-item, .slot-card');
    if(atomic || box.height<=Math.min(budget*.7,220) || !node.children.length){result.push(node);return;}
    Array.from(node.children).forEach(function(child){collect(child,budget,result);});
  }
  function paint(list){
    atoms.forEach(function(n){n.classList.toggle('fixed-off',list.indexOf(n)<0);});
    var ancestors=Array.from(root.querySelectorAll('*')).filter(function(n){return n.namespaceURI!==ns && !atoms.some(function(a){return a===n || a.contains(n);}) && !n.closest('.fixed-pager');}).reverse();
    ancestors.forEach(function(n){
      // Hide empty structural containers so their margins/padding do not consume a page.
      var any=list.some(function(a){return n.contains(a);});
      n.classList.toggle('fixed-empty',!any && !n.hidden);
    });
  }
  function height(){return Math.max(root.scrollHeight,root.getBoundingClientRect().height);}
  function categoryTabs(){
    var journal=document.getElementById('quest-journal');
    if(!journal || journal.closest('[hidden]'))return;
    var tabs=journal.querySelector('.fixed-tabs');
    if(!tabs){tabs=document.createElement('nav');tabs.className='fixed-tabs';tabs.setAttribute('aria-label','Categorie missioni');tabs.innerHTML='<button data-fixed-category="main">Storia</button><button data-fixed-category="side">Secondarie</button><button data-fixed-category="profession">Professioni</button>';journal.prepend(tabs);}
    var groups=journal.querySelectorAll('.journal-group');
    groups.forEach(function(g,i){g.hidden=['main','side','profession'][i]!==category;});
    tabs.querySelectorAll('button').forEach(function(b){b.setAttribute('aria-pressed',String(b.dataset.fixedCategory===category));});
  }
  function layout(){
    observer.disconnect();
    try{
      var viewportHeight=Math.floor(window.visualViewport?visualViewport.height:innerHeight);
      document.body.classList.toggle('fixed-compact',viewportHeight<480);
      document.documentElement.style.setProperty('--fixed-vh',viewportHeight+'px');
      cleanup(app);cleanup(dialog);categoryTabs();
      var battle=document.getElementById('world-battle');
      if(battle&&!battle.querySelector('#fixed-battle-essential')){
        var essential=document.createElement('section');essential.id='fixed-battle-essential';
        ['.section-title','.world-fighters','#world-resource','.world-battle-controls'].forEach(function(selector){var item=battle.querySelector(selector);if(item)essential.append(item);});
        battle.prepend(essential);
      }
      var open=dialog.open, nextRoot=open?document.getElementById('detail-body'):Array.from(app.children).find(function(n){return /^panel-/.test(n.id)&&!n.hidden;});
      if(!nextRoot)return;
      var prep=document.getElementById('world-stag-preparation'), result=document.getElementById('world-result');
      var phase=prep&&!prep.hidden?'prepare':result&&!result.hidden?'result':'normal';
      var nextSignature=phase+':'+(open?'dialog:':'')+nextRoot.id+':'+document.body.dataset.worldView+':'+document.body.dataset.screen+':'+(window.NymeriaNavigation?NymeriaNavigation.route.questId||'':'');
      if(signature!==nextSignature){index=0;signature=nextSignature;}
      root=nextRoot;
      pager.hidden=open;modalPager.hidden=!open;
      var vh=Math.floor(window.visualViewport?visualViewport.height:innerHeight);
      var chrome=Array.from(app.children).filter(function(n){return n!==root && !/^panel-/.test(n.id) && n.tagName!=='FOOTER' && !hidden(n) && !['absolute','fixed'].includes(getComputedStyle(n).position);}).reduce(function(sum,n){var css=getComputedStyle(n);return sum+n.getBoundingClientRect().height+parseFloat(css.marginTop||0)+parseFloat(css.marginBottom||0);},0);
      var appCSS=getComputedStyle(app);
      var budget=Math.floor(vh-chrome-parseFloat(appCSS.paddingTop)-parseFloat(appCSS.paddingBottom)-8);
      if(open)budget=Math.floor(dialog.clientHeight-document.querySelector('#item-dialog .detail-header').getBoundingClientRect().height-modalPager.getBoundingClientRect().height-32);
      budget=Math.max(100,budget);
      document.documentElement.style.setProperty(open?'--fixed-dialog-height':'--fixed-content-height',budget+'px');
      // Measure content rather than the fixed container itself.
      root.style.height='auto';
      atoms=[];Array.from(root.children).forEach(function(n){collect(n,budget,atoms);});
      var preparation=atoms.filter(function(n){return n.closest('#world-stag-preparation')&&!n.closest('[hidden]');});
      var essential=atoms.find(function(n){return n.id==='fixed-battle-essential';});
      if(preparation.length)atoms=preparation.concat(atoms.filter(function(n){return preparation.indexOf(n)<0;}));
      else if(essential&&!essential.closest('[hidden]'))atoms=[essential].concat(atoms.filter(function(n){return n!==essential;}));
      else {
        var resultAtoms=atoms.filter(function(n){return n.closest('#world-result')&&!n.closest('[hidden]');});
        if(resultAtoms.length)atoms=resultAtoms.concat(atoms.filter(function(n){return resultAtoms.indexOf(n)<0;}));
      }
      pages=[];var page=[];
      atoms.forEach(function(atom){
        var candidate=page.concat(atom);paint(candidate);
        if(height()>budget-24 && page.length){pages.push(page);page=[atom];paint(page);}else page=candidate;
      });
      if(page.length)pages.push(page);if(!pages.length)pages=[[]];
      index=Math.min(index,pages.length-1);
      var focused=document.activeElement;
      if(root.contains(focused)&&focused.matches('input,select,textarea')){
        var focusedPage=pages.findIndex(function(rows){return rows.some(function(a){return a===focused||a.contains(focused);});});
        if(focusedPage>=0)index=focusedPage;
      }
      paint(pages[index]);
      root.style.height=(budget+4)+'px';
      var activePager=open?modalPager:pager;
      var pageLabel='Pagina '+(index+1)+' / '+pages.length;
      if(activePager.querySelector('output').textContent!==pageLabel)activePager.querySelector('output').textContent=pageLabel;
      activePager.querySelector('[data-fixed-prev]').disabled=index===0;
      activePager.querySelector('[data-fixed-next]').disabled=index===pages.length-1;
      app.scrollTop=0;dialog.scrollTop=0;window.scrollTo(0,0);
      root.dataset.fixedOverflow=String(root.scrollHeight>root.clientHeight+1);
    }finally{watch();}
  }
  function change(delta){if(document.activeElement.matches('input,select,textarea'))document.activeElement.blur();index=Math.max(0,Math.min(pages.length-1,index+delta));schedule();}
  document.addEventListener('click',function(e){var b=e.target.closest('button');if(!b)return;if(b.hasAttribute('data-fixed-next'))change(1);if(b.hasAttribute('data-fixed-prev'))change(-1);if(b.dataset.fixedCategory){category=b.dataset.fixedCategory;index=0;schedule();}});
  app.addEventListener('click',function(e){
    var button=e.target.closest('button');
    var form=button&&button.form;
    if(!form||button.type!=='submit'||form.checkValidity())return;
    e.preventDefault();
    var field=form.querySelector(':invalid');
    var page=pages.findIndex(function(rows){return rows.some(function(a){return a===field||a.contains(field);});});
    if(page>=0){index=page;schedule();requestAnimationFrame(function(){field.focus({preventScroll:true});field.reportValidity();});}
  },true);
  document.addEventListener('focusin',schedule);document.addEventListener('focusout',schedule);
  document.addEventListener('toggle',schedule,true);
  document.addEventListener('nymeria:navigation',function(){index=0;schedule();});
  window.addEventListener('resize',schedule);if(window.visualViewport)visualViewport.addEventListener('resize',schedule);
  document.addEventListener('keydown',function(e){if(e.key==='Escape')schedule();});
  window.FixedScreens=Object.freeze({refresh:layout,get page(){return index;},get count(){return pages.length;}});
  watch();schedule();
})();
