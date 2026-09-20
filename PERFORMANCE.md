# V2 stability and performance pass — September 20, 2026

Scope: the existing CROSSLINE room flow and Team Deathmatch game. No new game
mode, accounts, services or anti-cheat system. Work remains on `version-2`;
this pass does not merge or push changes to GitHub.

## Problems addressed

- **Combat stalls:** explosions and flashbangs previously added and removed
  point lights, changing the light count and compiling new material shaders
  during play. A cold burst in the audit stalled a render submission for about
  2.3 seconds. Two persistent, shadowless effect lights now serve all bursts.
  World, character, weapon and effect shader variants are warmed during loading.
- **Blank/frozen presentation:** a render exception could prevent the next
  animation frame from being scheduled. The loop now survives exceptions and
  presents recovery controls. WebGL context loss pauses graphics visibly;
  restoration rebuilds the environment render target, warms resources, and
  resumes on Low without intentionally disconnecting the player. The server
  continues running during recovery: the player is not invulnerable or paused.
- **Excess GPU workload:** Auto is the new default. Every preset has a physical
  pixel budget; adaptive resolution uses sustained frame timing with hysteresis.
  Shadow-map sizes and update frequency are lower. Unrelated settings changes
  no longer dispose shadow maps or re-upload textures.
- **Map culling:** batched decorative meshes had escaped their original detail
  group and its distance tests. Batches now retain decoration metadata and
  world-space bounds. Collision-bearing architecture/cover remains visible on
  every preset. Static world transforms are frozen, and distant decorative
  shadow casters are disabled.
- **Characters and weapons:** full/LOD geometry switches keep the same rig,
  label and animation mixer. Distant skeletal updates run at 20 Hz; offscreen
  updates at 5 Hz, while root movement still interpolates each rendered frame.
  Third-person weapon solid-color parts are batched by material class and
  animation pivot. First-person models remain detailed.
- **Effects:** tracers, casings, impacts, particles and cosmetic smoke reuse
  bounded pools. Gameplay smoke has a uniform ten-sample density integration
  and an opaque-interior early exit on every preset; Low cannot turn it off.
- **Loading/memory:** the game loads both character LODs, equipment and only
  the weapons selected in the room. Additional loadouts load before later
  matches. Two decoding workers, per-request deadlines, retry controls and a
  120-second room loading allowance replace the all-arsenal first load and
  45-second allowance. Large decoded model textures are reduced before GPU
  upload: 512 px on Low/low texture detail, 1024 px on Medium/Auto, up to 2048 px
  on High/Ultra. Existing full-quality GLBs are not altered. Unneeded warmup
  weapon instances are discarded between loadouts.
- **Networking:** self-contained, compact snapshots still arrive at 20 Hz, but
  stale snapshots can now be discarded rather than queued. Room events and
  combat commands remain reliable; simulation remains 60 Hz and authoritative.
  Position/velocity wire precision is 0.001 units; server state is unmodified.
- **CPU:** shared static collision broadphase limits nearby movement checks;
  ray checks avoid temporary arrays. HUD markup updates only when it changes;
  camera projection matrices stop updating once FOV settles.

## Verification

On local Chrome / Apple M2 (ANGLE Metal), 1440 × 900 viewport:

| Measurement | Result |
| --- | --- |
| Nine visible opponents, Low | 504 average draw calls; 16.7 ms median frame interval |
| Nine visible opponents, High | About 870 average draw calls; 16.7 ms median frame interval |
| Earlier audit draw calls, comparable scene | About 850 Low / 1130 High |
| Repeated combat burst + three smoke volumes | 4.9 ms median / 6.3 ms p95 CPU submission; 10.8 ms worst in the latest sample |
| GPU elapsed query during combat test | About 11.6 ms median / 13.5 ms p95; 499 valid queries |
| Shader programs before/after combat | 43 / 43: no new combat-time variants |
| Five effect cycles after clearing effects | Stable at 989 GPU geometries / 78 textures |
| Example two-player room model download | 11 models, 8,420,616 bytes instead of 43 models, 19,485,944 bytes |
| Ten-player idle snapshot fixture | 5,677 → 2,639 JSON bytes, approximately 54% smaller |

