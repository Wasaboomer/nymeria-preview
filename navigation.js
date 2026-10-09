/* UI-only context stack. No imports, storage writes or dependency on game initialization. */
(function () {
  var roots = ["character", "world", "inventory", "expeditions", "menu"];
  var destinations = { world: {screen:"world",view:"overview"}, missions:{screen:"world",view:"journal"}, character:{screen:"character"}, inventory:{screen:"inventory"}, menu:{screen:"menu"} };
  var contexts = {};
  function combatLocked() { return route.screen === "world" && route.view === "battle" && typeof ProgressionStore !== "undefined" && !!ProgressionStore.state.frontier.activeEncounter; }
  var screens = roots.concat(["equipment", "inventory", "class", "combat", "debug", "guild", "professions"]);
  var route = { screen: "world", root: "world", view: "places" }, stack = [];
  var labels = { character: "Eroe", equipment: "Equipaggiamento", inventory: "Inventario", class: "Classe / Build", expeditions: "Attività", menu: "Menu", guild: "Gilda", professions: "Professioni", combat: "Incontro dimostrativo", debug: "DEBUG", journal: "Missioni", quest: "Missione", discoveries: "Scoperte", overview: "Mappa dei luoghi", travel: "Viaggio regionale", battle: "Incontro" };
  function snapshot() {
    return { route: Object.assign({}, route), scroll: window.scrollY, panelScroll: document.getElementById("panel-" + route.screen)?.scrollTop || 0, focus: document.activeElement && document.activeElement.id, focusData: document.activeElement ? Object.assign({}, document.activeElement.dataset) : {} };
  }
  function apply(next, restore) {
    route = Object.assign({}, next);
    document.body.setAttribute("data-screen", route.screen);
    document.body.setAttribute("data-world-view", route.view || "places");
    var panels = document.querySelectorAll('.app > [id^="panel-"]');
    for (var i = 0; i < panels.length; i++) panels[i].hidden = panels[i].id !== "panel-" + route.screen;
    var tabs = document.querySelectorAll(".bottom-nav [data-screen]");
    for (var j = 0; j < tabs.length; j++) {
      var active = tabs[j].getAttribute("data-screen") === route.root;
      tabs[j].setAttribute("aria-selected", String(active));
      tabs[j].disabled = combatLocked();
      tabs[j].tabIndex = active ? 0 : -1;
      tabs[j].setAttribute("aria-controls", "panel-" + (active ? route.screen : destinations[tabs[j].getAttribute("data-screen")].screen));
    }
    var bar = document.getElementById("context-bar");
    if (bar) bar.hidden = stack.length === 0;
    var previousRoute = stack.length ? stack[stack.length - 1].route : null;
    var backButton = document.getElementById("navigation-back");
    if (backButton) backButton.textContent = previousRoute ? "← Torna a " + (labels[previousRoute.view] || labels[previousRoute.screen] || "Mondo") : "← Indietro";
    var title = document.getElementById("context-title");
    if (title) title.textContent = labels[route.view] || labels[route.screen] || "Mondo";
    var shortcut = document.getElementById("current-quest-link");
    if (shortcut) shortcut.disabled = combatLocked();
    if (backButton) backButton.disabled = combatLocked();
    var context = document.getElementById("topbar-context");
    if (context) context.textContent = route.screen === "world" && route.view === "places" ? "Mondo" : labels[route.view] || labels[route.screen] || "Mondo";
    document.dispatchEvent(new CustomEvent("nymeria:navigation", { detail: Object.assign({}, route) }));
    window.scrollTo(0, restore ? restore.scroll : 0);
    var appliedRoute = route;
    requestAnimationFrame(function() { requestAnimationFrame(function() {
      if (route !== appliedRoute) return;
      var panel = document.getElementById("panel-" + route.screen);
      if (panel) panel.scrollTop = restore ? restore.panelScroll || 0 : 0;
    }); });
    var focus = restore && restore.focus ? document.getElementById(restore.focus) : restore ? null : document.getElementById("context-title");
    if (restore && !focus && Object.keys(restore.focusData).length) {
      var candidates = document.querySelectorAll("button");
      for (var k = 0; k < candidates.length; k++) {
        var candidate = candidates[k];
        if (!candidate.closest("[hidden]") && Object.keys(restore.focusData).every(function (key) { return candidate.dataset[key] === restore.focusData[key]; })) { focus = candidate; break; }
      }
    }
    if (focus && !focus.closest("[hidden]")) {
      if (!focus.matches("button, a, input, select, textarea, summary")) focus.tabIndex = -1;
      focus.focus({ preventScroll: true });
    }
  }
  function open(screen, options) {
    options = options || {};
    if (screens.indexOf(screen) < 0 || (combatLocked() && !(screen === "world" && options.view === "battle"))) return;
    if ((screen === "debug" || screen === "combat") && new URLSearchParams(location.search).get("test") !== "1") return;
    if (screen === route.screen && (options.view || "places") === (route.view || "places") && options.questId === route.questId && options.slot === route.slot) return;
    stack.push(snapshot());
    apply(Object.assign({ screen: screen, root: route.root }, options));
  }
  function root(screen) {
    if (roots.indexOf(screen) < 0 || combatLocked()) return;
    var dialog = document.getElementById("item-dialog");
    if (dialog && dialog.open) dialog.close();
    stack = [];
    apply({ screen: screen, root: screen, view: screen === "world" ? "places" : undefined });
  }
  function destination(id) {
    if (!destinations[id] || combatLocked()) return;
    var current = snapshot();
    // A primary tab click owns focus; do not restore the tab clicked when leaving.
    current.focus = null; current.focusData = {};
    contexts[route.root] = { current: current, stack: stack.slice() };
    var dialog = document.getElementById("item-dialog");
    if (dialog && dialog.open) dialog.close();
    var saved = id === "world" ? null : contexts[id];
    stack = saved ? saved.stack.slice() : [];
    apply(saved ? saved.current.route : Object.assign({root:id}, destinations[id]), saved && saved.current);
  }
  function back() {
    if (combatLocked()) return;
    var dialog = document.getElementById("item-dialog");
    if (dialog && dialog.open) { dialog.close(); return; }
    var previous = stack.pop();
    if (previous) apply(previous.route, previous);
  }
  function updateGuard() {
    var locked = combatLocked();
    document.querySelectorAll(".bottom-nav button, #navigation-back, #current-quest-link").forEach(function(button) { button.disabled = locked; });
  }
  document.addEventListener("nymeria:world-render", updateGuard);
  function initialize() {
    document.querySelector(".bottom-nav").addEventListener("click", function (e) {
      var button = e.target.closest("[data-screen]");
      if (button) destination(button.dataset.screen);
    });
    document.querySelector(".bottom-nav").addEventListener("keydown", function (event) {
      var tabs = Array.from(document.querySelectorAll(".bottom-nav [data-screen]")), current = tabs.indexOf(event.target);
      if (current < 0 || ["ArrowLeft", "ArrowRight", "Home", "End"].indexOf(event.key) < 0) return;
      event.preventDefault();
      var index = event.key === "Home" ? 0 : event.key === "End" ? tabs.length - 1 : (current + (event.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length;
      destination(tabs[index].dataset.screen); tabs[index].focus();
    });
    document.getElementById("navigation-back").addEventListener("click", back);
    document.addEventListener("nymeria:screen", function (e) { open(e.detail); });
    document.addEventListener("click", function (e) {
      var b = e.target.closest("[data-nav]");
      if (!b) return;
      if (b.dataset.nav === "discoveries") open("world", { view: "discoveries" });
      else open(b.dataset.nav);
    });
    document.addEventListener("keydown", function(e) { if(e.key === "Escape" && !document.querySelector("dialog[open]")) back(); });
    root("world");
  }
  window.NymeriaNavigation = { showScreen: open, open: open, root: root, destination: destination, back: back,
    get route() { return Object.assign({}, route); }, get depth() { return stack.length; } };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initialize);
  else initialize();
})();
