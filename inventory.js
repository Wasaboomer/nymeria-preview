/* Mobile inventory, explicit comparison target and accessible item detail sheet. */
const InventoryUI = (() => {
  let filter = "all",
    order = "itemLevel",
    slotFilter = null,
    selectedId = null,
    selectedStack = null,
    target = null;
  const dialog = document.querySelector("#item-dialog");
  let bagReturn = null;
  dialog.addEventListener("close",()=>{
    const saved=bagReturn;bagReturn=null;if(!saved)return;
    // The existing modal layout temporarily removes the panel scroll class.
    // Restore only the Bag context after that layout has returned to the panel.
    requestAnimationFrame(()=>requestAnimationFrame(()=>{
      if(filter!==saved.filter || NymeriaNavigation.route.screen!=="inventory")return;
      const panel=document.querySelector("#panel-inventory");
      (panel.querySelector(`[data-stack-key="${CSS.escape(saved.key)}"]`) || panel.querySelector("#inventory-category"))?.focus({preventScroll:true});
      panel.scrollTop=saved.top;
    }));
  });
  const rarityLabel = (item) =>
    `${["I", "II", "III", "IV", "V"][GearData.rarities.indexOf(item.rarity)]} · ${item.rarity}`;
  const rarityClass = (item) =>
    `rarity-${GearData.rarities.indexOf(item.rarity)}`;
  const armorText = value => typeof value === "string" ? value.replace(/\bPlate\b/g,"Piastre").replace(/\bMail\b/g,"Maglia").replace(/\bLeather\b/g,"Cuoio").replace(/\bCloth\b/g,"Tessuto") : value;
  const slotLabel = (id) => Equipment.slotById[id].label;
  const equippedSlot = (id) =>
    GearData.slots.find(
      (s) => Equipment.state.equipment[s.id].equippedItem === id,
    )?.id;
  const group = (item) =>
    item.slot === "weapon" || item.slot === "support"
      ? "weapons"
      : ["necklace", "earring", "bracelet", "ring"].includes(item.slot)
        ? "accessories"
        : "armor";
  function renderSlots() {
    const locked = Equipment.equipped("mainHand")?.handedness === "2H";
    document.querySelector("#equipment-grid").innerHTML = GearData.slots
      .map((slot) => {
        const item = Equipment.equipped(slot.id);
        const occupied = slot.id === "support" && locked;
        return `<button class="slot-card ${item ? rarityClass(item) : ""} ${occupied ? "locked" : ""}" data-open-slot="${slot.id}" ${occupied ? "disabled" : ""}><span class="slot-icon">${GearData.icon(item || slot.type)}</span><span><small>${slot.label}</small><strong>${occupied ? "Occupato dall’arma 2H" : item?.name || "Vuoto"}</strong><em>${occupied ? "Bloccato · rimuovi l’arma principale" : item ? `${rarityLabel(item)} · iLv ${item.itemLevel}` : "Tocca per scegliere"}</em></span></button>`;
      })
      .join("");
  }
  function itemValidation(item, slot = slotFilter || equippedSlot(item.id) || Equipment.compatibleSlots(item)[0]) {
    return Equipment.equipValidation(item, slot);
  }
  function availabilityMarkup(item, slot) {
    const validation = itemValidation(item, slot);
    const worn = equippedSlot(item.id) === (slot || slotFilter || equippedSlot(item.id) || Equipment.compatibleSlots(item)[0]);
    // Presentation only: all eligibility decisions come from equipValidation.
    const icon = kind => `<svg class="availability-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">${kind === "available" ? '<circle cx="12" cy="12" r="9"/><path d="m7 12 3 3 7-7"/>' : kind === "equipped" ? '<path d="m12 3 8 4v5c0 5-8 9-8 9s-8-4-8-9V7z"/><path d="m8 12 3 3 5-6"/>' : '<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/><path d="M12 14v3"/>'}</svg>`;
    const badge = (kind, text) => `<span class="availability-badge ${kind}">${icon(kind)}<span>${text}</span></span>`;
    const reasons = validation.reasons.map(reason => {
      const message = reason.message === "Arma non utilizzabile con questo kit."
        ? `Arma incompatibile con ${ClassSystem.build().name}`
        : reason.message === "Supporto non utilizzabile con questo kit."
          ? `Supporto incompatibile con ${ClassSystem.build().name}` : armorText(reason.message);
      return `<span class="availability-reason">${escape(message)}</span>`;
    }).join("");
    return `<span class="item-availability ${validation.ok ? "available" : "unavailable"}">${worn ? badge("equipped", "EQUIPAGGIATO") : validation.ok ? badge("available", "EQUIPAGGIABILE") : ""}${!validation.ok ? badge("unavailable", "NON EQUIPAGGIABILE") + reasons : ""}</span>`;
  }
  function visibleItems() {
    return Equipment.state.inventory
      .filter(
        (i) =>
          (filter === "all" || filter === "equipment" || group(i) === filter) &&
          (!slotFilter || (Equipment.compatibleSlots(i).includes(slotFilter))),
      )
      .sort((a, b) =>
        Number(itemValidation(b).ok) - Number(itemValidation(a).ok) || (order === "rarity"
          ? GearData.rarities.indexOf(b.rarity) -
              GearData.rarities.indexOf(a.rarity) ||
            b.itemLevel - a.itemLevel ||
            a.id.localeCompare(b.id)
          : b.itemLevel - a.itemLevel ||
            GearData.rarities.indexOf(b.rarity) -
              GearData.rarities.indexOf(a.rarity) ||
            a.id.localeCompare(b.id)),
      );
  }
  function advisorMarkup(item, slot) {
    const cls = ClassSystem.selected(),
      build = ClassSystem.build();
    const unavailable = armorText(ArmorRules.unavailableLabel(item, cls));
    if (unavailable)
      return `<span class="hint armor-incompatible">${unavailable}</span>`;
    const advice = BuildSystem.advise(item, slot, cls.id, build.id, Equipment);
    return advice
      ? `<span class="gear-advice">${advice.improvement ? "<span>↑ Miglioramento</span>" : ""}${advice.bestOwned ? "<span>★ Migliore posseduto</span>" : ""}</span>`
      : "";
  }
  const escape = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function catalog() {
    return InventoryCatalog.collect({equipment:Equipment.state.inventory,
      progression:typeof ProgressionStore !== 'undefined' ? ProgressionStore.state : {},
      profession:typeof ProfessionUI !== 'undefined' ? ProfessionUI.engine.state : {},
      materialNames:typeof ProgressionData !== 'undefined' ? ProgressionData.materialNames : {},
      professionMaterials:typeof ProfessionData !== 'undefined' ? ProfessionData.materials : [],
      supplyNames:typeof WorldData !== 'undefined' ? WorldData.supplyNames : {}});
  }
  const sourceLabel = source => ({progression:'Risorse del personaggio',profession:'Materiali delle Professioni',quest:'Raccolte delle missioni'}[source] || 'Altro');
  const readMaterials=()=>MaterialBagView.read({progression:ProgressionStore,profession:ProfessionUI.engine,storage:{getItem:key=>localStorage.getItem(key)}});
  function stackDetail() {
    dialog.dataset.detailKind = "resource";
    const bag=readMaterials();
    const isMaterial=MaterialBagContract.catalog.some(row=>row.key===selectedStack);
    const row = isMaterial ? (bag.ok?bag.groups.flatMap(group=>group.rows).map(row=>({...row,source:row.owner})).find(row=>row.key===selectedStack):null) : catalog().find(row=>row.key===selectedStack);
    if(isMaterial && !bag.ok){document.querySelector("#detail-heading").textContent="Materiale non consultabile";document.querySelector("#detail-body").innerHTML=`<p role="alert">${escape(bag.message)}</p>`;return;}
    document.querySelector('#detail-heading').textContent = row?.name || 'Oggetto non più posseduto';
    const description=isMaterial ? ProfessionData.materials.find(item=>row?.source==='profession'&&item.id===row.id)?.description : row?.source==='quest'?'Oggetto di missione. Consulta Missioni per gli obiettivi.':null;
    document.querySelector('#detail-body').innerHTML = row ? `<div class="resource-detail-summary">${isMaterial?`<span class="bag-material-symbol">${materialSymbol(row.id)}</span>`:''}<p>Quantità: <strong>${row.quantity.toLocaleString('it-IT')}</strong></p></div>${description?`<p>${escape(description)}</p>`:''}` : '<p>La quantità è cambiata: consulta la lista aggiornata.</p>';
  }
  // Provisional material symbols: presentation only, not artwork or material data.
  function materialSymbol(id) {
    const paths={iron:'M5 16 11 8h12l4 8-6 7H9z M5 16h22 M11 8l3 8-5 7',
      'raw-iron':'m5 22 3-12 10-5 9 10-5 12z M8 10l10 5 4 12 M18 5v10',
      'forged-iron':'M4 12h24l-5 7H10z M12 19v6h10 M7 25h20',
      fiber:'M7 26C24 18 8 9 25 5 M12 27C29 19 13 10 28 7 M4 22C20 14 5 8 21 4',
      ether:'m16 3 10 13-10 13L6 16z M16 3v26 M6 16h20',
      'wild-herbs':'M16 28V12 M16 20C6 20 4 11 5 7c10 0 11 6 11 13 M16 15C26 15 28 7 27 4c-10 0-11 5-11 11',
      'weathered-map-fragment':'m5 6 8-2 6 4 8-2v20l-8 2-6-4-8 2z M13 4v20 M19 8v20 M9 15l13 4',
      'frontier-brace':'M6 5h5v22H6z M22 5h5v22h-5z M11 11h11 M11 21h11'};
    return `<svg viewBox="0 0 32 32" aria-hidden="true"><path d="${paths[id] || 'M6 6h20v20H6z M10 10h12v12H10z'}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round"/></svg>`;
  }
  function renderMaterials() {
    const root=document.querySelector('#material-bag-view');
    const view=readMaterials();
    const number=value=>value.toLocaleString('it-IT');
    const compact=value=>value.toLocaleString('it-IT',{notation:'compact',maximumFractionDigits:1});
    if(!view.ok){root.innerHTML=`<h3>Borsa dei materiali</h3><p role="alert">${escape(view.message)}</p>`;return;}
    const message=view.overCapacity?'Borsa oltre capacità. Nessun materiale viene rimosso.':view.occupied===view.capacity?'Borsa piena.':view.occupied===0?'La Borsa è vuota.':'';
    root.innerHTML=`<h3>Borsa dei materiali</h3><p class="bag-occupancy"><strong>${view.occupied} / ${view.capacity} slot</strong>${view.expansions?` · ${view.expansions} ${view.expansions===1?'ampliamento':'ampliamenti'}`:''}</p>${message?`<p>${message}</p>`:''}`+view.groups.map(group=>`<section><h4>${group.owner==='progression'?'Risorse':'Professioni'}</h4><ul>${group.rows.map(row=>`<li data-material-key="${escape(row.key)}"><button data-stack-key="${escape(row.key)}" aria-label="${escape(row.name)}, quantità ${number(row.quantity)}" title="${escape(row.name)} · ${number(row.quantity)}"><span class="bag-material-symbol">${materialSymbol(row.id)}</span><span class="bag-material-name">${escape(row.name)}</span><strong aria-label="Quantità ${number(row.quantity)}">×${compact(row.quantity)}</strong></button></li>`).join('')}</ul></section>`).join('');
  }
  function renderInventory() {
    const materials=filter==="materials" && !slotFilter;
    document.querySelector("#material-bag-view").hidden=!materials;
    document.querySelector("#panel-inventory > .section-title").hidden=materials;
    document.querySelector("#inventory-grid").hidden=materials;
    document.querySelector("#inventory-stacks").hidden=materials;
    document.querySelector(".inventory-toolbar").hidden=!["all","equipment","weapons","armor","accessories"].includes(filter);
    document.querySelector("#inventory-count").hidden=!["all","equipment","weapons","armor","accessories"].includes(filter);
    const gear=["equipment","weapons","armor","accessories"].includes(filter);
    document.querySelector("#inventory-category").value=gear?"equipment":filter;
    document.querySelector("#inventory-subcategory-label").hidden=!gear;
    document.querySelector("#inventory-subcategory").value=gear?filter:"equipment";
    document.querySelector("#inventory-resources").hidden=materials;
    document.querySelector("#panel-inventory > .panel-summary").hidden=true;
    document.querySelectorAll("[data-filter]").forEach(option=>option.setAttribute("aria-selected",String(option.selected)));
    if(materials){document.querySelector("#visible-count").textContent="";document.querySelector("#inventory-grid").innerHTML="";document.querySelector("#inventory-stacks").innerHTML="";renderMaterials();return;}
    const rows = visibleItems(),
      owned = Equipment.state.inventory;
    document.querySelector("#inventory-count").textContent =
      `${owned.filter((i) => !i.equipped).length} equipaggiamenti in sacca · ${owned.filter((i) => i.equipped).length} equipaggiati`;
    document.querySelector("#slot-filter").innerHTML = slotFilter
      ? `<span>Slot: ${slotLabel(slotFilter)}</span><button id="clear-slot-filter">Mostra tutto</button>`
      : "";
    document.querySelector("#inventory-grid").innerHTML = rows.length
      ? rows
          .map(
            (item) =>
              `<button class="inventory-item ${rarityClass(item)} ${itemValidation(item).ok ? "item-usable" : "item-blocked"}" data-item-id="${item.id}"><span class="inventory-icon">${GearData.icon(item)}</span><span class="inventory-name">${item.name}</span>${availabilityMarkup(item)}${advisorMarkup(item, slotFilter || Equipment.compatibleSlots(item)[0])}<small class="item-category">${GearData.typeLabels[item.type] || item.type}</small><small class="item-preview">${Object.entries(item.stats).slice(0,2).map(([key,value])=>`${GearData.statLabels[key]} +${value}${["critical","speed"].includes(key)?"%":""}`).join(" · ")}</small><span class="rarity-text">${rarityLabel(item)}</span><small>iLv ${item.itemLevel} · Lv ${item.requiredLevel}</small><span class="item-location">${item.equipped ? `● ${slotLabel(equippedSlot(item.id))}` : "In sacca"}</span></button>`,
          )
          .join("")
      : '<p class="hint">Nessun oggetto per questo filtro.</p>';
    const stacks = !slotFilter ? catalog().filter(row => row.source !== 'equipment' && (filter === 'all' || InventoryCatalog.category(row) === filter)) : [];
    document.querySelector('#inventory-stacks').innerHTML = stacks.map(row=>`<button class="inventory-stack" data-stack-key="${escape(row.key)}"><strong>${escape(row.name)}</strong><span>×${row.quantity}</span><small>${escape(sourceLabel(row.source))} · non equipaggiabile</small></button>`).join('');
    if (stacks.length && !rows.length) document.querySelector('#inventory-grid').innerHTML='';
    document.querySelector("#visible-count").textContent =
      `${rows.length + stacks.length} voci`;
  }
  function renderDetail() {
    if (selectedStack) { stackDetail(); return; }
    const item = Equipment.state.inventory.find((i) => i.id === selectedId);
    if (!item) return;
    dialog.dataset.detailKind = "equipment";
    const slots = Equipment.compatibleSlots(item);
    if (!slots.includes(target)) target = slots[0];
    const advice = BuildSystem.advise(
      item,
      target,
      ClassSystem.state.classId,
      ClassSystem.build().id,
      Equipment,
    );
    const comparison = Equipment.comparison(item.id, target),
      validation = itemValidation(item, target),
      error = validation.reasons.map(reason => armorText(reason.message)).join(" "),
      ownSlot = equippedSlot(item.id);
    const verdict = error ? error
      : ownSlot === target ? "Questo oggetto è già equipaggiato."
      : advice ? `${advice.delta > 0 ? "↑ Migliore" : advice.delta < 0 ? "↓ Meno adatto" : "= Equivalente"} per ${ClassSystem.selected().name} / ${ClassSystem.build().name}. Verifica anche le singole statistiche.`
      : "Confronta le statistiche prima di equipaggiare.";
    const armorLabel = {cloth:"Tessuto", leather:"Cuoio", mail:"Maglia", plate:"Piastre"}[item.armorType];
    const typeLabel = ({orb:"Sfera"})[item.type] || GearData.typeLabels[item.type] || item.type;
    const extraArmor = armorLabel && !typeLabel.toLowerCase().includes(armorLabel.toLowerCase()) ? ` · ${armorLabel}` : "";
    const description = item.description.replace(/\s*Asset provvisorio condiviso\.?/gi, "").trim();
    document.querySelector("#detail-heading").textContent = item.name;
    document.querySelector("#detail-body").innerHTML =
      `<div class="detail-meta ${rarityClass(item)}">${GearData.icon(item)}<div><strong>${rarityLabel(item)}</strong><p>Livello oggetto ${item.itemLevel} · Richiede livello ${item.requiredLevel}</p><p>${escape(typeLabel)}${item.handedness ? ` · ${item.handedness === "2H" ? "Due mani" : "Una mano"}` : ""}${extraArmor}</p></div></div><p class="description">${escape(description)}</p>${item.allowedSupports ? `<p class="hint">${item.handedness === "2H" ? "Occupa arma principale e supporto." : `Supporti: ${item.allowedSupports.map((x) => ({ shield: "scudo", dagger: "pugnale", offhandBlade: "seconda lama", quiver: "faretra", bolts: "dardi", book: "libro", orb: "sfera", focus: "reliquia / focus" })[x]).join(", ")}.`}</p>` : ""}<dl class="detail-stats">${Object.entries(
        item.stats,
      )
        .map(
          ([k, v]) =>
            `<div><dt>${GearData.statLabels[k]}</dt><dd>+${v}${["critical", "speed"].includes(k) ? "%" : ""}</dd></div>`,
        )
        .join(
          "",
        )}</dl>${item.effects.length ? `<div class="effect"><span>${typeof CombatData !== "undefined" && item.effects.some((effect) => CombatData.itemHooks[effect.id]) ? "EFFETTO SPECIALE · ATTIVO NEL KIT CACCIATORE" : "EFFETTO SPECIALE · NON ATTIVO IN COMBATTIMENTO"}</span>${item.effects.map((e) => `<p>${e.description}</p>`).join("")}</div>` : ""}${slots.length > 1 ? `<fieldset class="target-picker"><legend>Destinazione e confronto</legend>${slots.map((s) => `<button data-target="${s}" aria-pressed="${s === target}">${slotLabel(s)}<small>${Equipment.equipped(s)?.name || "Vuoto"}</small></button>`).join("")}</fieldset>` : `<p class="option-label">${slotLabel(target)}</p>`}${advisorMarkup(item, target)}<p class="item-verdict" role="status">${verdict}</p><details class="advisor-explanation"><summary>Dettagli del consiglio</summary><p class="hint advisor-score">${advice ? `Punteggio ${ClassSystem.selected().name} / ${ClassSystem.build().name}: ${advice.score.toFixed(1)} · equipaggiato ${advice.currentScore.toFixed(1)} · Δ ${advice.delta > 0 ? "+" : ""}${advice.delta.toFixed(1)}. Pesi statistici ed effetti supportati; non è una graduatoria globale.` : "Nessun consiglio per il kit della classe selezionata."}</p></details>${ownSlot === target
        ? '<div class="comparison equipped-summary"><p>Oggetto attualmente equipaggiato. Nessuna variazione delle statistiche</p></div>'
        : `<div class="comparison"><h3>Rispetto a: ${escape(comparison.current?.name || "slot vuoto")}</h3><p class="hint">Variazione totale dopo equipaggiamento${comparison.supportRemoved ? " · include la rimozione del supporto incompatibile" : ""}.</p><dl>${Object.entries(comparison.delta).concat([["power", comparison.power]]).map(([key, value]) => {
          const indicator = value > 0 ? "Miglioramento" : value < 0 ? "Peggioramento" : "Equivalente";
          return `<div class="comparison-row"><dt>${key === "power" ? "Potere" : GearData.statLabels[key]}</dt><dd><span class="comparison-value">${value > 0 ? "+" : ""}${value}${["critical", "speed"].includes(key) ? "%" : ""}</span><span class="comparison-indicator" aria-label="${indicator}">${value > 0 ? "↑" : value < 0 ? "↓" : "="}</span></dd></div>`;
        }).join("")}</dl></div>`}${error ? `<p class="compatibility" role="status">${error}</p>` : ""}<div class="detail-actions"><button id="equip-item" ${ownSlot === target || error ? "disabled" : ""}>${ownSlot === target ? "Già equipaggiato" : error ? "Non utilizzabile" : "Equipaggia"}</button>${ownSlot ? `<button data-remove="${ownSlot}">Rimuovi da ${slotLabel(ownSlot)}</button>` : ""}<button id="browse-slot">Altri oggetti per questo slot</button></div>`;
    const body = document.querySelector("#detail-body");
    const secondary = document.createElement("details");
    secondary.className = "item-secondary";
    secondary.innerHTML = "<summary>Descrizione e dettagli</summary>";
    Array.from(body.children).filter(element => element.matches(".description, .hint, .effect, .advisor-explanation")).forEach(element => secondary.append(element));
    const comparisonPanel = body.querySelector(".comparison");
    const verdictPanel = body.querySelector(".item-verdict");
    body.querySelector(".detail-meta").after(verdictPanel);
    const blockage = body.querySelector(".compatibility");
    if (blockage) blockage.remove(); // Reasons are already prominent in the verdict.
    if (error && ownSlot !== target) {
      const hypothetical = document.createElement("details");
      hypothetical.className = "hypothetical-comparison";
      hypothetical.innerHTML = "<summary>Confronto ipotetico · oggetto non utilizzabile</summary>";
      comparisonPanel.before(hypothetical);
      hypothetical.append(comparisonPanel);
    }
    const handHint = secondary.querySelector(".hint");
    if (item.handedness === "2H" && handHint) body.querySelector(".detail-actions").before(handHint);
    body.append(secondary);
  }
  function openItem(id, preferred) {
    selectedStack = null;
    selectedId = id;
    const item = Equipment.state.inventory.find((i) => i.id === id);
    if (!item) return;
    const slots = Equipment.compatibleSlots(item);
    target = slots.includes(preferred)
      ? preferred
      : equippedSlot(id) ||
        slots.find((s) => !Equipment.equipped(s)) ||
        slots[0];
    renderDetail();
    dialog.showModal();
    dialog.scrollTop = 0;
    document.querySelector("#detail-body").scrollTop = 0;
  }
  function openSlot(slot) {
    filterForSlot(slot);
    NymeriaNavigation.open("inventory", { slot });
  }
  function filterForSlot(slot) {
    slotFilter = slot;
    filter = "equipment";
    renderInventory();
  }
  document
    .querySelector("#close-detail")
    .addEventListener("click", () => dialog.close());
  let backdropStart=false;
  const outside=event=>{const r=dialog.getBoundingClientRect();return event.target===dialog&&(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom);};
  dialog.addEventListener("pointerdown",event=>{backdropStart=outside(event);});
  dialog.addEventListener("pointercancel",()=>{backdropStart=false;});
  dialog.addEventListener("click",event=>{if(backdropStart&&outside(event))dialog.close();backdropStart=false;});
  document.addEventListener("click", (event) => {
    const b = event.target.closest("button");
    if (!b) return;
    if (b.dataset.openSlot) openSlot(b.dataset.openSlot);
    if (b.dataset.stackKey) {
      bagReturn={key:b.dataset.stackKey,filter,top:document.querySelector("#panel-inventory").scrollTop};
      selectedStack = b.dataset.stackKey;
      stackDetail(); dialog.showModal(); dialog.scrollTop=0;
    }
    if (b.dataset.itemId) openItem(b.dataset.itemId, slotFilter);
    if (b.id === "clear-slot-filter") {
      slotFilter = null;
      filter = "all";
      renderInventory();
    }
    if (b.dataset.target) {
      target = b.dataset.target;
      renderDetail();
    }
    if (b.id === "browse-slot") {
      dialog.close();
      openSlot(target);
    }
    if (b.id === "equip-item") {
      const result = Equipment.equip(selectedId, target);
      document.dispatchEvent(
        new CustomEvent("nymeria:notice", { detail: result.message }),
      );
      if (result.ok) {
        if (NymeriaNavigation.route.slot) { dialog.close(); NymeriaNavigation.back(); }
        else renderDetail();
      }
    }
    if (b.dataset.remove) {
      const result = Equipment.unequip(b.dataset.remove);
      document.dispatchEvent(
        new CustomEvent("nymeria:notice", { detail: result.message }),
      );
      renderDetail();
    }
  });
  for(const id of ["inventory-category","inventory-subcategory"]){
    document.getElementById(id).addEventListener("change",event=>{filter=event.target.value;slotFilter=null;renderInventory();document.querySelector("#panel-inventory").scrollTop=0;});
  }
  document
    .querySelector("#inventory-sort")
    .addEventListener("change", (event) => {
      order = event.target.value;
      renderInventory();
    });
  function render() {
    renderSlots();
    renderInventory();
    if (dialog.open) renderDetail();
  }
  document.addEventListener("nymeria:navigation", event => {
    if (event.detail.screen !== "inventory") return;
    const nextSlot = event.detail.slot || null;
    if (nextSlot !== slotFilter) { slotFilter = nextSlot; filter = nextSlot ? "equipment" : "all"; }
    renderInventory();
  });
  window.addEventListener('storage',()=>{if(filter==='materials')renderInventory();});
  window.addEventListener('pageshow',()=>{if(filter==='materials')renderInventory();});
  ClassSystem.subscribe(render);
  document.addEventListener('DOMContentLoaded', () => {
    const refreshCollections = () => { renderInventory(); if (dialog.open && selectedStack) stackDetail(); };
    ProgressionStore.subscribe(refreshCollections);
    ProfessionUI.engine.subscribe(refreshCollections);
    render();
  });
  return {
    render,
    filterForSlot,
    openSlot,
    openItem,
    visibleItems,
    close() {
      dialog.close();
    },
  };
})();
