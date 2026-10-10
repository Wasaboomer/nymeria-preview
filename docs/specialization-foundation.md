# Sprint 2.9C — Specialization Foundation

The class retains identity, armor proficiency and stat growth. `ClassesData.resolve`
returns a copied, versioned identity/specialization contract. The specialization
owns role, equipment requirements, passive, abilities, resource, AUTO priorities,
modifiers and Gear Advisor weights. Only the six existing builds are registered:
Baluardo, Ritorsione, Comando, Predatore, Laceratore and Esploratore.

`ClassSystem.combatProfile` adapts this contract to the existing complete engine
profile. Legacy snapshots retain their original fields and values. CombatEngine,
damage formulas, rewards, XP, equipment, quests and character artwork are unchanged.
A selection alone never equips or removes an item. Existing class armor
reconciliation remains unchanged.

## Persistence

Selection migrates additively from `nymeria.classes.v1` to version 2 at
`nymeria.classes.v2`. Legacy identifiers and source records are retained.
Migration is idempotent; unsupported/corrupt new records are not overwritten.
A failed selection write does not commit an in-memory selection.
Progression's default class lookup prefers version 2 and falls back to version 1.

Combat preferences migrate from v1/v2 to `nymeria.combat.v3`. The six legacy builds
continue to share strategy preferences within each class, preserving current
AUTO/PERSONALIZZATA behavior. Future specializations have separate entries.
`CombatUI.STORAGE_KEY` is obtained from the preference store, rather than duplicating
its key. Failed writes are reported; unknown versions are protected against writes.
There is no atomic transaction across selection, preferences, equipment and
progression stores. Existing activities retain the profile and personal-loot
preparation captured at their start; they are not reinterpreted on migration.

## Equipment contract

Central `weaponCompatible`, `supportCompatible` and `validKit` validators support
required, optional and forbidden off-hand policies. Existing Custode and
Cacciatore kits remain required. Preparation and Advisor consume the resolved
requirements. No future kit, ability, class or specialization is introduced.

## Verification

`tests/fixtures/specialization-legacy.json` is an intentional regression baseline
captured from commit a1bc56b43a9e9818b3407a036244190417e54edd. Six complete profiles
and 90 configurations × 1000 seeds compare full deterministic final snapshots.
The engine suite covers migration, denied/corrupt/future storage, kit policies,
custom preferences, immutable World/Expedition preparation, Smart Loot and unique
rewards. The browser suite covers initialization, touch build selection, reload,
unchanged gameplay state, JavaScript errors and rejected promises at widths
320/375/390/430 and heights 568/667/844.

Physical Safari/iPhone and Android validation remains necessary. Browser emulation
does not establish physical-device compatibility. Vendicatore is not implemented.

Two supplementary historical browser suites (`combat-browser.cjs` and
`class-build-browser.cjs`) fail before their combat assertions because their
navigation helper taps controls outside the fixed viewport. The same failures
were reproduced by serving the pre-Sprint modules from the baseline commit via
browser request interception. These are pre-existing automation limitations;
production UI was not changed to satisfy them. The current runner's mobile and
specialization suites exercise the supported navigation and gameplay paths.
