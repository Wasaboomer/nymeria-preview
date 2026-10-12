/* F1: pure, inactive contracts. No simulation, RNG, persistence or gameplay hooks. */
const CombatContracts = (() => {
  const freeze = value => {
    if (value && typeof value === "object") {
      Object.values(value).forEach(freeze);
      Object.freeze(value);
    }
    return value;
  };
  const id = value => typeof value === "string" && /^[A-Za-z][A-Za-z0-9._:-]{0,63}$/.test(value);
  const integer = value => Number.isSafeInteger(value) && value >= 0;
  const actionKinds = freeze(["damage", "heal", "protection", "effect"]);
  const targetRelations = freeze(["self", "ally", "enemy"]);
  function roster(teams, actors) {
    if (!Array.isArray(teams) || !Array.isArray(actors)) throw new Error("Invalid roster");
    const teamIds = new Set(), actorIds = new Set();
    const copyTeams = teams.map(team => {
      if (!team || !id(team.id) || teamIds.has(team.id)) throw new Error("Invalid or duplicate team ID");
      teamIds.add(team.id);
      return { id: team.id };
    });
    const copyActors = actors.map(actor => {
      if (!actor || !id(actor.id) || actorIds.has(actor.id) || !teamIds.has(actor.teamId) ||
          !["alive", "dead"].includes(actor.lifeState) ||
          !Number.isFinite(actor.hp) || !Number.isFinite(actor.maxHp) ||
          actor.maxHp <= 0 || actor.hp < 0 || actor.hp > actor.maxHp ||
          (actor.lifeState === "dead") !== (actor.hp === 0)) throw new Error("Invalid actor identity or life state");
      actorIds.add(actor.id);
      return { id: actor.id, teamId: actor.teamId, lifeState: actor.lifeState, hp: actor.hp, maxHp: actor.maxHp };
    });
    return freeze({ contractVersion: 1, teams: copyTeams, actors: copyActors });
  }
  // Single-target intent only. Validation does not execute healing/protection/effects.
  function actionIntent(raw, encounter) {
    if (!raw || !id(raw.id) || !id(raw.abilityId) || !actionKinds.includes(raw.kind) ||
        !targetRelations.includes(raw.relation)) throw new Error("Invalid action intent");
    if (!encounter || encounter.contractVersion !== 1) throw new Error("Invalid roster contract");
    encounter = roster(encounter.teams, encounter.actors);
    const source = encounter.actors.find(actor => actor.id === raw.sourceId);
    const target = encounter.actors.find(actor => actor.id === raw.targetId);
    if (!source || !target || source.lifeState !== "alive" || target.lifeState !== "alive")
      throw new Error("Unknown or dead actor");
    const relation = source.id === target.id ? "self" : source.teamId === target.teamId ? "ally" : "enemy";
    if (relation !== raw.relation) throw new Error("Target relation mismatch");
    return freeze({ contractVersion: 1, id: raw.id, abilityId: raw.abilityId,
      sourceId: source.id, targetId: target.id, kind: raw.kind, relation });
  }
  const legacy = freeze({
    id: "legacy-1v1", version: 1, executable: true,
    stepSeconds: 0.05,
    phases: ["resourceUpdate", "playerEffectTicksAndExpiry", "enemyEffectTicksAndExpiry",
      "deathCheckBeforeActions", "playerAction", "deathCheckAfterPlayer", "enemyAction", "deathCheckAfterEnemy"],
    rng: {
      playerAttack: ["critical", "eligibleItemHooksInInventoryOrder"],
      enemyAttack: ["dodge", "blockOnlyIfNotDodgedAndBlockChancePositive"],
      buff: [],
      note: "Eligibility short-circuits precede rolls. A lethal player hit skips effects/item hooks and enemy action. RNG initialization is separate."
    }
  });
  // Read only the dedicated metadata. Activity rulesVersion is not an engine version.
  // Absence denotes existing unversioned 1v1 semantics, not a future default engine.
  function rulesForReplay(replay) {
    if (!replay || typeof replay !== "object" || Array.isArray(replay)) throw new Error("Invalid replay");
    if (!Object.prototype.hasOwnProperty.call(replay, "simulationRules")) return legacy;
    const rules = replay.simulationRules;
    if (!rules || rules.id !== legacy.id || rules.version !== legacy.version)
      throw new Error("Unsupported simulation rules: preserve replay without reinterpretation");
    return legacy;
  }
  // F1 future scheduling contract only; NEVER applied to legacy CombatEngine.step().
  const phases = freeze(["resource", "periodic", "expiry", "action", "terminal"]);
  function orderedEvents(events) {
    if (!Array.isArray(events)) throw new Error("Invalid events");
    const seen = new Set(), eventIds = new Set();
    const copy = events.map(event => {
      if (!event || !integer(event.tick) || !phases.includes(event.phase) || !id(event.sourceId) ||
          !integer(event.sequence) || !id(event.id)) throw new Error("Invalid event key");
      const key = JSON.stringify([event.tick, event.phase, event.sourceId, event.sequence]);
      if (seen.has(key) || eventIds.has(event.id)) throw new Error("Ambiguous event order or duplicate event ID");
      eventIds.add(event.id);
      seen.add(key);
      const draws = event.draws === undefined ? [] : event.draws;
      if (!Array.isArray(draws) || !draws.every(id) || new Set(draws).size !== draws.length)
        throw new Error("Invalid declared RNG draws");
      return { id: event.id, tick: event.tick, phase: event.phase, sourceId: event.sourceId, sequence: event.sequence, draws: [...draws] };
    });
    copy.sort((a, b) => a.tick - b.tick || phases.indexOf(a.phase) - phases.indexOf(b.phase) ||
      (a.sourceId < b.sourceId ? -1 : a.sourceId > b.sourceId ? 1 : 0) || a.sequence - b.sequence);
    return freeze(copy);
  }
  // Eligible future events declare draw labels after gates are evaluated. This
  // describes stream consumption only; it never rolls or defines probabilities.
  function plannedDraws(events) {
    return freeze(orderedEvents(events).flatMap(event => event.draws.map((label, index) =>
      ({ eventId: event.id, sourceId: event.sourceId, label, localIndex: index }))));
  }
  return freeze({ version: 1, actionKinds, targetRelations, roster, actionIntent,
    legacy, rulesForReplay, futureOrder: { phases, orderedEvents, plannedDraws, rngPolicy: "single-seeded-stream-after-eligibility" } });
})();
if (typeof module !== "undefined" && module.exports) module.exports = CombatContracts;
