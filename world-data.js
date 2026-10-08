/* M6 names, lore and encounter templates. No save state or DOM. */
const WorldData = (() => {
  const zone = {
    id: "vesper-frontier", name: "Frontiera del Vespro",
    description: "Le pattuglie scompaiono sul Sentiero. Le lanterne del Bosco si spengono. Da Elar arriva un segnale che nessuno riconosce.",
    epilogue: "La Torre tace, ma sotto le pietre il segnale continua. Oltre la Frontiera, qualcuno ha risposto.",
  };
  const locations = [
    { id: "veyra", name: "Avamposto di Veyra", level: 1, mark: "haven", description: "Un fuoco basso, cinque voci e una frontiera da tenere insieme.", initial: true, enemies: [], points: [] },
    { id: "broken-path", name: "Sentiero Spezzato", level: 1, mark: "path", description: "Orme interrotte e distintivi abbandonati fra le pietre.", initial: true, enemies: ["vesper-raider"], points: [{ id: "lost-cart", name: "Carro abbandonato", text: "Bram riconoscerebbe queste casse. Le tracce portano al Guado." }] },
    { id: "lantern-wood", name: "Bosco delle Lanterne Spente", level: 2, mark: "wood", description: "Nessuna fiamma nelle lanterne. Qualcosa respira fra gli alberi.", unlockHint: "Concludi Nessuno è tornato", enemies: ["corrupt-hound", "lantern-spider", "twilight-stag"], points: [{ id: "cold-lantern", name: "Lanterna senza fiamma", text: "Il vetro è freddo. Una luce si muove al suo interno." }, { id: "mist-herbs", name: "Erbe nella nebbia", text: "Una pianta comune, segnata dalla stessa luce. Mira vuole esaminarla.", collect: "mist-herb" }] },
    { id: "elar-ruins", name: "Rovine di Elar", level: 3, mark: "ruins", description: "Pietre anteriori ai nomi. I guardiani proteggono un ricordo.", unlockHint: "Concludi Luci senza fiamma", enemies: ["elar-sentinel"], points: [{ id: "tablet_of_elar", name: "Tavoletta di Elar", text: "Le incisioni sembrano formare una lingua dimenticata.", discovery: "tablet_of_elar" }, { id: "lit-window", name: "Finestra illuminata", text: "Dietro la pietra murata, una luce saluta. Non c'è nessuna stanza." }] },
    { id: "vesper-ford", name: "Guado del Vespro", level: 4, mark: "ford", description: "Il passaggio è chiuso. Dall'altra riva si vede la Torre.", unlockHint: "Concludi Pietre che ricordano", enemies: ["ford-reaver", "ford-commander"], points: [{ id: "far-bank", name: "Riva opposta", text: "Il sentiero verso la Torre è finalmente libero.", requiresDefeat: "ford-commander" }] },
    { id: "silent-tower", name: "Torre Silente", level: 7, mark: "tower", description: "Un'ombra sulla soglia. Il silenzio, qui, ha un custode.", unlockHint: "Concludi Il Guado", enemies: ["silent-shade", "silence-keeper"], points: [] },
    { id: "vesper-outpost", name: "Vesper Outpost", level: 1, mark: "haven", description: "The beacon burns above the restored walls. A guild foothold now holds the frontier road.", unlockHint: "Guild Project · Vesper Beacon", discoveryType: "GUILD_PROJECT", enemies: [], points: [{ id: "outpost-board", name: "Frontier Board", text: "Scouts report movement along the Northern Trail. More of the frontier remains uncharted." }] },
  ];
  // Travel presentation graph; existing unlock/visit rules remain in WorldEngine.
  const connections = {
    veyra: ["broken-path"], "broken-path": ["veyra", "lantern-wood"],
    "lantern-wood": ["broken-path", "elar-ruins"], "elar-ruins": ["lantern-wood", "vesper-ford"],
    "vesper-ford": ["elar-ruins", "silent-tower"], "silent-tower": ["vesper-ford"],
    "vesper-outpost": ["veyra"],
  };
  const npcs = [
    { id: "serah", name: "Capitana Serah Venn", role: "Comandante", location: "veyra", dialogues: [{ text: "Non chiedo promesse. Vai al Sentiero e dimmi cosa resta della pattuglia." }, { after: "mq02", text: "Quei distintivi... conoscevo ogni nome. Il Bosco ci deve una risposta." }, { after: "mq06", text: "Hai tenuto aperta la Frontiera. Ma il segnale non si è spento." }] },
    { id: "oren", name: "Oren Vale", role: "Esploratore", location: "broken-path", dialogues: [{ text: "Le tracce finiscono tutte qui. Nessuno torna dalla stessa direzione." }, { after: "mq03", text: "Il cervo non era la causa. Seguiva qualcosa, verso Elar." }] },
    { id: "mira", name: "Mira Thalen", role: "Guaritrice e studiosa", location: "veyra", dialogues: [{ text: "Portami campioni, non supposizioni. E non respirare la nebbia troppo a lungo." }, { after: "mq03", text: "Questa luce non è una malattia. Sembra una memoria." }] },
    { id: "bram", name: "Bram", role: "Mercante", location: "veyra", dialogues: [{ text: "Il mio carro è sul Sentiero. Io sono qui: una pessima proporzione." }, { after: "sq-merchant", text: "Le pattuglie hanno recuperato le casse. Ti devo più di una buona parola." }] },
    { id: "ilyen", name: "Ilyen", role: "Custode delle conoscenze", location: "elar-ruins", dialogues: [{ text: "Elar non è morta. Ha soltanto dimenticato come parlarci." }, { after: "mq04", text: "Conserva la Tavoletta. Un giorno sapremo quali domande farle." }] },
  ];
  function enemy(id, name, level, maxHp, damage, armor, speed, kind, xp, crowns, drops = []) {
    return {
      id, name, level, maxHp, armor, speed, kind, attackInterval: 2.8 / speed,
      rewards: { xp, crowns }, drops,
      attacks: [
        { id: `${id}-special`, name: kind === "boss" ? "Rintocco vuoto" : kind === "miniboss" ? "Assalto del crepuscolo" : "Assalto", damage: Math.round(damage * 1.55), cooldown: 9, initialDelay: 5 },
        { id: `${id}-strike`, name: "Colpo", damage, cooldown: 0, initialDelay: 0 },
      ],
    };
  }
  const enemies = [
    enemy("vesper-raider", "Predone del Vespro", 1, 320, 18, 8, 0.9, "normal", 16, 2, ["patrol-badge"]),
    enemy("corrupt-hound", "Segugio Corrotto", 2, 420, 26, 5, 1.25, "normal", 24, 3, ["corrupt-sample"]),
    enemy("lantern-spider", "Ragno delle Lanterne", 2, 290, 20, 15, 1.4, "normal", 22, 3, ["corrupt-sample"]),
    enemy("elar-sentinel", "Sentinella di Elar", 3, 550, 28, 42, 0.8, "normal", 36, 4, ["elar-fragment"]),
    enemy("ford-reaver", "Razziatore del Guado", 4, 630, 32, 24, 1.05, "normal", 44, 5),
    enemy("silent-shade", "Ombra Silente", 6, 850, 43, 12, 1.45, "normal", 65, 7),
    enemy("twilight-stag", "Cervo del Crepuscolo", 3, 1250, 42, 20, 1.15, "miniboss", 70, 8, ["corrupt-sample"]),
    enemy("ford-commander", "Comandante del Guado", 5, 1120, 40, 38, 0.95, "miniboss", 110, 12),
    enemy("silence-keeper", "Custode del Silenzio", 8, 1800, 50, 45, 1.05, "boss", 180, 20),
  ];
  const discoveries = [{ id: "tablet_of_elar", name: "Tavoletta di Elar", description: "Le incisioni sembrano formare una lingua dimenticata.", status: "Non decifrata", requirement: "Richiede Archeologia 10" }];
  const achievements = [{ id: "frontier-conqueror", name: "Conquistatore della Frontiera", type: "title" }];
  const supplyNames = { "patrol-badge": "Distintivo della Pattuglia", "corrupt-sample": "Campione corrotto", "elar-fragment": "Frammento di Elar", "mist-herb": "Erba della nebbia" };
  const location = (id) => locations.find((x) => x.id === id);
  const enemyById = (id) => enemies.find((x) => x.id === id);
  return { zone, locations, connections, npcs, enemies, discoveries, achievements, supplyNames, location, enemy: enemyById };
})();
if (typeof module !== "undefined" && module.exports) module.exports = WorldData;
