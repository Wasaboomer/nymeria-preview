# DEV customization by slot

Open `index.html?kaelith=1`, select **Prova modulare**, then choose torso, arms/gloves, legs, boots, shoulders and weapon independently. Ranger and Peasant presets set clothing slots together and preserve the weapon. Shoulder choices are Ranger or none. The original Kaelith image remains available and is always used in the public profile.

The UI loads `slots-combined.glb` once (approximately 2.4 MB). Every component has a uniquely named `slot:category:variant:part` material. Model-viewer's scene graph keeps selected components opaque and hides unused alternatives through their base-color alpha, without replacing the whole model or changing the identity meshes. Hidden alternatives share one scene, so the camera framing stays stable. This is a static visual proof, with no animation, custom weapon grip or gameplay binding. Choices last for the current page only; no equipment, inventory, statistics or storage writes are performed.

Sources: user-provided Quaternius Universal Base Characters Standard and Modular Character Outfits Fantasy Standard ZIPs, licensed CC0. The selected female components are the base head, Long hairstyle, Peasant and Ranger clothing. Hidden body and Ranger hood are removed to avoid clipping. Head and hair stay unchanged. The Standard pack contains no weapons or plate armor: sword and staff are simple native mesh placeholders. The model does not reproduce Kaelith's face or final art direction. Original licensing is in LICENSE.txt.

Build: `python3 scripts/build-modular-proof.py /path/to/packs` (numpy and Pillow). The builder bakes a shared static pose, preserves independent clothing meshes, limits base-color textures to 1024 px with palette PNG encoding, and strips normal/roughness maps. The four original complete outfit/weapon GLBs remain for the earlier isolated comparison. Kaelith reference assets are never edited.

Tests:

- `node tests/modular-proof-assets.cjs`: valid geometry, stable identity, component coverage and default visibility.
- `NYMERIA_CHROMIUM=/path/to/chromium node tests/modular-proof-browser.cjs`: independent changes in six slots at 320/390/430 px; preset behavior; unchanged identity materials and storage; one GLB request; reference/public roundtrips; inactive default URL; no horizontal overflow or JS errors.
- Optional `NYMERIA_SCREENSHOT_DIR=/absolute/path` saves representative rendered previews during the browser test.

Chromium emulation does not replace a physical Safari/iPhone check.
