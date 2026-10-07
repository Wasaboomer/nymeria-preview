/* M7.1 Guild Projects UI. Contributions are deliberately simulated. */
(() => {
  if (typeof document === "undefined" || typeof GuildProjectSystem === "undefined" || !GuildProjectSystem) return;
  const esc = (v) => String(v ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const labels = { crowns:"Corone", iron:"Ferro", fiber:"Fibre", ether:"Etere" };
  let message = "", busy = false;
  function render() {
    const root = document.getElementById("guild-projects-root");
    if (!root || !GuildSystem.state.guild) return;
    const state = GuildProjectSystem.state;
    root.innerHTML = `<section class="guild-projects"><div class="section-title"><h2>Progetti di gilda</h2><span>COLLETTIVI</span></div>
      <p class="hint">M7.1 · I contributi ai progetti sono simulati e non consumano ancora le risorse del personaggio.</p>
      ${GuildProjectSystem.storageIssue ? '<p class="guild-warning" role="alert">Salvataggio progetti non disponibile. Le operazioni non salvate non vengono applicate.</p>' : ""}
      ${GuildProjectData.projects.map(project => {
        const row = state.projects[project.id] || {progress:{},completed:false};
        const parts = Object.entries(project.requirements);
        const total = parts.reduce((s,[k,n]) => s + Math.min(n, Number(row.progress[k])||0), 0);
        const need = parts.reduce((s,[,n]) => s+n,0);
        const pct = Math.floor(total/need*100);
        return `<article class="guild-project ${row.completed?"is-complete":""}" data-project="${project.id}">
          <div class="guild-project-head"><div><small>PROGETTO ${project.order}</small><h3>${esc(project.name)}</h3></div><strong>${row.completed?"COMPLETATO":pct+"%"}</strong></div>
          <p>${esc(project.description)}</p>
          <div class="xp-bar" role="progressbar" aria-label="Avanzamento ${esc(project.name)}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${row.completed?100:pct}"><span style="width:${row.completed?100:pct}%"></span></div>
          <div class="guild-project-needs">${parts.map(([k,n]) => `<span class="${(row.progress[k]||0)>=n?"done":""}"><b>${Math.min(n,row.progress[k]||0)} / ${n}</b><small>${labels[k]||k}</small></span>`).join("")}</div>
          <p class="guild-project-reward">${esc(project.reward)}</p>
          ${row.completed ? '<p class="guild-project-complete">✓ Obiettivo collettivo raggiunto</p>' : `<form class="guild-project-form" data-project-form="${project.id}"><label>Risorsa<select name="kind">${parts.filter(([k,n]) => (row.progress[k]||0)<n).map(([k])=>`<option value="${k}">${labels[k]||k}</option>`).join("")}</select></label><label>Quantità<input name="amount" type="number" inputmode="numeric" min="1" max="9999" step="1" value="10" required></label><button type="submit">Simula contributo</button></form>`}
        </article>`;
      }).join("")}
      <p id="guild-project-status" role="status" aria-live="polite">${esc(message)}</p></section>`;
  }
  document.addEventListener("guild-rendered", render);
  document.addEventListener("submit", async (event) => {
    const form = event.target.closest?.("[data-project-form]");
    if (!form) return;
    event.preventDefault();
    if (busy || !GuildSystem.state.guild) return;
    const fields = new FormData(form);
    busy = true;
    form.querySelector("button").disabled = true;
    try {
      const result = await GuildProjectSystem.contribute(form.dataset.projectForm, fields.get("kind"), fields.get("amount"));
      message = result.message;
    } catch {
      message = "Operazione progetto non disponibile. Nessuna modifica applicata.";
    } finally { busy = false; render(); }
  });
  function init(){ render(); GuildProjectSystem.subscribe(render); GuildSystem.subscribe(render); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();
