/* Data-driven global presentation. Only subscribes to committed semantic progression events. */
const NotificationUI = (() => {
  const kinds = {
    levelUp: { label: "LIVELLO AUMENTATO!", emphasis: "major", duration: 9000 },
    areaUnlocked: { label: "NUOVA AREA SBLOCCATA", duration: 5500 },
    questAvailable: { label: "NUOVA MISSIONE", duration: 5000 },
    importantItem: { label: "OGGETTO IMPORTANTE", duration: 5000 },
    discovery: { label: "SCOPERTA IMPORTANTE", duration: 6500 },
    achievement: { label: "RICONOSCIMENTO OTTENUTO", duration: 6500 },
    featureUnlocked: { label: "NUOVA FUNZIONALITÀ", duration: 5000 },
  };
  const host = document.getElementById("global-notifications");
  let timer = null, shownId = null, remaining = 0, deadline = 0, hovered = false;
  const escape = value => String(value).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[c]);
  const gainLabels = { force: "Forza", agility: "Agilità", vigor: "Vigor", spirit: "Spirito", critical: "Critico", armor: "Armatura", speed: "Velocità" };
  function presentation(entry) {
    const kind = kinds[entry.type] || { label: "Avviso", duration: 5000 };
    const p = entry.payload;
    let title = p.name || p.title || "", label = kind.label, details = [];
    if (entry.type === "levelUp") {
      const multiple = p.resultingLevel - p.previousLevel > 1;
      label = multiple ? "LIVELLI AUMENTATI!" : kind.label;
      title = multiple ? `Livello ${p.previousLevel} → ${p.resultingLevel}` : `Livello ${p.resultingLevel}`;
      details = Object.entries(p.statGains).filter(([, value]) => value > 0).map(([key, value]) =>
        `+${Number(value).toLocaleString("it-IT")}${key === "critical" ? "%" : ""} ${gainLabels[key] || key}`);
      if (p.resultingLevel === p.levelCap) details.push("Livello massimo raggiunto");
    } else details = [p.description, p.status, p.requirement].filter(Boolean);
    return { kind, label, title, details };
  }
  function stopTimer() { if (timer !== null) clearTimeout(timer); timer = null; }
  function startTimer() {
    stopTimer();
    if (document.hidden || !Notifications.current || hovered || host.contains(document.activeElement)) return;
    const id = Notifications.current.id;
    deadline = performance.now() + remaining;
    timer = setTimeout(() => Notifications.dismiss(id), remaining);
  }
  function pauseTimer() {
    if (timer !== null) remaining = Math.max(0, deadline - performance.now());
    stopTimer();
  }
  function place() {
    // Keep feedback usable even while an equipment/details dialog occupies the top layer.
    const parent = document.querySelector("dialog[open]") || document.querySelector(".app");
    if (host.parentNode !== parent) {
      const panel = parent.querySelector(':scope > [id^="panel-"]');
      if (panel) parent.insertBefore(host, panel); else parent.appendChild(host);
    }
  }
  const dialogs = new MutationObserver(place);
  dialogs.observe(document.body, { subtree: true, attributes: true, attributeFilter: ["open"] });
  function render() {
    const entry = Notifications.current;
    if (entry?.id === shownId) {
      const count = host.querySelector("[data-notification-count]");
      if (count) {
        count.hidden = !Notifications.pending.length;
        count.textContent = `Altre notifiche in attesa: ${Notifications.pending.length}`;
      }
      return;
    }
    shownId = entry?.id || null;
    stopTimer();
    host.hidden = !entry;
    if (!entry) { host.textContent = ""; return; }
    place();
    const { kind, label, title, details } = presentation(entry);
    host.dataset.type = entry.type;
    host.classList.toggle("notification-major", kind.emphasis === "major");
    host.innerHTML = `<article class="notification-card"><div class="notification-sigil" aria-hidden="true">${kind.emphasis === "major" ? '<svg viewBox="0 0 40 40"><path d="M20 2 38 20 20 38 2 20ZM20 8V32M8 20H32M14 15 20 9 26 15" fill="none" stroke="currentColor" stroke-width="1.4"/></svg>' : '<svg viewBox="0 0 40 40"><path d="M20 7 33 20 20 33 7 20ZM20 15V22M20 25V27" fill="none" stroke="currentColor" stroke-width="1.4"/></svg>'}</div><div class="notification-copy"><p class="notification-label">${escape(label)}</p><h2>${escape(title)}</h2>${details.length ? `<ul>${details.map(line => `<li>${escape(line)}</li>`).join("")}</ul>` : ""}<small data-notification-count ${Notifications.pending.length ? "" : "hidden"}>Altre notifiche in attesa: ${Notifications.pending.length}</small></div><button type="button" data-dismiss-notification aria-label="Chiudi notifica">×</button></article>`;
    remaining = kind.duration;
    startTimer();
  }
  host.addEventListener("click", event => {
    if (event.target.closest("[data-dismiss-notification]")) Notifications.dismiss();
  });
  host.addEventListener("pointerenter", event => {
    if (event.pointerType === "mouse") { hovered = true; pauseTimer(); }
  });
  host.addEventListener("pointerleave", event => {
    if (event.pointerType === "mouse") { hovered = false; startTimer(); }
  });
  host.addEventListener("focusin", pauseTimer);
  host.addEventListener("focusout", () => queueMicrotask(startTimer));
  document.addEventListener("visibilitychange", () => document.hidden ? pauseTimer() : startTimer());
  // No initial state replay, storage-event replay or durable notification receipts.
  ProgressionStore.subscribeEvents(event => Notifications.notify(event.type, event.payload));
  Notifications.subscribe(render);
  render();
  return { kinds, presentation };
})();
