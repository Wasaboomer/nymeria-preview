/* Semantic events from successful central ledger commits. No DOM, queue or reward writes. */
const ProgressionEvents = (() => {
  const node = typeof module !== "undefined" && module.exports;
  const data = node ? require("./progression-data.js") : ProgressionData;
  const world = node ? require("./world-data.js") : WorldData;
  function changes(before, after, cls) {
    const events = [];
    if (after.level > before.level) events.push({ type: "levelUp", payload: {
      previousLevel: before.level, resultingLevel: after.level, levelCap: data.levelCap,
      classId: cls.id, className: cls.name,
      statGains: data.statGains(cls.statGrowthPerLevel, after.level - before.level),
    } });
    const added = (old = [], next = []) => next.filter(id => !old.includes(id));
    for (const id of added(before.unlockedContent, after.unlockedContent)) {
      if (id.startsWith("world:")) {
        const location = world.location(id.slice(6));
        if (location && !location.discoveryType) events.push({ type: "areaUnlocked", payload: { id, name: location.name } });
      }
    }
    for (const id of added(before.frontier?.discoveries, after.frontier?.discoveries)) {
      const entry = world.discoveries.find(x => x.id === id);
      if (entry) events.push({ type: "discovery", payload: { ...entry } });
    }
    for (const id of added(before.frontier?.achievements, after.frontier?.achievements)) {
      const entry = world.achievements.find(x => x.id === id);
      if (entry) events.push({ type: "achievement", payload: { ...entry } });
    }
    return events;
  }
  return { changes };
})();
if (typeof module !== "undefined" && module.exports) module.exports = ProgressionEvents;
