# NYMERIA — TORRE SILENTE — VISUAL FREEZE V1

Status: **APPROVED AND FROZEN BY USER — 2026-10-11**

## Binding reference

The binding visual reference is the **last AI-generated full-height mobile interface image explicitly approved by the user** in the NYMERIA project conversation, showing one portrait screen with the Torre Silente environment, two encounter cards, a Guado del Vespro destination card and four bottom tabs. This specification does not authorize regenerating or reinterpreting that image.

**Do not redesign, restyle, rearrange or substitute another concept without the user's explicit approval.** Store a lossless copy of the approved reference as a project asset when an authenticated binary upload path is available; until then the conversation image remains the authoritative visual source.

## Frozen visual layout (top to bottom)

1. Ornate dark gothic HUD with hooded character portrait, level, red HP bar, blue resource bar, currencies and notification bell. Bind to existing real values; do not invent stats or currencies.
2. Large painterly illustration of a ruined medieval watchtower amid mist, forest and mountains, cold blue-gray lighting, antique-gold trim.
3. Overlay title TORRE SILENTE, restrained environmental subtitle and existing location description (do not invent lore or rename canonical regions).
4. ENCOUNTERS heading, two illustrated horizontal dark framed cards with antique-gold outlines:
   - Ombra Silente — **level 6**, existing XP/crowns/drops from live data, green COMBATTI button.
   - Custode del Silenzio — **boss level 8**, existing XP/crowns/drops from live data, green COMBATTI button.
   - Use existing data/handlers; no invented wolf, NPC, loot or extra enemy.
5. PROSSIMA DESTINAZIONE: Guado del Vespro card, image and blue VAI action, honoring real lock/unlock conditions.
6. Fixed bottom navigation: Località, Missioni, Inventario, Menu.

## Behavior that must not change

- Single scrolling Località screen; no local Panoramica/Missioni/Incontri submenu.
- Existing encounter, quest, travel, atlas, equipment, progression, save and history handlers.
- No fake avatar customizer or placeholder stats.
- Contextual tracked quest and any valid rewards must remain accessible.
- Mobile widths 320/375/390/430, touch >=44px, focus and accessible labels.
- Preserve no-double-claim and no-double-encounter protections.
- No changes to main, stable site, Avatar Lab, Mage/Elementalist.
- **Only the user can unfreeze the design.**

## Implementation stages

1. Freeze design contract in repository (this file).
2. Import the approved original image as a **reference only**, then create separate optimized art assets for location, enemy portraits, destination and ornamentation. Do not crop a full mockup and treat it as an interactive screen.
3. Implement responsive HTML/CSS presentation reusing existing live DOM and handlers.
4. Run suite, browser checks, screenshots and user iPhone approval before calling the implementation complete.

Reference image is not yet committed as a binary asset; do not claim exact pixel fidelity until it is available and compared.
