# Crossline production characters

Original reference-led, script-authored Soldier and Terrorist assets. This
pipeline preserves the approved face proportions, including smaller eyes and a
tapered lower face, while giving each character different clothing and equipment.
It does not reconstruct unseen reference details or promise exact image fidelity.

## Rebuild

From `/Users/nikhilvadhawana/Desktop/CXSOURCE/REPO/crossline`, with Blender 4.5 LTS
available as `blender` and npm dependencies installed:

```sh
blender --background --factory-startup --python tools/character-study/soldier.py -- --production --no-render
blender --background --factory-startup --python tools/character-study/soldier.py -- --character terrorist --production --no-render
npm run assets:characters
npm test
npm run test:characters
npm run test:visual
npm run build
npm run test:browser
```

Omit `--no-render` to regenerate the three studio views and editable Blend file.
To inspect candidates without changing the shipped game assets, run
`node tools/build-characters.js` without `--install`. Add `--only soldier` or
`--only terrorist` for an isolated rebuild. Candidates go to ignored
`test-results/character-candidate/`; `--install` replaces only selected character
GLBs and their manifest sizes. It never changes gameplay or room code.

## Files and runtime

- `*-source.glb` and `*-source.json`: triangulated, UV-unwrapped Blender bake with
  semantic weight tags. Associated PNGs are the editable color/normal/ORM atlases.
- `*-rigged.glb`: uncompressed game-sized 22-bone skins, inverse bind matrices,
  weapon attachment, rig metadata and idle/walk/run clips; the full-pack asset
  compiler uses these sources instead of the retired rigid builder.
- `build-report.json`: byte, triangle and material counts from the last compile.
- `../../public/models/`: Meshopt-compressed full and LOD skins, with embedded
  WebP textures. Each character uses one material, 2048 color and 1024 normal/ORM
  maps; full and LOD share texture identities in the client.

Albedo is baked via emission from each material's Base Color, avoiding BSDF
lighting contamination. The unified facial sculpt gets a continuous UV chart
with its seam behind the head; the remaining atlas space holds packed equipment
and garment islands. This avoids sub-texel projected nose islands and dark bake
specks without increasing texture resolution or runtime material count.

The ORM red channel contains short-range baked ambient occlusion, applied at
0.65 strength for contact shading around collars, gear and facial forms. Green
is roughness and blue is metalness. Normal and ORM textures are lossless WebP;
their decoded pixels are regression-tested against the source PNGs. Albedo
uses independent color compression, so data-map compression cannot add normal
bands or material seams.

The body skin uses at most two normalized joint weights per vertex. Runtime
two-bone IK adapts weapon grips and planted crouches to the short-limbed body.
Idle/walk/run clips blend with procedural jump, firing, reload, switching, throw
and death poses. These are not motion-captured animation clips. Individual
skeletons are cloned and disposed independently; geometry/textures remain shared.
Grenades follow the throwing wrist before release; projectiles remain server-owned.

## Review and limits

The development-only viewer <http://localhost:3000/tools/characters.html> loads
the actual public GLBs and game animation code without creating a room.
`npm run test:characters` exercises nineteen poses for both teams and both LODs, checks
skin weights, clone independence, grip/sole positions and bounded deformations,
and saves screenshots plus `test-results/characters/report.json`.

The benchmark is a short local nine-character rendering sample, not proof of
sustained ten-player combat, internet latency or low-end GPU performance. Manual
multiplayer play and animation/art review remain important. No server hitboxes,
damage values, room flow or match rules are changed by the character pipeline.
