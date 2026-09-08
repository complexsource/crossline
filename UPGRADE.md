# Visual upgrade — September 2026

## Delivered

- Eight original battlegrounds with different layouts, surface palettes, lighting and props: Saffron Quarter, Ironworks, Forward Station, Meridian Street, Salt Yard, Whiteout Relay, Canopy Outpost and Atrium Nine.
- Host-only map selection, visible rendered map thumbnails, recommended player counts and a 2–10 player capacity selected at creation. Map and capacity persist through replay/return. No accounts, extra services or database.
- Server collision and local prediction use the selected map's authoritative solids. New walk-through building shells, small-step traversal and accessible stair/roof routes on the desert and military layouts.
- Original articulated tactical characters with continuous garment meshes, contoured faces, helmets/headsets, fingered gloves, boots, vests, pouches, backpacks, radio, fragmentation grenade and decorative utility canisters. Walking/running, jumping, crouching, firing, reloading and falling animations.
- Six rebuilt weapon models: machined receiver silhouettes, beveled surfaces, barrels, stocks, triggers/guards, rails, scope, muzzle and magazine details. First-person sleeves/gloves, moving magazine and bolt, support-hand reload motion, recoil and view bob.
- Original material atlas with metal, concrete, brick, fabric, camouflage, wood, sand, grass, snow and other surfaces. PBR materials use albedo, height-derived normal and roughness textures, per-material metalness and environment reflections.
- Atmospheric sky, ambient/environment lighting, directional shadows, local lamps, map fog, bullet decals, impact dust, muzzle smoke, brass ejection, grenade particles and layered synthesized gunfire/reload audio.
- LOW / MEDIUM / HIGH / ULTRA settings control resolution, shadow resolution, effect budget and detail distance. Shared geometry/materials, rigid-joint batching, repeated-prop instancing, spatial frustum culling and distance-based garment mesh LOD limit cost.

## Verification

Run `npm test`, `npm run build`, `node tests/browser.js`, and `node tests/visuals.js` (browser checks require installed Google Chrome).

- 13 rule/network tests pass, including ten real sockets, host permissions, map validation, spawn accessibility, authoritative damage, respawns, movement and map-specific prediction.
- Two real browser clients pass creation with a custom map/capacity, host-only map changes, teams, pointer lock, shooting, kill/death, respawn, weapon switching, reload, grenade, scoreboard, movement, results, replay, room return, host transfer and refresh cleanup.
- Eight maps, six weapon views and four graphics presets render without browser errors. Screenshots live in ignored `test-results/`; shipped thumbnails in `public/previews/` are renders of the actual scenes.
- A local headless Chrome run with nine visible remote-player models plus the first-person weapon measured approximately 61 FPS on HIGH. This is a local rendering check, not a promise for weaker hardware or an internet latency benchmark. That view reported about 1.02 million triangles including shadow and view-model passes.
- The generated source atlas is 3,515,183 bytes; the runtime WebP is 694,244 bytes (about 80% smaller). WebP compresses download size; it is **not GPU block compression** such as KTX2/Basis.

## Honest visual boundaries

This is a substantial browser-focused procedural art upgrade, **not photorealistic AAA character/weapon art**. Character faces, clothing deformation, hand placement and movement remain custom procedural approximations rather than artist-sculpted/skinned models and motion capture. Maps have conservative box-based collision; decorative windows do not shatter, water is a shaded surface, and there is no full destruction system, reflection tracing, historical hit rewind or advanced anti-cheat.

Fragmentation grenades are playable. The two additional belt canisters are visual equipment only: flash-blindness and tactical smoke mechanics are not added. Defuse equipment is not added to team deathmatch. Quality settings do not imply those missing systems exist. A higher-fidelity art milestone would need original authored 3D assets and a dedicated animation/rigging pass.

## Original asset provenance

The material atlas was generated with the built-in image-generation tool, then copied into this project. No Counter-Strike assets, downloaded character packs or third-party gun sound recordings were used. Three.js and its environment/sky algorithms retain their library licensing.

- Generated source: `public/textures/original-material-atlas.png` (actual output: 1254 × 1254).
- Runtime format conversion: `public/textures/material-atlas.webp`, encoded by the browser in `tests/visuals.js` without artwork changes.
- Material extraction and height-derived maps: `src/materials.js`. These derived maps are approximations, not scanned material data.
- Original mesh construction and articulation: `src/models.js`.
- Actual scene previews: `public/previews/*.webp`.

### Generation prompt

Create one 2048x2048 physically based game material ALBEDO texture atlas. Exactly a 4 by 4 grid of 16 equal square seamless texture swatches, no gaps, no borders, no labels, no text, no perspective. Orthographic flat scan under perfectly even diffuse neutral light, NO cast shadows or specular lighting baked in. Each tile represents a 1 meter square surface. Row 1 left to right: weathered pale limestone concrete plaster; red-brown old clay brick masonry with mortar; cracked dark gray asphalt with fine aggregate; scratched charcoal black parkerized gun steel. Row 2: worn olive green ripstop tactical fabric with tiny weave; brown distressed leather; brushed gray steel; aged wooden planks. Row 3: dry pale golden sand with subtle wind ripples; short natural grass and soil; compacted white snow with very faint grain; light gray indoor ceramic floor tiles. Row 4: olive and brown realistic woodland camouflage fabric; dark charcoal rubber with subtle fine grip stipple; rough gray rocky stone; aged beige plaster with tiny cracks and peeling paint. Photorealistic scanned-material fidelity, high frequency fine detail, realistic material color and scale. This is an original texture sheet for original 3D browser shooter assets, not game art copied from another title. Fill every tile edge to edge. Texture only, absolutely no objects, characters, weapons, typography, watermark, logos.
