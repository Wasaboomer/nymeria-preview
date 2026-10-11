# Sprint 2.9D-A — Equipment contract and 2H personal loot

This is a foundation, not a playable specialization. Production still registers
only Baluardo, Ritorsione, Comando, Predatore, Laceratore and Esploratore. No ability,
combat formula, class growth, narrative reward quantity or encounter was changed.

## Single contract, two distinct questions

`ClassesData` owns weapon/support compatibility, physical support compatibility,
wearability and complete-kit validation. `ClassSystem.kitRequirements()` exposes
the resolved requirements; Equipment delegates to the central wearability check,
Advisor and PersonalLoot share the item validators, and preparation validates the
complete profile. Combat and expedition guidance reads the resolved kit label.

Legacy wearability is deliberately preserved: a legacy character may inspect and
wear an otherwise unsuitable weapon, but cannot begin an activity with an invalid
complete kit. Future non-legacy selections enforce their resolved families when
wearing weapon/support items. Armor, level and target-slot checks remain in
Equipment. Required support needs a compatible support; optional support may be
empty; forbidden support must be empty. Physical 2H weapons never allow support.

Changing a selection never equips/removes items. An explicit equip of a 2H weapon
still clears the worn support, retaining its inventory ownership. Reload does not
remove a main weapon merely because a selection has made the complete kit invalid.
No cross-store atomicity is claimed.

## Catalogue and graphics

Existing `greatsword` and `spear` and all other 69 legacy records are unchanged.
New catalogue-only entries (not automatically granted):

| ID | Item level / required level | Stats |
| --- | --- | --- |
| greataxe | 11 / 1 | Force 15, Vigor 1 |
| warhammer | 11 / 1 | Force 13, Vigor 5 |

These match the provisional power budget of the existing greatsword (Force 14,
Vigor 3). They have no dedicated artwork. Their unavailable appearance returns
no visual module, rather than silently pretending a sword/staff is an axe/hammer.
The item description states the missing appearance. Existing spear art remains a
shared staff fallback; new spear counterparts explicitly describe that fallback.

Personal groups for `vesper-blade`, `lunar-bow`, `ether-quiver` append four 2H
counterparts each: `{frontier,vigil,stellar}-{greatsword,spear,greataxe,warhammer}`.
They inherit each source tier's rarity, item level and required level. Greatsword
stats at the three tiers are Force/Vigor 15/3, 17/4 and 20/5; axe trades two Vigor
for one Force, hammer trades one Force for two Vigor, spear trades one Force for
two Agility. These are provisional data, not a validated Vendicatore balance.
The forbidden-support preparation receives a tier-specific 2H weapon instead of
the personal support reward. Existing variants keep their original order and IDs.

## Persistence and rewards

Personal-loot policy remains version 1, with an additive `supportPolicy` only when
present in a new profile's resolved requirements. Legacy preparation retains its
exact old shape. Unknown policy values are rejected. Missing policy keeps legacy
semantics. Stored loot IDs, active snapshots and accepted quest preparation are
not regenerated when a selection changes. No save migration or new selection is
introduced. World/shared/trade ownership is not filtered by personal-loot rules.

## Verification

`two-hand-engine.cjs` covers all four families and every current expedition and
personal quest table, slot/support policies, explicit equip, shield ownership,
Advisor/preparation agreement, selection/reload, frozen World and Expedition
snapshots, narrative preparation and once-only claims. A hash pins all 69 legacy
catalogue records to 9ec9d4b. The existing specialization benchmark checks six
profiles and 90,000 deterministic snapshots.

`two-hand-browser.cjs` tests four widths (320/375/390/430), three heights
(568/667/844), real touch equip, disabled incompatible support, reload, no
selection side effects, overflow and JavaScript/rejection monitoring. A kit fixture
is injected only by the tests; it is never registered by production scripts.
Physical Safari/iPhone remains unverified. No manual deployment is performed.

Final validation: 22 engine suites and 25 browser suites passed, including reruns
following the isolated Combat fixture dependency correction; no runner suites were
skipped. That fixture now loads the shared validator while retaining Equipment's
standalone legacy behavior without ClassSystem. Production build succeeded.
