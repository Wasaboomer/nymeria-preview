# Sprint 2.7 — Mobile UX & Navigation Polish

This sprint changes presentation and navigation only. Quest definitions/engines,
travel access/timestamps/receipts, identity persistence, progression, combat,
professions, inventory and the character renderer remain unchanged.

## Map and current place

The map has one compact context card with the saved current location, an action
to open that location's existing activities and, when the existing travel system
offers routes or a saved journey, a regional-travel shortcut. It does not add map
nodes or movement rules. Opening the current location remains navigation-only.
The map/locality/itinerary labels are consistent with the existing Back stack.
Successful quest destination/giver navigation now opens the locality on that
stack, instead of discarding the quest screen. Back returns to the quest; it does
not move the character back or undo objective progress.

## Reusable next step

`QuestUI.nextStep(quest,state)` projects the existing status, first unfinished
objective, count/progress, real destination, accessibility and unlock hint. The
tracker, journal and guidance use it. Guidance presents the objective, progress,
destination and existing action; locked destinations show their real unlock hint
without a travel action. Unknown destinations stay unknown with neutral copy,
never silently falling back to the quest giver's location.

Existing objective markers on NPCs, enemies, drops and points remain in use.
No new objective, acceptance/claim rule or reward is introduced. Profession
delivery continues to use its existing preparation/contribution guidance.

## Three travel presentation states

* Ready: origin, explicit destination selector, environment/base duration, central
  access-policy result and `Parti`, disabled until the route is usable.
* Active: origin/destination and a prominent remaining-time display from the
  existing absolute deadline. It uses `TravelSystem.remaining()`, never a second
  countdown state, duration or persistent timer. Existing recovery/arrival logic
  remains the only authoritative source.
* Arrived: explicitly completed historical receipt, reached destination, return
  to the current place and a separate `Prepara un nuovo viaggio` action when a
  route exists. That action changes UI state only. The ready view labels any old
  receipt as `Ultimo arrivo`; it cannot be mistaken for an active trip.

The content heading names the state; navigation names the itinerary. The repeated
regional-travel headings and technical route-description repetition are removed.
Recovery/storage failures remain visible. Underwater routes remain test fixtures
only; this sprint exposes no new playable route or external means.

## Mobile presentation

Scoped `mobile-navigation-polish.css` uses the existing green/gold palette,
readable 16px selectors (avoiding small-field focus zoom), separate label rows,
48px controls, wrapping copy and a tabular-numeral timer. The identity card states
the assigned race and distinguishes initial confirmation, TEST change and TEST
reset. All seven options and the existing normal-mode lock remain unchanged.

The viewport shell, safe areas, visualViewport sizing, internal panel scroll and
adaptive pagination remain in place; no new scroll container is introduced. Short
screens can use existing pagination for travel/locality content, while mission
and character panels retain their authorized internal scroll. No information is
removed to force a fit.

## Validation and limits

`mobile-polish-engine.cjs` tests next-step projection, real destination/lock/action
selection, progress, unknown-data fallback, escaping and absence of state writes.
`mobile-polish-browser.cjs` tests map/locality/travel/Back, real mission accept/talk/
visit actions, returning to the quest, locked quest requirements, long-copy/scroll,
identity layout/persistence, all three travel states, deadline display, receipt
idempotency, new trip, save preservation and normal/TEST separation.

Mobile profiles use Chromium touch emulation at 320/375/390/430px and multiple
heights (568/667/844/932px in the new test). They are not physical Safari tests.
Actual iPhone safe areas, Safari chrome/native selectors and OS termination still
require user validation. No push/deployment is authorized for this sprint.

Validation completed: `npm test` built the web package and passed all 37 suites
(20 engine, 17 browser), zero failed. This includes all 35 previous suites and the
two new Sprint 2.7 suites. The new browser checks passed all four widths/heights,
long-copy/internal scrolling, real quest destination/Back, save preservation,
travel states and once-only arrival. `git diff --check` passed. Screenshots were
inspected locally at 390×844; they are temporary artifacts outside the repository.
Physical Safari was not tested. No push or deployment was performed.
