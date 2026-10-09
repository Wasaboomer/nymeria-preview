# Sprint 2.6 — Character Identity & Environmental Travel Rules

## Identity independent of appearance

The existing progression ledger owns `characterIdentity: {version:1,raceId:null|id}`.
Stable IDs: `human` (Umani), `velhiri`, `kharun`, `sylani`, `thalassi`, `draeth`,
`orlani`. `character-identity-data.js` is the catalogue/normalizer; no skin, model,
class or equipment attribute is used to infer identity. Missing/invalid IDs become
unassigned; a future identity schema version blocks writes without overwriting.
Known Sprint 2.5 IDs are retained. No automatic human assignment or required choice.

An independent card in **Eroe → Identità del personaggio** warns that environmental
racial differences remain incomplete. The player explicitly chooses and confirms;
normal-mode assignment is once-only, surviving reload. It does not invoke the
Character Creator, renderer or Equipment saves. Unassigned characters can continue
all existing functionality. Assignment/reset is unavailable during travel or travel
recovery, to keep departure requirements stable.

Only `?test=1` permits changing an assigned race or resetting it to unassigned.
This is clearly labelled TEST; ordinary mode has no reset/change controls. There
is no new save key or new racial stat/combat calculation. Failed identity writes
leave all committed state unchanged and show feedback. There are no seven new
avatar anatomies: the gameplay label does not redraw the provisional avatar.

## Single declarative travel model and central policy

The two existing technical routes remain the only playable catalogue entries:
Veyra → Sentiero Spezzato (land, 90 s), return to Veyra (coastal, 120 s). These labels
are technical tests, not a redesign of geography. They work with `raceId:null`.
No underwater route, city, NPC or mission is added to the game.

Route data contains `environment`, `baseDurationMs`, `available`, optional
`unavailableReason`, existing minimum-level requirements and
`environmentRequirements:{capabilities:[],tools:[],assistance:[]}`. The old
`durationMs` remains for compatibility; new departures use the base duration.

`TravelAccess.evaluateRouteAccess(characterIdentity,route,context)` is a pure policy;
`context.level` is the real progression level and context availability/reason comes
from the travel engine's origin/unlock/encounter/test-mode checks. It returns:
`accessible`, `satisfiedRequirements`, `missingRequirements`, `reason`, environment,
race, base duration, `environmentalModifiers:[]`, `externalSupportImplemented:false`.
`TravelSystem.evaluate()` wraps it; both UI and transactional departure use it.
Malformed definitions and unsupported capabilities fail closed.

Land/coastal impose no racial gate or penalty. Thalassi have natural `breathe-land`
and `breathe-underwater` capabilities; the other six have `breathe-land`. Underwater
requires underwater breathing even when an incomplete route omits that capability.
A missing/unknown race cannot prove the capability. No capabilities affect Combat.

Satisfied capability records identify `source:'natural'`; missing ones identify
`source:'unmet'` and unavailable external alternatives. `source:'external'` is
reserved by the model but cannot be emitted as satisfied in this sprint. Declared
tools/assistance remain unmet because no authoritative external means implementation
exists. Assertions passed through context (tools, guides, capabilities or a flag)
are never accepted as evidence. Respiratory equipment, guides, consumables,
assistance resolution, affinities and duration modifiers are explicitly deferred.

## Departure snapshots, migration and offline behaviour

New departures record `requirementsSnapshot.version:2` with satisfied status,
level, unlocked origin/destination, chosen race, environment, satisfied requirement
records and an empty modifiers array. Arrival uses the durable ticket/deadline;
it never reruns current environmental access policy or recalculates duration.

Sprint 2.5 version-1 snapshots remain valid without requiring environmental fields.
Race migration does not alter tickets, currency, equipment, quest progress,
profession/guild records or combat clocks. Future requirement snapshot versions
block writes. Malformed version-2 records use the existing travel quarantine,
without inventing an arrival. All Sprint 2.5 receipt/idempotency and clock rules
remain, as do Sprint 2.4 automatic encounters/Expeditions and explicit combat pause.

The local save remains vulnerable to intentional edits/clock manipulation and
storage eviction; authoritative multiplayer requires a backend. Cooperative-tab
locking uses the existing progression writer and its existing API availability
limits. Actual OS-level write durability cannot be proved by emulation.

## Tests and local inspection (no deployment)

`tests/identity-environment-engine.cjs` tests the catalogue, invalid IDs, unassigned
characters, all land/coastal identities, underwater capability and fake external
means, declaration errors, assignment/TEST reset, storage rollback, unchanged
appearance/progression, legacy version-1 tickets, persisted version-2 snapshots,
policy changes after departure and duplicate/long-offline arrival.

Underwater fixtures exist only in this test, never registered as travel routes.
The browser test checks 320/375/390/430 px, heights 667/780/844/932, touch controls,
normal/TEST separation, appearance preservation, reload, no-race travel, foreground
recovery, quota feedback and no JS/asset errors. The default npm runner includes it.

To inspect locally, build with `npm run build:web`, serve `www` on the developer
computer and open the local site: **Eroe → Identità del personaggio**, or add
`?test=1` to exercise change/reset and **Mondo → Viaggio regionale · TEST**.
Do not push or publish this sprint without separate authorization. Physical Safari
and iPhone process/storage behaviour require user testing; Chromium touch emulation
is not evidence of physical Safari compatibility.

Validation result: `npm test` passed all 35 suites (19 engine, 16 browser), with
zero failed suites. The new engine suite passed nine grouped checks; the new
browser suite passed all four width profiles and failed-storage feedback checks.
`git diff --check` also passed. No physical Safari test, push or deployment was
performed for Sprint 2.6.
