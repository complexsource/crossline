# Crossline — Version 2

Canonical project: `/Users/nikhilvadhawana/Desktop/CXSOURCE/REPO/crossline`.

A browser multiplayer FPS using Three.js, Node.js and Socket.IO. Create a named room, share its six-character code, choose **Soldiers** or **Terrorists**, ready up, and play ten-minute Team Deathmatch on **COASTLINE**. Supports 2–10 players. No accounts, matchmaking service or database.

Work is on `version-2`. Version 1 remains unchanged on `codex/version-1`. V2 is a **playable implementation milestone**, not a claim that the artwork has reached the supplied reference images’ quality. See [V2 acceptance and limitations](VERSION2.md). [UPGRADE.md](UPGRADE.md) describes the historical V1 art pass.

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

HE damage uses radius and obstruction. Flash uses distance, facing and obstruction. Smoke is synchronized for 15 seconds with identical density on all presets. A separate, tested BombObjective state machine and original device model exist for future Bomb/Defuse integration; no bomb is issued or planted in Team Deathmatch.

## Assets and rendering

Original articulated models are authored in `src/character-models.js`, `src/weapon-models.js` and `src/equipment.js`. Uploaded images are references only; none are pasted into the arena. GLB assets are merged, indexed, quantized and Meshopt-compressed. The current 43-model pack, including two character LODs, is about 5 MB. Models load during match preparation, not on the homepage.

COASTLINE uses shared collision geometry in `shared/maps.js` and rendering in `src/world.js`: buildings, two courts, three canal crossings, underwater route, climbable roofs/tower, stalls, dock, boats, palms and distant cliffs/lighthouse. Stone/plaster/wood textures are generated from original canvas patterns; the retained V1 material atlas supplies sand. Preview images are actual 3D renders.

Rendering uses material/geometry reuse, spatial instancing/batching, frustum culling, character LOD, bounded particles and shadow updates at 10 Hz. Original synthesized spatial sound includes gunfire, reloads, equipment, explosions, hit confirmation, surface footsteps and coastal ambience. These are not copied game recordings.

## Match summaries

The normal server appends **one JSON object per finished match** to `data/matches.jsonl`. This includes player names, teams, kills, deaths, headshots, damage, score and outcome — no live movement frames. The folder is ignored by Git. It is local, unencrypted data; manage its retention yourself. In a container, mount persistent storage at `/app/data` if summaries should survive replacement. Automated tests use isolated temporary storage or disable saving.

## Verification and asset rebuilds

```sh
npm test
npm run build
npm run test:browser
npm run test:visual
BENCHMARK=1 npm run test:visual
```

Browser/visual tests require installed Google Chrome. They launch isolated headless profiles and servers, not your existing browser or live rooms. Screenshots and benchmark JSON go to ignored `test-results/`.

To regenerate the committed model pack after editing asset authoring code:

```sh
npm run assets
npm run test:visual
npm run build
```

`ALL_WEAPONS=1 npm run test:visual` renders the entire firearm collection. Human checks on two computers remain necessary for internet latency, aiming/audio feel and performance on lower-end hardware. Local automated checks are not a public competitive-play certification.

Three.js, Socket.IO and build-time asset tools retain their respective licenses. No Valve maps, character models, weapon meshes, sounds, logos or source code are included.
