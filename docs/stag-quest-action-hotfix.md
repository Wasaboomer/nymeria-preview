# Sprint 2.7.1 — Cervo del Crepuscolo quest action

## Reproduced cause

At baseline `1aada7c20f1e8d81eced6a320a5b5a8b3bf830db`, an isolated normal-mode
browser fixture with MQ03 active, progress `[2,3,1,0]`, the unlocked lantern wood
and current location `lantern-wood`, even with a valid class kit, reproduces the reported silent action.

The objective resolves correctly to `twilight-stag`. The enemy is declared at
that location and WorldEngine does not impose a further quest-phase/level gate.
The click reaches WorldUI's special stag handler, which sets `stagPreparation`
and calls render/scrollIntoView. However, preparation is shown only when
`view === 'places'`. From quest detail, the view remains `quest`: preparation
stays hidden, no encounter starts and no message is produced. ScrollIntoView
cannot reveal a hidden section or select an adaptive page. The existing story
test exercised the location encounter button instead of this quest-detail path.

## Minimal fix

The handler opens the existing locality view when needed and requests content
focus through the existing pagination event. It keeps the original preparation
and explicit `Affronta il Cervo` confirmation; it does not skip any combat rule
or complete the objective. Back preserves the return to the quest detail.

When that confirmation is rejected, the engine's actual message is presented in
a live status paragraph inside the preparation and that content is selected by
the existing pager. A missing class kit is therefore visible with the instruction
to prepare it in Equipment. WorldEngine remains authoritative and unchanged.

No quest, unlock, enemy, combat, reward, migration or save-format change is made.
The world-ui asset cache version is advanced together with its HTML reference.

## Coverage and remaining validation

`tests/stag-quest-browser.cjs` starts an isolated save fixture with the exact
reported objective progress and uses real touch buttons in normal mode. It tests
quest detail/tracker → preparation → confirmation → battle, Back, a rejected missing-kit
start, unchanged progress before a real victory, persisted victory and repeated
completion/reload without a second reward. It covers 320/375/390/430px and
568/667/844px heights, reachable controls, overflow and JS/rejection/asset errors.
The fixture never touches user saves and does not use Debug completion commands.

The existing full suite also exercises the location encounter button, both
classes, other quest links and the route through Elar. A physical Safari retest
is still required; Chromium touch tests establish a reproduced code path and
automated regression coverage, not physical iPhone compatibility.

Final validation: `npm test` built the web package and passed 38 suites
(20 engine, 18 browser), zero failed, including all 37 previous suites and the
new stag quest test. The reported fixture passed all four widths and three
heights, including the real kit rejection shown automatically and preservation
of the three existing samples plus the actual stag drop. `git diff --check`
passed. No physical Safari test, push or deployment was performed.
