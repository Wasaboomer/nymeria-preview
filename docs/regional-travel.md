# Sprint 2.5 — Regional Travel Foundation

The travel foundation shares `nymeria.progression.v1`; there is no new storage key,
background worker, battle clock, reward resolver, race selector or world geography.

## Persistent contract

`travel: { version: 1, active: ticket | null, lastArrival: receipt | null,
recoveryRequired: boolean }` is additive to the progression record.

A ticket contains `id` (`travel-<sequence>`), `routeId`, `originId`, `destinationId`,
`startedAt`, `endsAt`, `durationMs`, `requirementsSnapshot`, `completionId`
(`<id>:arrival`). A receipt adds `arrivedAt`. Idle is `active === null`; traveling
is an active ticket. No separate arrived/unapplied state is necessary: position,
quest visit dispatch, receipt and active-ticket removal are one localStorage write.
Remaining time is derived from the deadline, not stored. Combat speed is unrelated.

`TravelEngine.start(routeId)` reads the current ledger within the progression lock,
checks test-mode availability, origin, accessible destinations, minimum level and
absence of a world encounter, then saves the immutable route/deadline/requirements.
A second start is rejected, including a double tap. No cancellation or route switch.

`refresh()` applies arrival only once. It updates the existing world position and
emits the existing quest `visit` event in the same transaction. Central progression
feedback emits `travelArrived` after successful persistence, with the completion ID
and destination. Reload never re-emits the receipt, moves again or grants rewards.
Future systems should react to durable state, not depend on ephemeral UI events.

UI startup, pageshow, storage, visibility and native foreground recovery reconcile
absolute time. The visible one-second timer only refreshes presentation/completion;
no JavaScript needs to run while suspended. It does not select routes, perform
investigation, accept quests or equip items on behalf of the player.

## Compatibility and invalid records

Old saves without travel normalize to idle, preserving progression, quest progress,
gear and independent profession/guild ledgers. Valid tickets preserve their recorded
travel duration even if the catalogue's duration changes. Route/location IDs must
remain stable in future catalogue revisions. No migration of combat clocks occurs.

Times must be safe, nonnegative integers <= 1e15, with `endsAt - startedAt ===
durationMs`, and duration in (0, 7 days]. Requirements, origin and sequence are
validated. Missing/incoherent active metadata is quarantined as `recoveryRequired`:
no inferred arrival or new departure; the rest of progression is retained. An
explicit recovery procedure is deliberately not part of this sprint. Structurally
valid tickets with mismatched origin/sequence are retained but require recovery;
they are not silently deleted. A valid
receipt wins over its stale duplicate active ticket. Unsupported future travel or
identity schema versions block writes without overwriting the source save.

A valid future start timestamp is retained, not deleted: a backwards clock waits
for the absolute deadline. A forward clock jump can cause arrival immediately.
Invalid current clock values do not apply arrival. Long absence yields one arrival.
Failed writes retain the previous position/ticket and can be retried safely.
Browser process termination around a synchronous setItem follows the same retry/
receipt mechanism; OS-level disk durability cannot be guaranteed by this prototype.

This local implementation is **not secure against clock or save manipulation**.
Multiplayer will require an authoritative backend. `navigator.locks` serializes
cooperative tabs when available; the existing fallback does not guarantee atomic
concurrency between separate tabs/processes on browsers without that API.

## Gameplay identity

`characterIdentity: { version: 1, raceId: null | stableStringId }` is independent of
Equipment appearance. Legacy characters stay unassigned (`null`); valid explicit
IDs survive normalization. No inference from Kaelith, palette, artwork, avatar
anatomy or class, and no UI to assign a race yet. No race catalogue, racial ability,
Thalassi modifier or breathing requirement is introduced.

## Test routes and independent activities

Only `?test=1` lists or starts the two clearly identified technical routes:
Veyra → Sentiero Spezzato (90 s), Sentiero Spezzato → Veyra (120 s).
Production has no test route entry. A previously started test journey still
reconciles after reopening without the parameter, so its state cannot be stranded.
Existing instantaneous world movement is unchanged when idle. While traveling,
world moves/talk/explore/encounters, quest acceptance, profession collection/
crafting/delivery and new arena combat are rejected. Inventory, Equipment, Class,
journal/reward consultation and existing independent Expeditions remain available.
Travel has no XP, currency, loot, stat effect or automatic equip action.

## Future regional adventure (not implemented)

Le Rotte Interrotte, Serenport, Darek Nhal and the Thalassi locations/NPCs are absent.
No defeat rule is changed. For future integration, defeat should return to the
existing safe point, retain completed quest objectives and allow another encounter
without duplicating paid rewards. A fresh journey after defeat must be an explicit
player choice, with a new ticket; do not replay the previous arrival receipt.

## Local validation, not publication

On this DEV checkout: `python -m http.server 8025 --bind 127.0.0.1`; open the local
index with `?test=1`, navigate Mondo → Viaggio regionale · TEST, select the route,
inspect destination/duration/requirements, then Confirm partenza. Refresh before
and after the deadline. The static server can also serve the project under a
subpath because all script references are relative. This is a local test procedure,
not an externally accessible Codex preview or an authorized deployment.

A physical iPhone can use a developer computer on the same trusted LAN running the
server bound to its LAN interface: open that computer's LAN address on port 8025
with `/?test=1`. This requires a local copy of the commit; no push/deploy is needed.
Do not expose the server to the public internet. Existing game saves should not be
reset for these tests. Chromium mobile emulation cannot validate real Safari bars,
process killing, storage eviction or iPhone touch behaviour conclusively.

Tests: `node tests/travel-engine.cjs`; `NYMERIA_TEST_URL=<local-url> node
 tests/travel-browser.cjs`; `NYMERIA_TEST_URL=<local-url> npm test` packages local web
assets and runs the project-selected engine/browser regressions plus travel.

## Validation recorded for this sprint

- Travel engine: 15 checks passed (including both routes and write/read failures).
- Project `npm test` run: 32 suites passed, 0 failed; the additional profession
  browser suite passed separately and is now included in the default runner
  (33 distinct suites exercised in total). Its outdated world button interaction
  was adapted to the existing pagination helper and a touch-enabled map context.
- Travel browser passed at 320/375/390/430 px, heights 667/780/844/932, both at
  the source root and under the packaged `/www/` path. Tests cover explicit choice,
  disabled confirmation, touch target, duplicate start, reload/close/reopen,
  arrival, no payout, storage failure feedback and absence of normal-mode debug.
- Build succeeded; packaged travel JS matches source and uses relative references.
- Physical Safari/iPhone, real OS kill/disk durability and real clock tampering
  security are not validated. No push, deployment or public preview was performed.
