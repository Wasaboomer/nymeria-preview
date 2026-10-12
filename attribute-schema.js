/* F1: descriptors only. No defaults, formulas, conversion or active game integration. */
const AttributeSchema = (() => {
  const freeze = value => {
    if (value && typeof value === "object") { Object.values(value).forEach(freeze); Object.freeze(value); }
    return value;
  };
  const primary = [
    { id: "strength", code: "FOR", name: "Forza", purpose: "Potenza fisica" },
    { id: "agility", code: "AGI", name: "Agilità", purpose: "Attacchi agili e schivata" },
    { id: "stamina", code: "STA", name: "Stamina", purpose: "Punti vita e resistenza" },
    { id: "intellect", code: "INT", name: "Intelletto", purpose: "Potenza magica e cure" },
    { id: "spirit", code: "SPI", name: "Spirito", purpose: "Rigenerazione e gestione delle risorse" }
  ];
  const secondary = [
    ["critical", "Critico"], ["haste", "Celerità"], ["accuracy", "Precisione"],
    ["armor", "Armatura"], ["parry", "Parata"], ["block", "Blocco"], ["magicResistance", "Resistenza magica"]
  ].map(([id, name]) => ({ id, name, unit: "undecided" }));
  // Semantic correspondence only; no numeric copying is authorized, even for matching names.
  const legacyCorrespondence = {
    force: { candidate: "strength", status: "semantic-only", conflict: "Legacy coefficients are not a new FOR formula" },
    agility: { candidate: "agility", status: "partial", conflict: "Legacy AGI also drives critical chance and GCD" },
    vigor: { candidate: "stamina", status: "partial", conflict: "Vigor currently derives HP, not a general resistance model" },
    spirit: { candidate: "spirit", status: "incompatible-semantics", conflict: "Legacy SPI contributes to damage, not resource regeneration" },
    critical: { candidate: "critical", status: "semantic-only", conflict: "Legacy points/100; future unit and conversion undecided" },
    speed: { candidate: "haste", status: "partial", conflict: "Legacy speed modifies GCD, not all future haste effects" },
    armor: { candidate: "armor", status: "semantic-only", conflict: "Future physical/magical mitigation undecided" }
  };
  const absentInLegacy = ["intellect", "accuracy", "parry", "magicResistance"];
  const ids = [...primary, ...secondary].map(row => row.id);
  function validateEnvelope(raw) {
    if (!raw || raw.schemaId !== "nymeria.attributes" || raw.version !== 1 ||
        raw.status !== "unassigned" || !raw.values || typeof raw.values !== "object" || Array.isArray(raw.values))
      throw new Error("Unsupported attribute envelope");
    const values = {};
    for (const [key, value] of Object.entries(raw.values)) {
      if (!ids.includes(key) || !Number.isFinite(value) || value < 0) throw new Error("Invalid attribute value");
      values[key] = value;
    }
    // Partial values are allowed only as inactive drafts. Missing values are never zero-filled.
    return freeze({ schemaId: "nymeria.attributes", version: 1, status: "unassigned", values });
  }
  return freeze({ schemaId: "nymeria.attributes", version: 1, active: false,
    primary, secondary, legacyCorrespondence, absentInLegacy,
    unresolvedBlock: "Legacy blockChance/blockReduction are profile modifiers, not an equipment stat",
    validateEnvelope });
})();
if (typeof module !== "undefined" && module.exports) module.exports = AttributeSchema;
