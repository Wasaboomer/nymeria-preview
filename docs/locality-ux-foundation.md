# Phase 1 — Località / Missioni / Inventario / Menu

DEV-only UI foundation. No gameplay, storage schema, character renderer or class changes.

- `navigation.js` owns routes, Back, focus and panel-scroll restoration. The four primary destinations are Località, Missioni, Inventario and Menu. Menu opens its hub; Eroe and Classe/Strategia are secondary destinations. Località never restores a terminal encounter or a cached preparation as its primary destination.
- Atlante is the existing `world/overview` route, opened from Località. Opening it reads the world state without moving the player; entering a destination still invokes the existing guarded WorldSystem action.
- `world-ui.js` still creates live interaction controls and owns their handlers. It requests a locality-specific tracker from QuestUI.
- `quest-ui.js` still derives objectives and actions from the current game state. The locality tracker prefers the explicitly tracked active/completed quest, falling back to the next main quest. Its local presentation omits unrelated previous reward comparisons; original quest reward details remain accessible in their own context.
- `locality-ui.js` is the existing locality presenter, not a new adapter. It groups live controls, keeps the tracker visible across activity categories, and replaces duplicate primary-action controls with an explanatory note. No new actions or services are inferred from NPC roles.
- `locality-ui.css` styles the location illustration, compact tracker and activity categories inside the existing fixed shell. Environmental illustrations are the existing local SVG assets, not newly commissioned paintings. The approved concept board guides hierarchy, antique gold and dark panels; its painterly artwork is not reproduced by these existing assets.

The character systems remain intact and accessible through Menu → Eroe. No avatar or customization work is included. Active encounter navigation rules are unchanged.

## Validation

`npm test` runs the existing regression suite plus `locality-foundation-browser.cjs`.
The new test covers four primary destinations, the always-visible tracker, deduplicated encounter actions, locked destinations, Atlas consultation without travel, Back/focus, Menu → Eroe, reload and unchanged save data at 320/375/390/430 px and 568/667/844 px heights.
Existing journey and combat tests retain the actual action/visibility/unique-reward checks, with selectors updated to allow the primary tracker action instead of requiring the old duplicated activity button. Existing hero-entry tests now use Menu → Eroe.

Browser automation uses Chromium with mobile/touch emulation. Physical Safari/iPhone and Android validation remains required. No manual deployment is part of this change.

## Recorded verification

The full existing runner executed 53 suites: 49 passed initially; four failed during integration. The Menu context regression was fixed, and legacy test paths/selectors were updated for Menu → Eroe and the single primary action. All four failing suites were rerun successfully at all four widths. The added locality foundation suite also passed, including local scroll restoration, explicit travel, reward-ready presentation and duplicate-claim rejection. Final validated total: 54 suites (25 engine + 29 browser), no remaining failures. The deterministic legacy engine check retained 90,000 identical snapshots. Final `npm run build:web` passed.

This records the complete run plus targeted reruns, not a claim that the initial `npm test` returned zero failures. Physical Safari/iPhone and Android testing has not been performed.

## Corrective locality UX

Locality uses one internal scrolling surface: environmental banner, description, tracked quest/story status, actual NPCs/points/encounters/gathering, connected destinations and one Atlas entry. WorldUI owns markup and handlers; LocalityUI no longer moves nodes into tab containers. The four primary destinations and encounter navigation rules are unchanged. Regional travel entry requires a current route, active journey or recovery; an old arrival receipt alone does not expose a local route. Feedback overlays the locality shell without shifting live touch targets or reserving permanent empty space. Physical Safari validation remains required.

Correction verification: the complete runner executed 54 suites (25 engine / 29 browser): 53 passed initially; combat-entry-browser exposed an overly broad empty-feedback CSS rule on the quest screen. The rule was scoped to Locality; the full affected suite then passed all eight width/source combinations, including a real touch held across timeout. The expanded Locality regression and travel/receipt tests passed at 320/375/390/430 px. All 54 suites are validated with no unresolved failures; 90,000 legacy snapshots remain identical. Final web build passed. No physical Safari or Android validation and no manual deployment.
