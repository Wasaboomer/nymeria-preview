# Sprint 2.1 — World Map & Interface Refinement

Presentation-only refinement of Sprint 2, preserving its tokens, environments,
NPC presentation, battle HUD and five primary destinations.

## One map and one hero panel

The fixed shell authorizes internal vertical scrolling on the overview map and
Hero panel. They never use the screen pager; browser/document/app scrolling and
horizontal scrolling remain prohibited. Places, exploration and combat retain
their existing paginated/fixed HUD rules. Safe-area and visualViewport budgeting
still belong to fixed-screens.js; this is not a replacement viewport system.

The map lists all six established regional places, with real unlock reasons,
current-location and objective marks. An old 9px !important rule is overridden
only on map descriptions, with an actual computed-font assertion. Discovered Outpost remains an additional
real destination when available, with no invented coordinates or early discovery.
The redundant top Explore button stays hidden. Tapping the current location opens
its view without reapplying a visit transaction; travel still uses the existing
WorldSystem.enter handler. The place retains NPCs, quest offers,
points, encounters and profession access unchanged.

Hero reorders existing nodes: identity, XP, original portrait/renderer, preparation
HP/resources, primary statistics, equipment/secondary links, expandable secondary
statistics/build, onboarding guide and original Creator. Equipment and dye
controls keep their original Equipment hub.
Portrait equipment shortcuts retain their original equipment/slot navigation
and Back context. No artwork, rig or renderer changes. The preparation preview uses the pure combat
engine with a fixed seed and does not advance it. Outside combat there is no durable
current-HP record: labels explicitly report **initial** HP and class resource values;
actual encounter values remain in Combat. No fake persistent HP is introduced.

“Ho capito” hides the whole guide and reclaims its space. A separate UI-only boolean
key `nymeria.ui.journeyGuide.dismissed.v1` persists that preference. No migration,
quest-state mutation or game-save reset is required. Storage failure leaves the
guide visible with feedback; unrelated save data is never rewritten by this action.

## Inventory projection

`inventory-catalog.js` reads existing sources without moving, writing or merging:

- Equipment.state.inventory: individually identified gear (weapons/armor/accessories).
- ProgressionStore: Corone, Ferro/Fibre/Etere and Frontier supplies.
- ProfessionUI.engine: actual profession material quantities, including raw/forged
  iron, wild herbs, map fragments and Frontier Brace.

Keys include the source ledger, so independent quantities and individual gear
remain separate. Positive integer quantities are shown exactly, not inferred
stacks. Supplies are labelled as mission-system collections; profession materials
retain that provenance, even where they are used by a quest.

Filters: Tutti, Equipaggiamento, Consumabili, Materiali e risorse, Oggetti missione,
Altro, plus existing equipment subfilters. Tutti clears a slot filter and exposes
all projected possessions. Non-gear opens a read-only detail sheet with quantity
and source, no equip/use/consume action. Gear comparison/equip remains unchanged.
Unknown names retain their IDs and are HTML-escaped. The authoritative source
establishes classification; otherwise the classifier falls back to Other. The
current catalog has **no consumables/usable potions** or standalone miscellaneous
items: those categories are honestly empty, no invented properties or actions.
All stores and transaction engines remain independent and unchanged.

## Menu

Functional groups use real destinations only: Activities (Professions and crafting
in the same existing hub, Expeditions), Knowledge (Discoveries/titles), Community
(local Guild/simulated members). Existing icon glyphs, short descriptions and
44px-or-larger controls. No fake Settings, Chat or standalone crafting screen.
Debug keeps its existing test=1 gate. Main navigation/context stacks and combat
exit protection are unchanged.

## Checks and limits

New catalog tests cover immutable projections, individual gear, quantities,
separate ledgers, unknown fallback and invalid/absent rows. New browser checks cover
one map/Hero, current-place action, unlock reasons, persistent/failed guide save,
filters/read-only materials/details, real profession gathering, fixed navigation,
internal touch scrolling, subpath loading and 320/375/390/430 at 375/508/667/844px
with simulated safe padding. Existing regressions include the non-Debug journey
for both classes through professions/Bram/Cervo/Elar and original battle timing.
The scroll audit and two navigation fixtures are updated for the authorized map /
Hero scrolling and current-location action; old Explore-button expectations no
longer reflect the product contract.

Chromium touch/viewport tests do not validate real Safari browser bars or hardware.
Physical iPhone validation remains required. The active CI suite consists of 15
engine suites and 10 browser suites, including the two Sprint 2.1 additions. No manual deploy or changes to the
separate publication repository are performed.
