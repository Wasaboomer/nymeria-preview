# DEV visual customization proof

Open `index.html?kaelith=1`, select **Prova modulare**, then choose an outfit and a weapon. The default remains the original Kaelith illustration. The public profile also keeps that reference. Selections last only for the current page and do not write localStorage, equipment, statistics or inventory.

The provided Standard ZIPs contain Quaternius CC0 models. The fantasy outfit pack has female/male Peasant and Ranger outfits and separate pieces; it contains no weapons or plate armor. This proof uses a female base head, Long hairstyle, and the two female outfits. Hood and hidden body geometry are removed to prevent clipping. The same head/hair meshes are kept across all combinations. This is a functional model reference, not a recreation of Kaelith's face or final art style.

Spada and Bastone are deliberately simple native mesh placeholders created for this proof. Four static GLBs assemble the available parts in the same pose; they do not yet provide runtime per-slot mesh replacement or character animation. The hands remain in the source neutral pose; a final weapon grip needs a dedicated pose. Model loading uses the existing local model-viewer vendor file without a CDN.

Build with `python3 scripts/build-modular-proof.py /path/to/packs` (numpy and Pillow required). The builder retains base-color maps at a maximum of 1024 px, encodes a PNG palette for the mobile proof, strips normal/roughness maps and unused geometry, and produces GLBs of approximately 1.1–1.8 MB. It never edits the Kaelith reference images. Original license text is in LICENSE.txt.

Validation: `node tests/modular-proof-assets.cjs`. Mobile Chromium verification covers all four combinations at 320/390/430 px, loading, horizontal overflow, public/reference roundtrips, inactive default URL, JS errors and unchanged game storage. Physical Safari/iPhone validation remains separate.
