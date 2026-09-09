# Crossline — Version 2

Canonical project: `/Users/nikhilvadhawana/Desktop/CXSOURCE/REPO/crossline`.

A browser multiplayer FPS using Three.js, Node.js and Socket.IO. Create a named room, share its six-character code, choose **Soldiers** or **Terrorists**, ready up, and play ten-minute Team Deathmatch on **COASTLINE**. Supports 2–10 players. No accounts, matchmaking service or database.

Work is on `version-2`. Version 1 remains unchanged on `codex/version-1`. This V2 visual upgrade refines the established stylized tactical direction while preserving the room flow, Team Deathmatch rules and server authority. It is not a claim of AAA quality or equivalence to the supplied reference images. See [V2 scope and limitations](VERSION2.md). [UPGRADE.md](UPGRADE.md) describes the historical V1 art pass.

## Run

Requires Node.js 22.12+.

```sh
cd /Users/nikhilvadhawana/Desktop/CXSOURCE/REPO/crossline
npm ci
npm run dev
```

Open `http://localhost:3000`. Create a room, then use another browser window to join with a different name. Everyone selects **I’m ready**; the host starts. The server waits for every client to load the map and compressed GLB models, then runs the 3–2–1 countdown. Click **Enter match** to capture the mouse. Escape pauses/releases it.

Production:

```sh
npm run build
npm start
```

`PORT` defaults to 3000. The Node process serves both the web client and multiplayer connections. Run **one server instance**; rooms live in memory. A restart removes all rooms. Refreshing/disconnecting removes the player, transfers host if necessary, and ends a running match if a team becomes empty.

Friends must use the **same server URL**, not their own localhost. For LAN testing, use the host’s LAN IP and allow port 3000 through its firewall. For internet play, deploy the production build to a long-running Node/container host with HTTPS and WebSocket support. Do not expose the Vite development server publicly. This repository does not configure public hosting. Clipboard and raw mouse support vary on non-HTTPS LAN origins.

## Controls

| Input                | Action                                         |
| -------------------- | ---------------------------------------------- |
| W / A / S / D, mouse | Move, look                                     |
| Left / right click   | Fire or throw selected grenade / aim           |
| Space / Shift / Ctrl | Jump / run / crouch                            |
| R                    | Reload                                         |
| 1 / 2 / 3            | Primary / pistol / knife                       |
| 4                    | Select and cycle available grenades            |
| 5                    | Objective slot; disabled in Team Deathmatch    |
| Q / mouse wheel      | Previous weapon / cycle inventory              |
| G / E                | Drop equipped firearm / pick up nearby firearm |
| Tab / Y / Escape     | Scoreboard / room chat / pause                 |

Bindings, sensitivity, crosshair, graphics and audio options persist in local browser storage. Escape is reserved by the browser. Anti-aliasing changes require a page reload. VSync remains browser-controlled. Texture detail changes filtering and surface bump/normal detail. Graphics presets never weaken tactical smoke.

## Combat

Choose among 24 primaries and 10 sidearms. Every spawn includes a knife and one each of HE, Flash and Smoke. Weapon balance is defined in `shared/weapons.js`, including per-weapon damage, cadence, ammo, recoil, spread, range and headshot multipliers.

Health, ammo, reloads, shot validation, damage, kills, respawns, equipment and match state are server-owned. Clients send movement/aim inputs and actions, never damage or death claims. A reliable press event preserves clicks shorter than a simulation tick. Movement uses fixed 60 Hz steps; room snapshots are sent at 20 Hz with local prediction/reconciliation and remote interpolation. There is no historical hit rewind or advanced anti-cheat.

Enemy kills award one team point. Friendly damage is off. Self-grenade damage is possible but does not award a point. Respawns take 3 seconds, restore equipment, and provide 1.5 seconds of protection that ends on firing/throwing. Dropped guns preserve magazine and reserve ammunition; pickups are validated by range/line of sight and claimed atomically.

HE uses an 8 m blast radius, 120 damage within 2 m of the player capsule, distance falloff, and whole-body obstruction checks. Fully solid cover blocks damage. Flash uses distance, facing and obstruction. Smoke is synchronized for 15 seconds with identical density on all presets. A separate, tested BombObjective state machine and original device model exist for future Bomb/Defuse integration; no bomb is issued or planted in Team Deathmatch.

Action transitions invalidate held fire and queued clicks on both client and server. Grenade throws complete before the previous weapon returns; shooting then requires a fresh press. Reload completion, switching, dropping, pickup, death and respawn also invalidate old fire input. Each team has ten collision-valid spawns; selection prioritizes unoccupied, concealed/distant positions and avoids recent repeats. See [the gameplay-review report](GAMEPLAY_REVIEW.md) for fixes, acceptance evidence and remaining launch checks.

## Assets and rendering

The reference-led Soldier and Terrorist are authored in `tools/character-study/`, baked in Blender, and compiled into skinned GLBs by `tools/build-characters.js`. Weapons and equipment remain authored in `src/weapon-models.js` and `src/equipment.js`; `src/character-models.js` is the retired rigid character builder, not the shipped character source. Uploaded images are references only; none are pasted into the arena. The 43-model pack is indexed, quantized and Meshopt-compressed. Embedded textures use WebP where smaller, with content-based names so full/LOD instances reuse GPU textures. Models load during match preparation, not on the homepage.

