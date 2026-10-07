/* Local-only guild presentation. ProgressionStore is never mutated here. */
(() => {
  if (
    typeof document === "undefined" ||
    typeof GuildSystem === "undefined" ||
    !GuildSystem
  )
    return;
  const $ = (id) => document.getElementById(id);
  const esc = (value) =>
    String(value ?? "").replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );
  const number = (value) => value.toLocaleString("it-IT");
  const names = { crowns: "Corone", ...ProgressionData.materialNames };
  const sigil = (id) => {
    const row =
      GuildData.sigils.find((s) => s.id === id) || GuildData.sigils[0];
    return `<svg viewBox="0 0 40 42" width="40" height="42" role="img" aria-label="${esc(row.name)}"><path d="${row.path}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  };
  let busy = false,
    rendered = "";
  function render() {
    const root = $("guild-root");
    if (!root) return;
    const state = GuildSystem.state,
      g = state.guild;
    const playerLevel = ProgressionStore.state.level;
    const fingerprint = JSON.stringify([
      state,
      GuildSystem.storageIssue,
      GuildSystem.recovered,
      playerLevel,
    ]);
    if (fingerprint !== rendered) {
      const previousForm = root.querySelector("form");
      const draft = previousForm ? new FormData(previousForm) : null;
      rendered = fingerprint;
      const warning = GuildSystem.storageIssue
        ? '<p class="guild-warning" role="alert">Salvataggio gilda non disponibile o versione non supportata. Le operazioni non salvate non vengono applicate.</p>'
        : GuildSystem.recovered
          ? '<p class="guild-warning">Salvataggio gilda precedente, incompleto o corrotto: dati disponibili recuperati, campi non validi ripristinati. Le risorse personali restano invariate.</p>'
          : "";
      const note = `<p class="hint guild-prototype">PROTOTIPO LOCALE · Nessuna connessione multiplayer. I contributi sono simulati: non spendono Corone o materiali del personaggio. ${navigator.locks ? "Una sola scheda può modificare la gilda alla volta." : "Questo browser non supporta Web Locks: usa una sola scheda per evitare conflitti."}</p>`;
      if (!g) {
        root.innerHTML =
          warning +
          `<div class="guild-empty"><span class="guild-sigil">${sigil("tower")}</span><h1>Fonda una gilda</h1>${note}<form id="guild-create"><label>Nome<input name="name" minlength="3" maxlength="28" required autocomplete="off" placeholder="Es. Custodi del Vespro"></label><label>Motto<input name="motto" maxlength="72" autocomplete="off" placeholder="Una promessa condivisa"></label><fieldset><legend>Sigillo originale</legend><div class="guild-sigil-options">${GuildData.sigils.map((row) => `<label>${sigil(row.id)}<input type="radio" name="sigil" value="${row.id}" ${row.id === "tower" ? "checked" : ""}><span>${esc(row.name)}</span></label>`).join("")}</div></fieldset><button type="submit">Crea gilda locale</button></form></div>`;
      } else {
        const need = GuildData.xpForLevel(g.level),
          atCap = need === 0,
          percent = atCap ? 100 : Math.floor((g.xp / need) * 100);
        root.innerHTML =
          warning +
          `<header class="guild-hero"><span class="guild-sigil">${sigil(g.sigil)}</span><div><span class="eyebrow">GILDA LOCALE · LIVELLO ${g.level}</span><h1>${esc(g.name)}</h1><p>${esc(g.motto || "Nessun motto")}</p></div></header>${note}<section class="guild-xp"><strong>Esperienza della gilda</strong><span>${atCap ? "LIVELLO MASSIMO" : number(g.xp) + " / " + number(need) + " XP"}</span><div class="xp-bar" role="progressbar" aria-label="Esperienza della gilda" aria-valuemin="0" aria-valuemax="${atCap ? 100 : need}" aria-valuenow="${atCap ? 100 : g.xp}"><span style="width:${percent}%"></span></div></section><section><div class="section-title"><h2>Tesoreria</h2><span>SIMULATA</span></div><div class="guild-treasury">${Object.entries(
            names,
          )
            .map(
              ([key, label]) =>
                `<div><strong data-guild-balance="${key}">${number(g.treasury[key])}</strong><small>${esc(label)}</small></div>`,
            )
            .join(
              "",
            )}</div><form id="guild-contribute"><label>Risorsa<select name="kind">${Object.entries(
            names,
          )
            .map(
              ([key, label]) => `<option value="${key}">${esc(label)}</option>`,
            )
            .join(
              "",
            )}</select></label><label>Quantità<input name="amount" type="number" inputmode="numeric" min="1" max="9999" step="1" value="10" required></label><button type="submit">Simula contributo</button></form><p class="hint">Da 1 a 9999 unità. Ogni contributo assegna max(1, ⌊quantità / 5⌋) XP di gilda, fino al livello 20.</p></section><section><div class="section-title"><h2>Membri</h2><span>${g.members.length}</span></div><div class="guild-members">${g.members.map((m) => `<article data-guild-member="${m.id}"><span class="guild-avatar" aria-hidden="true">${esc(m.name.charAt(0))}</span><div><strong>${esc(m.name)}</strong><small>${esc(GuildData.roles[m.role])} · Liv. ${m.simulated ? m.level : playerLevel}</small><small>${m.simulated ? "Membro demo · simulato" : "Il tuo personaggio · profilo locale"}</small></div><div class="guild-member-contribution"><b>${number(m.contribution)}</b><small>unità contribuite</small></div></article>`).join("")}</div></section><div id="guild-projects-root"></div>`;
      }
      if (draft) {
        for (const input of root.querySelectorAll("input, select")) {
          const value = draft.get(input.name);
          if (value !== null) {
            if (input.type === "radio") input.checked = input.value === value;
            else input.value = value;
          }
        }
      }
      document.dispatchEvent(new Event("guild-rendered"));
    }
    root
      .querySelectorAll('button[type="submit"]')
      .forEach((button) => (button.disabled = busy));
    root
      .querySelectorAll("form")
      .forEach((form) => form.setAttribute("aria-busy", String(busy)));
  }
  document.addEventListener("submit", async (event) => {
    const form = event.target;
    if (!["guild-create", "guild-contribute"].includes(form.id)) return;
    event.preventDefault();
    if (busy) return;
    const fields = new FormData(form);
    busy = true;
    render();
    try {
      const result =
        form.id === "guild-create"
          ? await GuildSystem.createGuild({
              name: fields.get("name"),
              motto: fields.get("motto"),
              sigil: fields.get("sigil"),
            })
          : await GuildSystem.contribute(
              fields.get("kind"),
              fields.get("amount"),
            );
      $("guild-status").textContent = result.message;
    } catch {
      $("guild-status").textContent =
        "Operazione non disponibile. Nessuna ricompensa personale assegnata.";
    } finally {
      busy = false;
      render();
    }
  });
  function initialize() {
    render();
    GuildSystem.subscribe(render);
    // Display the canonical player level without persisting a duplicate guild copy.
    ProgressionStore.subscribe(render);
  }
  if (document.readyState === "loading")
    document.addEventListener("DOMContentLoaded", initialize);
  else initialize();
})();
