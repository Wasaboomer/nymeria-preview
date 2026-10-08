# Kaelith — first illustrated layer delivery

**Approved visual reference:** the first original Kaelith collage, not subsequent mockups.

## Files
Place transparent PNGs in a single directory using the filenames below. Every file must have **1080 × 1920** pixels, transparent background, identical character position, and the same fixed pose.

- `body.png`: elf anatomy and skin, with covered regions completed
- `face-01.png` through `face-03.png`: face variations aligned to the same eye/jaw anchors
- `hair-01-back.png` and `hair-01-front.png` (and pairs 02, 03): separately rendered hair
- `armor-plate.png`, `armor-cloth.png`, `armor-fur.png`: mutually exclusive full armor silhouettes
- `cloak-blue.png`, `cloak-red.png`: independently interchangeable capes

**Composite order:** cloak → hair-back → body → face → armor → hair-front. This is an initial test order; hair-over-armor and shoulders need manual inspection.

**Color treatment:** hair recoloring should use grayscale illumination + tint masks; do not flatten hair lighting into a single flat color. Root/tip gradient must affect both portrait and full body consistently.

**Acceptance checks:** execute `node tools/validate-kaelith-assets.js <directory>`; then manually review all 3 armor types with 3 hairstyles, skin variants, and both capes on a mobile viewport. PNG metadata validation alone cannot certify style fidelity or alpha cleanliness.

**Status:** asset files are *not yet produced*. The existing SVG rig is an engineering placeholder and must not be represented as the final Kaelith art.
