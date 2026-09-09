# V2 gameplay-review pass — September 9, 2026

Project: `/Users/nikhilvadhawana/Desktop/CXSOURCE/REPO/crossline`

Branch: `version-2`. The completion pass is delivered on V2; V1 and the main
branch remain unchanged.

## Outcome and scope

The reproduced HE, grenade-to-gun auto-fire and repetitive-spawn bugs are fixed
at the gameplay/input layer. Room creation, joining, teams, readiness, loading,
Team Deathmatch, results and same-room replay are retained. Health, ammunition,
damage, death, score, inventory and respawning remain server-owned.

The accompanying visual pass improves the existing code-authored assets. It is
an iteration ready for playtest, **not a public-launch or commercial-art-quality
sign-off**. Automated rendering checks cannot certify anatomical grip contact,
all animation frames, subjective shooting feel or low-end performance.

## Reproductions and causes

- A held grenade click carried into the returned rifle and fired three rounds
  during a half-second observation. One input flag represented both the physical
  mouse hold and the current weapon's fire intent; queued presses could also
  survive inventory changes.
- HE placed 1 m from an enemy dealt 97 damage in the baseline fixture instead
  of killing. Measuring distance to the eyes artificially penalized explosions
  beside the feet. A single visibility sample also misrepresented partial cover.
- A deterministic 25-respawn run chose the same position `(-38, 29)` repeatedly.
  A small spawn pool and deterministic best-point selection lacked recent-use
  and occupancy handling.
- First-person inspection found generic hand orientation, weak pistol palm
  contact, overly exposed stocks, a reload sleeve crossing the camera, and
  special reloads needing different hand/mechanical motion. Existing long reload
  durations also propagated into their animation and audio timing.
- Character and map review found opportunities for stronger rear silhouettes,
  clothing compression, directional locomotion and site-specific cover. The
  already-approved eye size and tapered face were deliberately preserved.
- The completion review found pistol backstrap gaps and oversized grip length,
  third-person draw/drop/pickup transforms applied after wrist IK, lossy
  data-map compression, and self-shadow stripes in the studio preview renderer.
  These specific presentation defects were corrected; the face sculpt was not
  replaced during this pass.

Visual-quality concerns are review findings, not deterministic bug reproductions.
No unperformed device/network test is treated as passing.

## Gameplay changes

### HE and grenade physics

`server/explosions.js` calculates distance to the player capsule. Damage is 120
inside a 2 m close radius, with linear falloff to zero at 8 m. Seven probes
inside the body test obstruction; a wall covering the entire capsule blocks
damage, while a visible lower body can still be hit. Friendly fire and spawn
protection continue through the normal damage path. Multiple targets and
simultaneous explosions use that same authoritative path and kill accounting.

Thrown grenades retain server collision/fuse simulation, with impact friction
to reduce excessive sliding. Bounce audio follows server collision events.
HE kills have an explicit grenade indicator in the kill feed and confirmation.

### Action/input boundaries

`shared/actions.js` names idle, firing, reload, switch, grenade throw, knife,
drop, pickup, death and respawn states. Physical press state is separate from
effective fire input. Cancelling fire never manufactures a mouse release.

The server increments a fire epoch at action boundaries, invalidates old input
and pending clicks, and accepts fire only for the current weapon/spawn/epoch
with a fresh press sequence. Automatic weapons require an accepted press before
held input can continue firing. Reliable short clicks still work.

A throw lasts 0.55 seconds in server and presentation code, rejects incompatible
inventory/reload actions, then draws the previous owned weapon. Switching,
dropping, pickup, reload start/completion, death and respawn also invalidate fire.
Switching away from reload does not retain the cancelled reload's lockout, but
cannot shorten the last actual shot's fire interval.

The bomb remains disabled in TDM; the existing separate objective system and
its tests are not a newly enabled game mode.

### Respawning and reloads

Each team has ten collision-valid points. Selection excludes occupied points,
prefers concealment and at least 10 m enemy separation where possible, then
avoids the player's last nine points and points used by the room in four seconds.
If every position is exposed, it chooses among safer available points; protection
is not a guarantee that a camped map can always produce an invisible spawn.
The existing 1.5-second protection ends when shooting or throwing begins.

Reload timings remain distinct per firearm. Relative to their previous values,
pistols are 28% quicker, SMGs 27%, rifles 21%, shotguns 18%, snipers 16%, and
heavy weapons 20% (rounded to hundredths). Shared timings drive animation,
audio and server refill. Interrupted reload sounds are cancelled.

