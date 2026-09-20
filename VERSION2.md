# V2 implementation and visual upgrade

Branch: `version-2`. V1 remains on `codex/version-1` at `b4b13fddb46d02f8d4934ffb96367adf6b8a9e2c`.

## Playable milestone implemented

- COASTLINE is the only enabled map, with both team spawns, two sites, canal routes, bridges, stairs, tower, market and dock.
- Soldiers and Terrorists use separate reference-led, atlas-baked 22-bone skinned characters. Locomotion clips blend with crouch/foot IK, jump/landing, shooting, reload, equipment and death poses. Skeletons animate independently per player.
- 34 firearms, knife, HE/Flash/Smoke and a detailed objective device are compiled into compressed GLB assets. Character LODs are loaded and used at distance.
- Server-owned inventory, switching/previous/cycle, reload, drop and atomic pickup with ammunition preservation.
- HE with obstruction-aware damage; flash with facing/distance/obstruction; persistent volumetric smoke independent of visual quality presets.
- Mode-gated BombObjective tests cover carrying, dropping, pickup, interrupted planting/defusing, beeping and detonation. It is intentionally not connected to Team Deathmatch inventory.
- Simple homepage, separate named-room creation, fixed map card, team selection, readiness, loading progress, coordinated countdown, results and same-room replay. Equipment selection now lives in the in-game [Buy Menu](BUY_MENU.md), with 20-second opening and 10-second respawn windows.
- HUD, team scoreboard/ping, kill feed, hit/headshot feedback, crosshair preview, practical key rebinding and categorized graphics/audio controls.
- Positional synthesized effects, surface footsteps, ambience, limited room chat, and one append-only match summary per finished match.

## Verification

The September 9 gameplay-review pass is documented in [GAMEPLAY_REVIEW.md](GAMEPLAY_REVIEW.md). It adds authoritative capsule-distance HE damage, fire-input epochs and explicit action barriers, ten varied spawns per team, faster weapon-specific reloads, new first-person hands/forearm solving, character gear and directional locomotion refinements, and site-specific collidable landmarks. Room flow and Team Deathmatch are unchanged.

- Unit/integration coverage includes all firearm damage paths, reliable short-click handling, server authority, cadence/reload, inventory races, grenades, objective gating, map connections and climbable stairs, settings and match-summary persistence.
- Ten real Socket.IO clients: capacity, isolation, loading, snapshots, results and disconnect cleanup.
- Two real Chrome contexts: homepage avoids heavy assets; creation/join/readiness; loading; pointer lock; actual shooting/kill/respawn; reload; drop/pickup; HE/Flash/Smoke; scoreboard; graphics settings; replay; return; host transfer and refresh.
- Visual harness: actual GLB parsing, map/character/weapon renders, animation checks and browser shader-error checks.
- The final ten-player scene sample (local view plus nine opponents), at 1440×900/DPR1 on Chrome/ANGLE Metal and Apple M2, measured **33.3 ms median / 35.0 ms p95** on both medium and high. Idle browser cadence was also 33.3–33.4 ms; CPU render submission medians were 7.2 / 7.4 ms. A separate uncapped diagnostic measured 5.0–5.1 ms median / 8.9–9.0 ms p95 frame intervals, not normal playback or GPU-completion time. Each preset measures 420 frames after 60 warm-up frames; draw callbacks verify nine opponents in every frame. The reports, host-pacing qualification and limits are described in `GAMEPLAY_REVIEW.md`. No general 60 FPS, sustained combat or internet-performance guarantee is made.

The completion pass expands unit/integration coverage to **54 passing tests**, including actual thrown HE projectiles, held/reordered fire input across action transitions, all-firearm reload deadlines, 25 respawns per team and lossless character data-map integrity. The production build, two-browser multiplayer scenario and eight-viewport homepage suite are verified separately. Character-specific browser checks cover **76 pose cases** (both teams, full/LOD), normalized skin weights, independent skeletons, actual deformed feet, weapon-hand alignment and local skin-edge strain. Seventy-two rendered create/dispose lifecycles keep GPU resource counts stable. The first-person sweep checks 107 actual weapon/equipment views, including exposed hand near-plane clearance. Fresh reports/screenshots are in ignored `test-results/`; current full-scene timing is reported above, not inferred from the older studio benchmark.

The existing crouch stability assertions remain intact; imported pelvis breathing is damped during a planted crouch so IK knees do not visibly oscillate. The smoke browser check waits for authoritative detonation instead of sampling once after a fragile fixed delay. The latest gameplay pass deliberately changes HE balance and throw/action handling as described in its report. Regenerate assets and rerun the README verification commands after authoring changes. Automated results do not replace the manual acceptance work below.

## Current visual pass

