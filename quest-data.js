/* Quest definitions are content, not engine branches. Counts are per accepted quest. */
const QuestData = (() => {
  const objective = (type, target, count, label) => ({ type, target, count, label });
  const quest = (id, type, title, description, giver, location, prerequisites, minimumLevel, objectives, rewards, nextQuest = null, contentUnlocks = []) => ({ id, type, title, description, giver, location, prerequisites, minimumLevel, objectives, rewards, nextQuest, contentUnlocks });
  const quests = [
    quest("sq-bram-preparation", "side", "Preparati al Sentiero", "Prova facoltativa: raccogli 6 Ferro grezzo al Sentiero Spezzato, forgia due Ferro forgiato e crea un Rinforzo della Frontiera. Consegnalo a Bram per ottenere l’Anello della Frontiera, poi confrontalo in Inventario. Puoi usare un rinforzo già posseduto. La storia prosegue anche senza questa missione.", "bram", "veyra", [], 1,
      [objective("professionDelivery", "frontier-brace", 1, "Consegna un Rinforzo della Frontiera a Bram")], { xp: 0, crowns: 0, items: ["frontier-ring"] }),
    quest("mq01", "main", "Oltre il confine", "Serah cerca qualcuno che guardi oltre i fuochi di Veyra.", "serah", "veyra", [], 1,
      [objective("talk", "serah", 1, "Parla con Serah"), objective("visit", "broken-path", 1, "Visita il Sentiero Spezzato")], { xp: 40, crowns: 6 }, "mq02"),
    quest("mq02", "main", "Nessuno è tornato", "Oren riconosce le tracce della pattuglia. Riporta qualcosa che abbia un nome.", "oren", "broken-path", ["mq01"], 1,
      [objective("kill", "vesper-raider", 3, "Sconfiggi Predoni del Vespro"), objective("collect", "patrol-badge", 3, "Recupera Distintivi della Pattuglia")], { xp: 100, crowns: 12, materials: { iron: 2 } }, "mq03", ["lantern-wood"]),
    quest("mq03", "main", "Luci senza fiamma", "Mira vuole capire la luce che altera gli animali. Il cervo ne porta il segno.", "mira", "veyra", ["mq02"], 2,
      [objective("kill", "corrupt-hound", 2, "Sconfiggi Segugi Corrotti"), objective("collect", "corrupt-sample", 3, "Recupera campioni"), objective("visit", "cold-lantern", 1, "Esamina la lanterna"), objective("defeatBoss", "twilight-stag", 1, "Sconfiggi il Cervo del Crepuscolo")], { xp: 240, crowns: 20, materials: { fiber: 3 } }, "mq04", ["elar-ruins"]),
    quest("mq04", "main", "Pietre che ricordano", "Ilyen conosce le Rovine. I frammenti custodiscono un segnale più antico della Frontiera.", "ilyen", "elar-ruins", ["mq03"], 3,
      [objective("visit", "elar-ruins", 1, "Visita le Rovine di Elar"), objective("collect", "elar-fragment", 3, "Recupera frammenti"), objective("kill", "elar-sentinel", 3, "Sconfiggi le Sentinelle")], { xp: 420, crowns: 28, materials: { ether: 3 }, personalLoot: ["vesper-blade"] }, "mq05", ["vesper-ford"]),
    quest("mq05", "main", "Il Guado", "Serah vuole riaprire il passaggio. Il comandante impedisce di raggiungere l'altra riva.", "serah", "veyra", ["mq04"], 4,
      [objective("kill", "ford-reaver", 3, "Sconfiggi i Razziatori"), objective("defeatBoss", "ford-commander", 1, "Elimina il Comandante"), objective("visit", "far-bank", 1, "Raggiungi la riva opposta")], { xp: 700, crowns: 40, materials: { iron: 4 }, personalLoot: ["frontier-mail"] }, "mq06", ["silent-tower"]),
    quest("mq06", "main", "La Torre Silente", "Il segnale conduce alla Torre. Qualcosa custodisce il silenzio, non la pace.", "serah", "veyra", ["mq05"], 5,
      [objective("visit", "silent-tower", 1, "Raggiungi la Torre"), objective("defeatBoss", "silence-keeper", 1, "Sconfiggi il Custode del Silenzio")], { xp: 1100, crowns: 80, materials: { ether: 8 }, personalLoot: ["silence-plate"], achievements: ["frontier-conqueror"] }),
    quest("sq-herbs", "side", "Erbe nella nebbia", "Mira non promette una cura. Prima vuole sapere che cosa cresce nel Bosco.", "mira", "veyra", ["mq02"], 2,
      [objective("collect", "mist-herb", 3, "Trova tre erbe nel Bosco"), objective("talk", "mira", 1, "Parla con Mira")], { xp: 100, crowns: 10, materials: { fiber: 3 } }),
    quest("sq-debt", "side", "Un debito non pagato", "Bram ha pagato il pedaggio. I predoni hanno tenuto anche la merce.", "bram", "veyra", [], 1,
      [objective("kill", "vesper-raider", 2, "Sconfiggi i predoni")], { xp: 65, crowns: 25 }),
    quest("sq-merchant", "side", "Il mercante smarrito", "Oren ha trovato un carro. Una pattuglia può riportare le casse al mercante dei guadi.", "oren", "broken-path", [], 1,
      [objective("visit", "lost-cart", 1, "Esamina il carro"), objective("kill", "vesper-raider", 1, "Metti in sicurezza il Sentiero"), objective("completeExpedition", "patrol", 1, "Completa e riscuoti Pattuglia delle Rovine")], { xp: 140, crowns: 20, materials: { iron: 2 }, items: ["frontier-ring"] }),
    quest("sq-window", "side", "Una luce alla finestra", "Ilyen giura che quella finestra non esisteva ieri. Ascolta, senza bussare.", "ilyen", "elar-ruins", ["mq03"], 3,
      [objective("visit", "lit-window", 1, "Osserva la finestra"), objective("talk", "ilyen", 1, "Racconta a Ilyen")], { xp: 180, crowns: 15, materials: { ether: 2 } }),
  ];
  return { quests, get: (id) => quests.find((q) => q.id === id), objectiveTypes: ["kill", "collect", "visit", "talk", "completeExpedition", "defeatBoss", "professionDelivery"] };
})();
if (typeof module !== "undefined" && module.exports) module.exports = QuestData;