## Visual changes

- New weapon-space first-person palms, curled fingers, thumbs, knuckle/cuff
  detail and team materials; support poses differ by category. Moving wrists
  connect to separately solved forearms anchored outside the camera frame.
- Adjusted pistol and long-gun framing and hip/aim rotation. Reload support
  hands follow magazine/charging motions; tube, top, helical, belt, cylinder
  and dual-pistol presentation remain differentiated. R8 cylinder motion and
  dual-pistol hand retention received an additional review pass.
- Pistol magazine bodies and mechanical details, receiver hardware, rear sling
  fittings, charging latches and visible scope lenses refine the existing
  contoured gun collection. All shipped GLBs were regenerated.
- View-space muzzle smoke originates at the actual muzzle. Remote smoke also
  uses the gun muzzle. Effects stay bounded and independent of damage decisions.
- Soldier hydration equipment, garment compression folds and a different
  asymmetric Terrorist satchel reinforce the rear silhouettes. Both full/LOD
  assets were rebaked and rigged. Backward/strafe motion follows movement relative
  to facing; respawn, drop and pickup gain weapon-raising/lowering transitions.
- A SITE gains a warm fountain cover landmark; B SITE a cool compass monument;
  MID gets quay cover. Visible cover matches shared server collision boxes.
  Banners and directional lighting refine the sites without changing the base
  routes. Duplicate signage discovered in screenshots was removed. Actual 3D
  homepage/map/character preview renders were regenerated.

### Completion polish

- Pistol furniture now fits the palm; support thumbs run alongside the firing
  thumb instead of crossing it. Exposed forearms match each team's skin while
  wrists remain connected to the offscreen forearm solver.
- Draw/drop/pickup and knife transforms are applied before third-person hand
  IK, and reload support tracking uses the full shared magazine motion.
- Weapon profile bevels gain an additional smoothing segment within the model
  pack's existing 20 MiB limit. All 39 equipment/weapon GLBs were regenerated.
- Both character atlases were rebaked with subtle contact occlusion. Normal/ORM
  pixels now survive compression losslessly, verified against their source PNGs.
  Correct studio shadow bias removes the striped preview artifacts. In-game
  shadows retain the established budget; no extra first-person shadow pass ships.
- Map plants use curled, pointed leaves with connecting stems and visible soil,
  replacing the rounded placeholder-like foliage. Routes/collision are unchanged.
- Character validation now covers backward/strafe/crouch-walk, landing,
  drop/pickup, respawn and knife poses as well as the original ten states.
- The full browser test now waits for the authoritative post-Flash weapon
  return instead of guessing with a 750 ms delay. Throw-time input rejection
  remains intact; no combat assertion or gameplay rule was weakened.

## The ten requested checks

| Case | Evidence from this pass | Qualification |
| --- | --- | --- |
| 1. Throw HE near enemy, damage/death/feed | Actual thrown projectiles complete bounce/fuse; close enemies die. Separate assertions verify falloff, obstruction, kills, feed and team points. | Server integration fixtures, not a public internet match. |
| 2. Throw, returned gun stays idle | Two real Chrome clients; hold the mouse through throw/return and confirm unchanged rifle ammo. Release and fresh click consumes exactly one round. | Also covered for previous primary, sidearm and knife in action tests. |
| 3. Hold fire before grenade switch | Combined physical-button/server test starts with a rifle shot, injects old held/queued inputs through selection and throw, and confirms no returned-gun shot until release/new press. | Includes stale epoch/weapon packets. |
| 4. Pistol reload | All 34 firearms checked immediately before/after their reload deadlines; ammo conservation and immediate fresh-click firing pass. Rest/45%/89% pistol images reviewed. | Naturalness of the entire moving sequence still needs player/art acceptance. |
| 5. First-person pistol hold | All ten sidearms rendered; Glock, R8 and dual-pistol grip/reload images inspected and adjusted. Camera-crossing sleeve corrected. | Not a zero-clipping certificate at every FOV/action/frame. |
| 6. Every category/equipment hold | All 39 weapon/equipment models at rest, and 34 firearms at two reload phases: 107 real GLB views. | Transform/hand-presence checks plus representative visual inspection; bomb presentation only. |
| 7. More than 20 respawns | 25 respawns for each team use all ten valid points even with constant random input. | Safety takes priority when opponents occupy/camp points. |
| 8. Enemies near spawn | Fixtures verify concealed/distant choices, recent-use avoidance, and non-overlap with ten players. | Live map-fairness playtest remains necessary. |
| 9. Two grenades/multiple players | Concurrent explosion tests and two actual throws verify separate deaths/kill attribution and friendly-fire exclusion. | Repeated damage cannot credit an already-dead player twice. |
| 10. Both teams/models/animations | 76 full/LOD pose cases, skin/clone/contact/deformation checks, team images and 72 create/dispose cycles pass. | Directional blends and stylized contacts are not motion-captured or artist-certified. |