Timing is a local sample, not a hardware guarantee. Frame intervals include
browser pacing; submission time is not total GPU time. GPU query time is **not**
a GPU-utilisation percentage. The rendering harness loads the full asset pack
at full texture resolution before testing; actual Auto/Low room loading uses
the smaller texture budget described above.

Checks performed:

- 59 Node tests, including exact broadphase/full-scan parity over 13,500
  movement ticks, snapshot round trips, adaptive resolution and loadout selection.
- Production build and two real browser clients: readiness, loading, team
  balance, shooting, death/respawn, reload, drop/pickup, all three grenades,
  scoreboard, replay, return, host transfer and disconnect cleanup. Includes
  choosing a previously unloaded weapon for a later match in the same room.
- 76 character pose cases across both teams/LODs and 72 lifecycle disposal checks.
- 107 first-person weapon/equipment rest/reload renders.
- Homepage checks at eight viewport sizes, including keyboard-accessible dialogs
  and no heavy model downloads before joining a match.
- Injected render exception: recovery UI appears while the HUD clock continues;
  retry resumes in the same room.
- Actual `WEBGL_lose_context` loss/restoration: recovery UI, resource rebuild and
  subsequent rendering pass without an uncaught page error.
- Repeated combat, stable effect resource counts, shader reuse, retained
  character identities through 30 LOD transitions and shadow-target preservation
  after unrelated settings changes.

Run `npm test`, `npm run build`, `npm run test:browser`, and
`npm run test:performance`. Optional presentation checks are
`npm run test:characters`, `npm run test:first-person`, `npm run test:home`.
Detailed generated measurements/screenshots are in ignored `test-results/`.

## Dell / Windows retest still required

The reported Dell laptop has 32 GB RAM and an unspecified integrated GPU.
Its original blue-screen event was not captured, so GPU-driver reset/OOM has
**not** been established as the original cause. We fixed reproduced failure
paths; we cannot certify that every driver/browser fault is eliminated.

1. Restart the Node server and refresh clients so server/client changes match.
2. Choose **Auto**, enable **Adaptive resolution**, and initially cap at **60 FPS**.
   Reload if assets were already loaded on High/Ultra. Try Low if needed.
3. Play at least 15–20 minutes, with several opponents, smoke, grenades, repeated
   deaths, weapon changes, tab switching and a second match in the same room.
4. If it fails, record Chrome version, exact GPU model, graphics settings and
   the recovery message or browser-console error. Confirm hardware acceleration
   and WebGL 2 are available. Avoid interpreting 32 GB RAM as a GPU-performance
   guarantee.

Firefox/Safari/Edge and the actual Windows GPU still need device validation.
No artificial GPU-usage percentage or cross-browser certification is claimed.
GPU-native KTX2/Basis compression is not added: current savings come from the
existing Meshopt/WebP pack, staged loading and smaller decoded textures. No
unbounded memory leak was reproduced in the original soak; the pass reduces
resident workload and allocation churn instead of claiming a nonexistent leak.

## Main implementation files

- `src/renderer.js`, `src/performance.js`: budgets, effects, warmup, LOD, culling.
- `src/graphics-recovery.js`, `src/main.js`: recovery, loading, frame loop, HUD.
- `src/assets.js`, `src/models.js`, `src/world.js`, `src/smoke.js`: asset/runtime cost.
- `src/settings.js`: Auto/adaptive settings, persisted-value validation.
- `shared/game.js`, `shared/snapshot.js`, `server/index.js`, `server/game.js`:
  physics broadphase, snapshot transport and loading allowance.
