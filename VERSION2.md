# V2 implementation and acceptance

Branch: `version-2`. V1 remains on `codex/version-1` at `b4b13fddb46d02f8d4934ffb96367adf6b8a9e2c`.

## Playable milestone implemented

- COASTLINE is the only enabled map, with both team spawns, two sites, canal routes, bridges, stairs, tower, market and dock.
- Soldiers and Terrorists use separate original articulated 3D characters. Locomotion clips blend with crouch, jump/landing, shooting, reload, equipment and death poses.
- 34 firearms, knife, HE/Flash/Smoke and a detailed objective device are compiled into compressed GLB assets. Character LODs are loaded and used at distance.
- Server-owned inventory, switching/previous/cycle, reload, drop and atomic pickup with ammunition preservation.
- HE with obstruction-aware damage; flash with facing/distance/obstruction; persistent volumetric smoke independent of visual quality presets.
- Mode-gated BombObjective tests cover carrying, dropping, pickup, interrupted planting/defusing, beeping and detonation. It is intentionally not connected to Team Deathmatch inventory.
- Simple homepage, separate named-room creation, fixed map card, team/loadout selection, readiness, loading progress, coordinated countdown, results and same-room replay.
- HUD, team scoreboard/ping, kill feed, hit/headshot feedback, crosshair preview, practical key rebinding and categorized graphics/audio controls.
- Positional synthesized effects, surface footsteps, ambience, limited room chat, and one append-only match summary per finished match.

## Verification

- Unit/integration coverage includes all firearm damage paths, reliable short-click handling, server authority, cadence/reload, inventory races, grenades, objective gating, map connections and climbable stairs, settings and match-summary persistence.
- Ten real Socket.IO clients: capacity, isolation, loading, snapshots, results and disconnect cleanup.
- Two real Chrome contexts: homepage avoids heavy assets; creation/join/readiness; loading; pointer lock; actual shooting/kill/respawn; reload; drop/pickup; HE/Flash/Smoke; scoreboard; graphics settings; replay; return; host transfer and refresh.
- Visual harness: actual GLB parsing, map/character/weapon renders, animation checks and browser shader-error checks.
- Local nine-opponent sample on Chrome/ANGLE Metal, Apple M2: medium and high median frame interval about **16.7 ms**, p95 about **17.6 ms**. This is one short local render sample, not a low-end hardware or internet latency guarantee.

## Not yet final art acceptance

This milestone is playable, but **it is not the completed premium visual target**. The current characters, guns and architecture remain an original code-authored first art pass. They do not match the richness, sculpted anatomy, clothing detail, silhouettes, hand placement and material finish of the uploaded reference boards.

Further art work should focus on:

1. More refined character anatomy, facial expression, cloth/gear forms and grip alignment; artist-authored animation polish.
2. More individual weapon receiver/furniture detail and improved first-person hands/reload choreography, especially dual pistols and unusual magazine designs.
3. More varied coastal architecture, roof silhouettes, courtyards, terrain edges, vegetation and lighting/material nuance. Some small visual details use simplified collision.
4. Longer two-machine playtesting for map fairness, movement/shooting feel, audio mix and real network latency; performance testing on lower-end GPUs.

The bomb state machine is future-facing, not a playable Bomb/Defuse mode. Armor, voice chat, ranked systems, accounts and public deployment are not enabled. No claim of AAA asset fidelity or cheat-proof multiplayer is made.

## Asset provenance

All V2 meshes are created by the repository’s authoring code and exported with Three.js GLTFExporter, then optimized using glTF Transform and Meshoptimizer. Uploaded reference PNGs are not in the game. The GLB model pack and rendered preview images are committed project assets; rebuild commands are documented in README. Source geometry and animation code remains editable.
