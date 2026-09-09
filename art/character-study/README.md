# Reference-led character studies

This folder contains editable Soldier and Terrorist **unrigged studies** and
offline studio renders. The approved geometry now feeds the skinned production
pipeline documented in `../characters/README.md`. These static study exports are
not the files loaded in multiplayer. No room, networking, health or collision
behavior is changed by the character pipeline.

## Inspect

- `soldier-three-quarter.png`, `soldier-front.png`, `soldier-face.png`: actual
  Blender renders of the modeled geometry, not generated concept images.
- `soldier-study.blend`: editable geometry, shared materials, studio and camera.
- `soldier-study.glb`: static 3D export for the independent browser viewer.
- With `npm run dev` running, open
  <http://localhost:3000/tools/character-study/viewer.html> to orbit and zoom.

Equivalent `terrorist-*` files contain the rugged character study. To inspect
**both animated, shipped game characters**, open
<http://localhost:3000/tools/characters.html> instead.

The supplied Soldier illustration is the visual reference, not a texture pasted
onto the model. Hidden side/back details are interpretations. Script-authored
modeling and surface refinement should not be described as manual artist sculpting
or an exact reconstruction of the illustration.

## Rebuild

Use Blender 4.5 LTS from the canonical project directory:

```sh
blender --background --factory-startup --python tools/character-study/soldier.py
blender --background --factory-startup --python tools/character-study/soldier.py -- --character terrorist
node tests/character-study.js
```

Without `--production`, the script writes only study GLBs, Blend files and
renders. `--production` additionally bakes the source atlases and binding tags;
it does not overwrite `public/models` until the separate compiler is run with
`--install`. Body geometry is authored in `tools/character-study/body.py`; the
face, Soldier headgear and studio are in `soldier.py`, with the rugged outfit,
beard and patterned wrap in `terrorist.py`.

Blender source is Z-up, faces -Y, and uses a roughly 3.2-unit reference sculpt height.
The static glTF export is Y-up and faces +Z. The approval preview is therefore not
a drop-in game rig. Blender's subtle skin subsurface shading and procedural cloth
bump are not baked into the GLB; browser shading will differ from offline renders.

## Production distinction

The approved smaller eyes and tapered jaw/chin now feed both game characters.
The production compiler builds game-sized skins, texture atlases, independent
skeletons and LODs, with runtime grip/foot IK and combat poses. Browser shading
still differs from the offline studio. Do not install the static study GLB in a
match; use the production pipeline and its verification commands.