Both new characters use a 22-bone skin, one atlas material, a 2048-pixel color map and 1024-pixel normal/occlusion/roughness/metalness maps. They retain the approved smaller eyes and tapered chin. Each player owns its bones and skeleton while sharing immutable mesh and material resources. Locomotion clips blend with runtime crouch/foot IK, hand grips, firing, reload, switching, grenade throws and death. The four character files total roughly **6.8 MB** (complete model pack **19.5 MB**, decimal); full meshes are approximately 77.5k/86.2k triangles and distance LODs 23.3k/25.9k. Normal/ORM atlases use pixel-preserving lossless WebP, with baked short-range contact occlusion; color textures remain separately compressed. Inspect the actual animated game assets at <http://localhost:3000/tools/characters.html> while the development server runs.

Soldier and Terrorist art now has more developed faces, hands, footwear, clothing forms, gear and team-specific silhouettes. Firearms use contoured receivers, shaped stocks/grips, detailed sights and optics, mechanical controls and distinct family features. Original small surface textures distinguish wood, polymer, metal and fabric. First-person presentation includes weapon-specific grip positions, recoil, switching and reload choreography, including top-feed, helical, tube-fed and belt-fed designs. Grenades have separate detailed casings and articulated pull rings/spoons; the objective device has a lit numeric screen, keypad, plugged wires, retaining straps and carry handle.

COASTLINE keeps the shared layout/collision foundation in `shared/maps.js`; visual authoring is in `src/world.js` and `src/coastal-art.js`. Its warm courtyard A site, cooler B site and bridge/canal MID have expanded architectural and prop detail, with varied façades, balconies, arches, market dressings, signs, lamps, cables, vegetation, waterfront features and roof details. The three canal crossings, underwater route, climbable roofs/tower, stalls and dock remain. Original canvas patterns supply the coastal materials; the retained V1 atlas supplies sand. Preview images are actual 3D renders, including the improved homepage hero.

The homepage keeps the same branding, name entry, room actions, settings, instructions and server status. The upgrade focuses on the coastal render, contrast, input/button interaction states, clearer secondary actions and a small V2/map/mode/player-count treatment, not a new navigation flow.

Rendering uses material/geometry reuse, spatial instancing/batching, frustum culling, character LOD, bounded particles and shadow updates at 10 Hz. Refined muzzle flashes, brief smoke, ejected cases, impact marks and explosion effects remain presentation-only; all hit and damage decisions stay on the server. Original synthesized spatial sound includes gunfire, reloads, equipment, explosions, hit confirmation, surface footsteps and coastal ambience. Reload sounds follow each weapon's duration and cancel when the action is interrupted; grenade bounce sounds follow authoritative collision events. These are not copied game recordings.

## Match summaries

The normal server appends **one JSON object per finished match** to `data/matches.jsonl`. This includes player names, teams, kills, deaths, headshots, damage, score and outcome — no live movement frames. The folder is ignored by Git. It is local, unencrypted data; manage its retention yourself. In a container, mount persistent storage at `/app/data` if summaries should survive replacement. Automated tests use isolated temporary storage or disable saving.

## Verification and asset rebuilds

```sh
npm test
npm run build
npm run test:browser
npm run test:home
npm run test:characters
npm run test:visual
npm run test:first-person
BENCHMARK=1 npm run test:visual
```

Browser/visual tests require installed Google Chrome. They launch isolated headless profiles and servers, not your existing browser or live rooms. Screenshots and benchmark JSON go to ignored `test-results/`; see `test-results/benchmark.json` for the latest local measurement after running the benchmark. A local sample is not a low-end hardware or internet-latency guarantee.

The first-person sweep renders all 39 weapon/equipment models at rest and firearms at two reload phases (107 views). It checks finite transforms, hand creation and that exposed palm/finger vertices do not cross the camera near plane in those samples, and saves review screenshots. Forearms deliberately continue outside the frame. It does not prove perfect anatomical contact or the absence of clipping at every frame/FOV. For a targeted review, use `WEAPONS=glock18,r8,dualberettas npm run test:first-person`.

The homepage check uses the production build and covers eight viewport sizes (320–2560 px), the header/background blend, keyboard-accessible Settings and How to Play dialogs, invitation handling with Enter, input preservation during connection, reduced motion and the absence of heavy model downloads. Run it after `npm run build`.

Character authoring and bake instructions are in `art/characters/README.md`. After baking both sources, run `npm run assets:characters` to rebuild and install only the four character GLBs. `npm run test:characters` checks actual deformed skins, independent clones, hand/foot contacts and nineteen poses across both teams and full/LOD variants (76 cases), and records a bounded nine-character render benchmark. Set `REQUIRE_CHARACTER_60FPS=1` to enforce its local timing budget. Use `CHARACTER_BENCHMARK=0` when running the separate full-scene benchmark instead.

The full-scene benchmark records idle browser cadence and render submission time separately from animation-frame intervals. `BENCHMARK=1 UNCAPPED_BENCHMARK=1 npm run test:visual` is an optional Chrome diagnostic written to `test-results/benchmark-uncapped.json`; its uncapped results are not normal VSync playback or a sustained combat guarantee. Current measurements and their limitations are in `GAMEPLAY_REVIEW.md`.

To regenerate the full model pack after editing weapon/equipment code (using the already-built rigged character sources):

```sh
npm run assets
npm run test:visual
npm run build
```

`ALL_WEAPONS=1 npm run test:visual` renders the entire firearm collection. Human checks on two computers remain necessary for internet latency, aiming/audio feel and performance on lower-end hardware. Local automated checks are not a public competitive-play certification.

Three.js, Socket.IO and build-time asset tools retain their respective licenses. No Valve maps, character models, weapon meshes, sounds, logos or source code are included.