## Verification run

- `npm test`: **54 passing** unit/integration tests, including ten real Socket.IO
  clients and cross-room isolation.
- `npm run build`: passes.
- `node tests/browser.js`: passes complete two-browser multiplayer room/combat/
  inventory/grenade/results/replay/disconnect flow.
- `node tests/homepage.js`: passes production UI at eight viewport sizes,
  320–2560 px, including keyboard dialogs and no heavy model downloads.
- `CHARACTER_BENCHMARK=0 node tests/characters.js`: passes the 76-pose and
  72-lifecycle checks. Performance is measured separately below.
- `node tests/first-person.js`: passes 107 views with finite transforms, hands
  created, no exposed palm/finger near-plane crossings in the sampled views,
  and no browser errors. Screenshots are in `test-results/first-person/`.
- `BENCHMARK=1 node tests/visuals.js`: passes six map perspectives, representative
  weapons/equipment, animation regressions and both full-scene benchmark presets.
- `git diff --check`: passes.
- `npm audit` and `npm audit --omit=dev`: zero reported vulnerabilities at review.

The tests launch isolated servers/profiles and do not join or modify live rooms.
Reports/screenshots under `test-results/` are ignored generated artifacts.

## Performance and launch boundary

The final Apple M2 / Chrome ANGLE Metal check uses **1440×900, DPR 1**, the
local first-person view and nine visible opponent skins. Each preset uses
60 warm-up and 420 measured frames; main-camera draw callbacks confirm all
nine opponents in every measured frame. GPU tests run sequentially.

| Final browser-default measurement | Medium | High |
| --- | --- | --- |
| Frame interval median / p95 | 33.3 / 35.0 ms | 33.3 / 35.0 ms |
| Idle browser frame interval median | 33.3 ms | 33.4 ms |
| CPU render submission median / p95 | 7.2 / 11.2 ms | 7.4 / 11.4 ms |
| Mean draw calls | 1296 | 1328 |

Normal playback was approximately 30 FPS during this final run, including the
empty-page/idle baseline. The matching idle cadence points to browser/host frame
pacing, not evidence by itself of a game GPU bottleneck. The exact host cause
was not established. No system power/display preference was changed.

A separate, explicitly **uncapped diagnostic** (`--disable-frame-rate-limit`)
measured 5.1 / 9.0 ms medium and 5.0 / 8.9 ms high median/p95 frame intervals.
This demonstrates local submission headroom, not sustained user-visible FPS or
GPU-completion timing. A time-limited shadow pass runs on fewer of these faster
frames, so per-frame draw counts and rates are not directly comparable with
default playback. Both raw reports are retained separately under `test-results/`.
Earlier 16.7 / 18.2 ms results predate the final assets and are not the current
performance claim. A general 60 FPS guarantee is not made.

The 43 compressed model files total 19,485,944 bytes, with 6,768,008 bytes for
the four character variants. Character skins retain one atlas material, shared
textures and independent 22-bone skeletons. LOD, spatial batching/instancing,
frustum culling, limited shadow updates and bounded particles remain enabled.

Still required before calling the game launch-ready:

1. Longer two-computer/2–10-person playtests for aiming, sound balance, spawn
   fairness and sustained combat under real internet delay/loss.
2. Lower-end Windows/integrated-GPU and additional browser measurements; this
   short Mac sample does not guarantee 60 FPS on other hardware.
3. User/art acceptance of the refined fingers, dual-pistol and unusual-feed
   reloads, transitions and material treatment. The concrete polish defects
   listed above are addressed; current assets remain code-authored, and exact
   reference-image fidelity is **not** claimed.
4. A separately authorized HTTPS/WebSocket deployment and operational smoke
   test. No hosting, accounts, ranked system or new service was introduced.

The implementation and local regression checklist for this completion pass is
finished. The real-device/network, subjective art acceptance and deployment
checks above remain external acceptance work, not results of these local tests.
