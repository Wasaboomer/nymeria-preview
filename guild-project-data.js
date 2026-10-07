/* M7.1 Guild Projects catalogue. Prototype resources remain isolated from player economy. */
const GuildProjectData = (() => {
  const projects = [
    {
      id: "vesper-watchtower",
      name: "Faro del Vespro",
      description: "Rinforza un antico punto di vedetta per dare alla gilda un primo presidio comune sulla Frontiera.",
      requirements: { crowns: 120, iron: 80, fiber: 40 },
      reward: "Sblocca: Presidio del Vespro",
      order: 1,
    },
    {
      id: "mist-cartography",
      name: "Carte delle Brume",
      description: "Raccogli mappe, corde e strumenti per preparare future spedizioni collettive oltre i sentieri noti.",
      requirements: { crowns: 180, fiber: 100, ether: 30 },
      reward: "Sblocca: Preparativi delle Brume",
      order: 2,
    },
  ];
  const byId = (id) => projects.find((p) => p.id === id) || null;
  return { schemaVersion: 1, projects, byId };
})();
if (typeof module !== "undefined" && module.exports) module.exports = GuildProjectData;