The established **premium stylized 3D tactical FPS** direction is retained across the characters, firearms, equipment, coastline and interface. The upgrade changes visual presentation without adding a new room flow, changing combat rules or enabling another multiplayer mode.

- **Characters:** the approved Soldier study now supplies the shipped body/face, with smaller eyes and a gently tapered chin. The Terrorist uses the same facial direction with beard, patterned head wrap/scarf, open suede waistcoat, diagonal strap, burgundy sash, patched trousers and wrapped boots. One baked color/normal/ORM atlas material per skin replaces hundreds of preview meshes. Original skin weights and 22 bones support the short-limbed proportions; semantic sleeve/forearm binding avoids hard-cut tears. Locomotion and combat presentation cover idle, walk/run, grounded crouch, jump/landing, weapon holding, firing, reload, switching, grenade wind-up/release and death. The independent Character Lab at `/tools/characters.html` uses actual game assets and animation code.
- **Firearms:** all 34 receive shaped and bevelled receivers/furniture, differentiated barrels/magazines/stocks, trigger space, rails, sights/optics and mechanical detail. Wood, polymer and metal finishes use compact original textures with GLTF-compatible normal detail; small invented manufacturer markings replace blank surfaces. First-person grip placement, recoil, draw/switch and reload curves are weapon-aware, including unusual feed designs.
- **Equipment:** curved segmented HE shell, physically ported Flash cage and marked Smoke canister have distinct silhouettes and articulated pull-ring/spoon parts. The bomb model is a layered field device with a readable illuminated numeric screen, keypad, casing, straps, hardware, plugged wires and carry handle. Separate presentation curves cover carrying, pickup, dropped/planted poses and planting gestures for future objective integration; they do not enable Bomb/Defuse gameplay in TDM.
- **COASTLINE:** the existing route and collision foundation remains. Added architectural variety, wall/window/door treatments, balconies, arches, market props, signage, lamps, cables, vegetation, roof detail and waterfront dressings give the warm A courtyard, cool B district and canal/bridge MID different visual identities. Water, sky, lighting and material treatment support the same stylized direction. Decorative detail is kept out of primary movement routes; some small details intentionally use simplified collision.
- **Homepage:** the same CROSSLINE structure and room actions, with a better rendered coastal hero, stronger contrast and Create Room emphasis, refined input/focus/hover states and transitions, clearer settings/instructions, a small Version 2 indicator and `COASTLINE • TEAM DEATHMATCH • 2–10 PLAYERS` line.
- **Effects/performance:** weapon-specific presentation, muzzle smoke, shell ejection, impacts, grenades and audio remain bounded cosmetic systems. Spatial batching/instancing, frustum culling, character LOD, shared textures/materials and limited-rate shadows remain in use.

## Completion polish and acceptance limits

The completion pass corrects pistol proportions/palm contact, parallel support-thumb placement, exposed forearm materials, third-person wrist IK ordering during transitions and reload-magazine tracking. Both characters gain baked contact occlusion and lossless normal/ORM data; corrected studio shadow bias removes striped preview shading. Rebuilt weapon bevels and shaped, stem-connected map foliage refine the remaining material/geometry rough spots. The approved face proportions and core routes remain unchanged.

The implementation and local verification checklist for this pass is finished. These remain original code-authored assets, not externally sculpted commercial character packs; this is not a claim of AAA fidelity, exact reference-image equivalence or artist approval. Final visual acceptance belongs to the user.

Longer manual playtests on two computers are still needed for aiming/movement feel, audio balance, map fairness and real network latency. Lower-end GPU/browser testing is necessary before making broad smooth-performance claims. Rendering success and automated multiplayer checks alone do not establish those outcomes.

The bomb state machine is future-facing, not a playable Bomb/Defuse mode. Armor, voice chat, ranked systems, accounts and public deployment are not enabled. No claim of AAA asset fidelity or cheat-proof multiplayer is made.

## Asset provenance

All V2 meshes are created by the repository’s authoring code. The reference-led characters are modeled and atlas-baked in Blender from `tools/character-study/`, then scaled, skinned and compiled by `tools/build-characters.js`; weapons/equipment still export through Three.js GLTFExporter. glTF Transform and Meshoptimizer produce the 43 shipped files (19,485,944 bytes). The four character variants total 6,768,008 bytes with full/LOD triangle counts near 77.5k/23.3k for Soldier and 86.2k/25.9k for Terrorist. Embedded color textures use WebP when smaller; normal/ORM maps use lossless WebP. Compiler-assigned content names support runtime texture/material deduplication. Character surfaces are original baked Blender materials and weapon patterns are original canvas materials, not downloaded photographs or copied game textures.

Uploaded reference PNGs are not in the game. GLB files and actual rendered preview images are project assets; rebuild commands are documented in README. Source geometry and animation code remains editable. Git history and remote tracking identify the delivered V2 revision; V1 remains unchanged.
