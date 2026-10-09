# Nymeria — Visual Identity, Sprint 2

## Direction and tokens

The Frontiera uses dark stone and forest hues, aged bronze outlines, warm parchment
text and restrained magic accents. Shapes are quiet and functional: engraved
heading diamonds, fine rules, beveled colour gradients and role seals. There are
no borrowed game layouts, external fonts, photographic textures or remote images.

`fantasy-theme.css` is a single presentation layer after the existing viewport
rules. It owns `--ny-*` design tokens and maps legacy colour variables to them.
Typography uses Georgia/Times for titles and local system fonts for reading and
controls. Spacing units are 8/16 px; common frames use an 8 px corner radius.
Text tokens against stone exceed WCAG AA 4.5:1. Disabled controls retain their
existing functional state; colour never replaces labels or numeric information.
HP uses forest/earth-red; resources use muted blue; rarity comes from the existing
`--rarity`, never a new tier. Gold marks selection and important quest actions.

New CSS is grouped by component rather than appended fixes to legacy rules.
The UI adapter adds classes/data attributes to existing nodes. It does not replace
navigators, game renderers, gameplay data or persistence. The layer can be removed
by removing its two references from index and the optional scene pagination hook.

## Environments

Seven original, lightweight SVGs in `assets/environments/` supplement the places
already defined by WorldData:

| Existing location | Decorative interpretation |
| --- | --- |
| Veyra | Low fire, roofs and guarded stonework; warm bronze dusk |
| Sentiero Spezzato | Interrupted rocky path and abandoned wagon |
| Bosco delle Lanterne Spente | Ancient trunks, unlit hanging lanterns and green mist |
| Elar | Broken stone arches, abstract incisions and pale light |
| Guado del Vespro | River crossing, rocks and distant existing Tower |
| Torre Silente | Heavy masonry and a subdued threshold |
| Vesper Outpost | Restored walls, beacon and the existing Frontier Board |

These are atmospheric compositions, not authoritative geography or new lore.
The existing map connections, coordinates, discovery rules and unlock hints are
unchanged. Location titles and descriptions remain exactly those of WorldData.
Role/environment choices do not depend on a new save field.

Provenance and CC0 dedication for the **seven new SVGs only** are recorded in
`assets/environments/LICENSE.txt`. Existing frozen artwork keeps its original
provenance/status. Environmental art is an original stylized visual slice, not a
claim of final production artwork. The SVGs use paths and gradients; no filters,
embedded rasters, scripts, external references or perpetual animations.

## NPCs, hero and items

No NPC portrait exists in the current catalog. Serah, Oren, Mira, Bram and Ilyen
therefore receive framed **role emblems**, reusing original VisualIcons glyphs.
These are explicitly not fabricated portraits. Names, roles, conversation text,
offers and quest states remain those of WorldData/QuestUI. Dialogues get a readable
quote treatment with the real speaker name; talking immediately reveals their
pagination page. The existing conversation button exposes `aria-pressed`.

Hero and equipment receive stone/bronze surrounding frames, with original
character artwork, manifest, rig, renderer, appearance and item values untouched.
Inventory has two columns for readable names/stat previews, with visual categories
based only on actual item slots. Item comparisons and explicit equip actions are
preserved; no rarity, compatibility, advice formula or save change is introduced.
Workshop cards show existing level/XP, costs, materials and results with larger
text and restrained seals. Decorations survive asynchronous card replacement via
one coalesced observer watching only top-level list replacements.

## Combat

The existing `.visual-battle-arena`, character renderer and enemy images are moved
into the fixed HUD composition, not recreated. The environment comes from the
encounter's saved location. There is no new combat clock or animation loop.
A decorative vignette appears only when the measured content budget is at least
520 px, and hides in the history view; short viewports retain all essentials.
The Cervo uses its existing enemy illustration, MINIBOSS label and a gold frame.
HP, resources, actual damage, ability names, recent actions, pause/resume/abandon
and the full available log remain visible/reachable. Existing hit feedback and
reduced-motion behavior remain in force; its shared colour token darkens the flash
so white HP text retains contrast. Victory/defeat styles follow the stored
outcome; reward values are not altered.

`fixed-screens.js` adds the banner as an atomic pagination unit, places the
existing battle arena into the existing HUD and accepts a UI-only content-focus
event to reveal the spoken dialogue page. Viewport, safe area, contextual
scrolling, pagination and navigation rules remain Sprint 1.2's responsibility.

## Weight and performance scope

At delivery: **20,542 bytes** of new SVG artwork; **43,632 bytes** total for artwork,
theme CSS and adapter JS (about **15,471 bytes gzip**, summed per file). Documentation
and tests are not runtime resources. Individual SVGs range from 2.7 to 3.7 KB.
Only local relative URLs are used, including under a GitHub Pages subpath.
Existing characters/enemies are reused and cached; no new dependency is installed.

This is a payload/architecture assessment, not a measured framerate on old iPhone
hardware. Real Safari GPU/paint performance and browser bars still require a
physical device test. Avoid claiming definitive Safari compatibility from Chromium.

## Verification

The 14 domain-engine suites and the 8 Sprint 1.2 UI suites remain active. Sprint 2
adds `tests/fantasy-identity-browser.cjs`: text-token contrast, seven SVGs/payload,
local/subpath requests, absence of mutations from decoration, NPC dialogue/emblems,
real item categories, existing character/enemy reuse, adaptive HUD, history,
reduced motion, encounter persistence and JS/rejection checks at 320/375/390/430.
The existing normal journey verifies both classes through Veyra → professions /
optional Bram → Cervo → actual Elar visit and reload. Only idle waits are accelerated
with the real engine; Debug Mode is not used for this journey.

The DEV CI runs these 23 suites and uploads logs. It performs no manual deployment,
release, merge or writes to main/the separate publication repository. Screenshots
for local visual inspection are kept outside the checkout and are not committed.
