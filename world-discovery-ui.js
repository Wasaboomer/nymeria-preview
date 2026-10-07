/* A durable acknowledgement reserves feedback before display: refresh never replays it.
   A failed acknowledgement leaves the notification pending, rather than dismissing it. */
(() => {
  if (typeof document === "undefined" || typeof WorldDiscovery === "undefined" || !WorldDiscovery) return;
  const messages = { "vesper-outpost": { title: "Vesper Outpost discovered", body: "The restored beacon has revealed a safe route through the frontier." } };
  let claiming = false;
  async function show() {
    const id = WorldDiscovery.pending()[0];
    if (claiming || !id || !messages[id] || document.getElementById("world-update")) return;
    // Do not cover an existing modal or global level-up feedback.
    if (document.querySelector('dialog[open]') || (typeof Notifications !== "undefined" && Notifications?.current)) return;
    claiming = true;
    try {
      const result = await WorldDiscovery.acknowledge(id);
      if (!result.ok || !result.claimed) return;
      const card = document.createElement("div");
      card.id = "world-update"; card.className = "world-update";
      card.setAttribute("role", "dialog"); card.setAttribute("aria-modal", "true"); card.setAttribute("aria-labelledby", "world-update-title");
      card.innerHTML = '<div class="world-update-card"><small>WORLD UPDATED</small><h2 id="world-update-title"></h2><p></p><button type="button">Open Map</button></div>';
      card.querySelector("h2").textContent = messages[id].title;
      card.querySelector("p").textContent = messages[id].body;
      document.body.appendChild(card);
      card.querySelector("button").addEventListener("click", () => {
        card.remove();
        // Select the World root; Back from the map returns to the current World place.
        NymeriaNavigation.root("world");
        NymeriaNavigation.open("world", { view: "overview" });
      });
      card.addEventListener("keydown", event => { if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); } if (event.key === "Tab") { event.preventDefault(); card.querySelector("button").focus(); } });
      card.querySelector("button").focus();
    } catch { /* Feedback failure does not undo the committed project/discovery. */ }
    finally { claiming = false; }
  }
  function init() {
    WorldDiscovery.subscribe(show);
    if (typeof Notifications !== "undefined" && Notifications) Notifications.subscribe(show);
    new MutationObserver(show).observe(document.body, { subtree: true, attributes: true, attributeFilter: ["open"] });
    show();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();
