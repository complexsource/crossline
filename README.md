# Crossline

Project location: `/Users/nikhilvadhawana/Desktop/CXSOURCE/REPO/crossline`. Use this folder for future development.

A small browser multiplayer FPS: **Three.js + Node.js + Socket.IO**. Create a six-character room, choose one of eight original maps and a 2–10 player limit, invite friends, choose red or blue, and play ten-minute team deathmatch. No accounts or database. See [upgrade notes and asset provenance](UPGRADE.md) for the visual work, verification and remaining limitations.

## Run

Requires Node.js 22.12 or newer.

```sh
npm install
npm run dev
```

Open **http://localhost:3000**. Open a second browser window, enter another name, and join the first window’s room code. The host starts the match. Each player clicks **Enter match** to capture their mouse. Escape releases it.

For a production build:

```sh
npm run build
npm start
```

`PORT` defaults to `3000`. The single Node process serves both the built browser client and Socket.IO. Rooms live in memory and disappear when empty or when the process restarts.

## Playing with friends

Friends must connect to **the same running server URL**. A room code does not connect separate servers. The copy button copies an invite URL with the room code prefilled.

- On your own machine, use `http://localhost:3000` in two windows.
- For a LAN test, other computers can open `http://YOUR-LAN-IP:3000` if your firewall permits it. Pointer lock/raw mouse features and clipboard behavior can vary on non-HTTPS LAN origins; HTTPS is recommended.
- For internet play, deploy this project to a **single long-running Node/container host with HTTPS and WebSocket support**, build with `npm ci && npm run build`, and start with `npm start`. A Dockerfile is included. Point both HTTPS and the `/socket.io/` upgrade route to the same process. Set proxy WebSocket idle timeout above 30 seconds. Do not deploy this as a static-only site or a serverless request function.

No public hosting account or internet deployment is configured by this repository. Localhost links are accessible only on the machine running the server. A public deployment needs its own hostname and hosting environment.

Keep one process/instance for V1: independent instances do not share rooms. No Kubernetes, database, Redis, or services are required.

## Controls

| Input | Action |
| --- | --- |
| W / A / S / D | Move |
| Mouse | Look |
| Left click | Shoot / knife attack |
| Right click | Aim; sniper uses scope |
| Space | Jump |
| Shift | Run |
| Ctrl | Crouch |
| R | Reload |
| 1 / 2 / 3 | Primary / pistol / knife |
| G | Throw grenade |
| Tab | Scoreboard |
| Escape | Release mouse, settings, leave match |

Choose Vektor AK, Sentinel M4, Breaker 12 shotgun, or Longshot .308 sniper in the waiting room. Every spawn includes the selected primary, Kestrel 9 pistol, field knife, and one fragmentation grenade. Weapon names and models are our own interpretation of common weapon categories, not imported game assets.

All weapons have configurable damage, fire interval, ammunition, reload duration, recoil, spread and range in `shared/game.js`. The shotgun has eight pellets; rifles are automatic; pistol, shotgun, sniper and knife fire on press. Right click reduces spread, and unscoped sniper shots are less accurate. Headshots do 2.5× damage. Knife reach is 2.5 metres. Grenades have a two-second fuse, bounce, radial damage and wall occlusion. Enemy kills add one team point; no friendly damage. Self-grenade deaths add a death but no team point.

Death lasts three seconds. Spawns favor team locations farther from living enemies, with a 1.5-second protection window that ends when firing or throwing. The host can replay or return everyone to the same room. A disconnected host is replaced by the next remaining player; an empty team ends a running match. Refreshing removes the old player; there is no account/reconnect recovery, and running matches do not accept new joins.

## Implementation

- `server/game.js`: authoritative room and match state, movement, firing, hit regions, collision, reloads, grenades, health, kills, respawns and results.
- `server/index.js`: one HTTP/Socket.IO process and Vite development middleware.
- `shared/game.js`: weapons and shared movement math.
- `shared/maps.js`: eight map definitions, authoritative colliders and team spawn locations.
- `src/main.js`: room screens, input, local prediction, snapshot reconciliation and HUD.
- `src/renderer.js`: Three.js camera, interpolation, animation and effects.
- `src/models.js`, `src/world.js`, `src/materials.js`: original procedural geometry, articulation, instancing and original texture-based PBR materials.
- `src/audio.js`: original Web Audio synthesis for weapons, reloads, footsteps, wind and explosions.

The client sends input, not damage or death commands. The server simulates at a nominal 60 Hz and broadcasts snapshots at 20 Hz. Remote players interpolate; the local player predicts and reconciles. This is a deliberately simple V1 without historical rewind, advanced anti-cheat, voice chat, player blocking, or persistence. The simulation interval can slow under sustained server overload; the initial design targets small friend groups, not public competitive hosting.

Input sizes and event rates are bounded. Names render as escaped text, rooms are isolated, host permissions are checked, and health/ammo/fire cadence are server-owned. Browser clients are still modifiable; this is not a cheat-proof ranked platform. Do not expose the Vite development server publicly; deploy the production build.

Graphics use a shadowed sun, reusable geometry/materials, an atmospheric sky, environment lighting and bounded effects. Four presets control pixel ratio, shadows, detail and particles; LOW disables shadows. The generated material sheet is served as compressed WebP. Optional Google Fonts fall back to local fonts. Models and animations are original procedural work, not photorealistic AAA assets; the exact boundaries are described in `UPGRADE.md`.

## Verification

```sh
npm test
npm run build
node tests/browser.js
node tests/visuals.js
```

`npm test` covers gameplay rules and ten actual Socket.IO clients using an isolated server. The browser test requires locally installed Google Chrome and launches two isolated headless browser contexts, never your existing Chrome profile. It exercises the room flow, team balancing, mouse capture, real shooting, kills, respawn, switching, reload, grenades, scoreboard, keyboard movement, match results, replay, return, host transfer and refresh cleanup. Screenshots are saved under ignored `test-results/`.

Manual two-machine QA still matters: check aiming feel, audio, network delay, shadows, and performance on your own hardware. Browser automation is not an internet latency benchmark.

## Dependencies and references

Three.js and Socket.IO retain their own licenses. No Valve/Counter-Strike maps, sounds, models, textures, logos or source code are included.

- [Three.js documentation](https://threejs.org/docs/)
- [Socket.IO server initialization](https://socket.io/docs/v4/server-initialization/)
- [Socket.IO rooms](https://socket.io/docs/v4/rooms/)
