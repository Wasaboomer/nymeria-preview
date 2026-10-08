# Nymeria — Kaelith modular art contract (v0.1)

## Non-negotiable visual reference
Original approved concept: `a_detailed_concept_art_and_ui_style_guide_collage.png` (Kaelith, dark fantasy semi-anime). The later generated mockup is **not** the reference. Do not substitute the existing vector laboratory art for final art.

## Two-stage production
1. **Mechanical proof:** independent layers with fixed shared coordinates; full-body and portrait must reflect the same character settings. Vector shapes are explicitly placeholders.
2. **Art pass:** produce transparent illustrated layers matching the original Kaelith reference, verify visual fit, then replace placeholders. No claim of matching original quality before reviewing rendered output.

## Layer contract
- Canvas: 360 × 640, fixed neutral front three-quarter pose. Transparent background.
- Head/face/ears: consistent eye, jaw and neck anchors across variants.
- Hair: back and front separately, hair colors as variant assets or tint masks.
- Torso: plate base, cloth overlay, fur overlay; mutually exclusive overlays. All three must change silhouette, not merely hue.
- Cloak: behind body, compatible with shoulder and hair overlays.
- Weapon: separate from the silhouette, fixed grip/hand anchor.
- Full-body and portrait: same saved character model; portrait crops the same rig initially, with separately authored high-resolution face assets later.
- All assets must have exactly the same canvas and alignment, with alpha transparency and no baked background or UI.
- Each layer must carry a stable ID, visual revision and compatibility metadata.

## First illustrated deliverable
One base elf body + 3 facial variants + 3 hair front/back pairs + 3 torso treatments + 2 cloaks. Before expansion, test 3 combinations for visible seams at neck, shoulders, waist and hairline, and verify on mobile Safari.

## Guardrails
- Never modify main gameplay or stats while working on visual prototype.
- Never silently replace original Kaelith concept with a new interpretation.
- Do not claim the source collage contains separated usable assets: it is a flattened illustration.
- Do not claim browser/mobile QA without running it.
