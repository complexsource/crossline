# In-game armory

Implemented on `codex/guns`. This replaces waiting-room weapon selectors, not the existing create/join/team/ready/bot flow. Equipment selection is **free**; there is no currency, purchase persistence, account or economy.

## Playing

- After all clients finish loading and the countdown completes, everyone receives **20 seconds** to equip. Press **B**, or use **Open Buy Menu** on the mouse-capture screen. Movement, firing, throwing and damage are blocked server-side during this shared preparation phase. Looking around and switching equipment remain available.
- The ten-minute match clock starts when preparation finishes. No match time is consumed by opening purchases or asset loading before deployment.
- Each respawn gives **10 seconds** to change equipment. This is live combat: shopping does not pause the match or extend the existing 1.5-second spawn protection. Firing ends that normal protection as before.
- **B** and **Done · Resume** close the menu and request mouse capture. **Esc** or **Close** return to the mouse-release screen. Expiry, death, results, leaving the room or graphics recovery close the menu safely. Expiry never forces mouse capture.
- A full team-standard kit is provided every life: M4A4/USP-S for Soldiers, AK-47/Glock-18 for Terrorists, knife, and one each HE/flash/smoke. Skipping the menu is safe. **Use previous loadout** restores the primary/sidearm chosen during the previous life; it does not refill spent grenades or ammo. World pickups do not change this saved preference.
- One primary and one sidearm at a time. Changing selections replaces that slot without spawning a free world drop. Every gun's remaining ammunition is remembered for the current life, including rounds transferred by dropping or picking up a gun. Returning to a previously selected weapon does not refill it. A newly selected weapon receives its initial ammunition once per life. Grenades refill only on respawn.
- Bots use the same server buy API and phase restrictions, automatically equipping a team-standard or remembered kit. They do not add client-side AI or download new model types.

## Complete catalog

| Category  | Items                      |
| --------- | -------------------------- |
| Rifles    | 7                          |
| SMGs      | 7                          |
| Shotguns  | 4                          |
| Snipers   | 4                          |
| Heavy     | 2                          |
| Sidearms  | 10                         |
| Grenades  | 3                          |
| Equipment | Knife and objective device |

All 39 existing items have actual model-rendered thumbnails, names and selection/status controls. The objective device remains visible but **mode-locked in Team Deathmatch**; this change does not enable Bomb/Defuse. Each firearm card shows configured damage, RPM, magazine size and a relative hip-fire accuracy rating (not a guaranteed hit percentage).

## Implementation and performance

- `shared/buy.js`: catalog derived from `WEAPONS`, category metadata and default phase durations.
- `server/buy.js`, `server/inventory.js`: selection, previous kit and per-life ammo ownership.
- `server/game.js`, `server/index.js`: authoritative timing, combat gates and socket-owned purchases. Requests require the current spawn and match epoch; dead, late, stale, invalid and excessive requests are rejected. Client health/ammo/target IDs are ignored.
- `shared/snapshot.js`: compact public timers and prior selections. Private ammo ledgers are never broadcast.
- `src/buy-menu.js`, `src/style.css`: accessible native dialog, keyboard category navigation, countdown, current kit and responsive cards. No additional WebGL canvas or animated model previews.
- `src/main.js`, `src/assets.js`, `src/renderer.js`: pointer/input isolation and on-demand weapon streaming. A local selection waits for its model; remote players and world drops load newly encountered guns in the background. Missing models cannot crash the renderer. Expired or old-life downloads cannot apply a purchase.
- `src/settings.js`: rebindable B action. Existing custom B bindings are preserved with a free alternate key for the new action.

The complete thumbnail set is about **355 KiB** of WebP. Thumbnails are lazy-loaded and cached by the browser; the full gun model collection is not downloaded just to open the menu. Existing LOD, shared resources, adaptive resolution and bounded effects remain unchanged. Cached weapon models are reused across lives and matches; testing on the actual integrated-GPU laptop is still recommended.

## Verification

```sh
npm test
npm run build
npm run test:buy
npm run test:browser
npm run test:bots
npm run test:performance
npm run test:home
```

Buy tests cover catalog completeness/thumbnails, the exact 20/10 rules, loading exclusion, movement/combat protection, all available items, mode gating, ammo/drop conservation, reload/held-fire safety, previous loadouts, vulnerability during respawn shopping, socket authority, stale/malformed requests and bot compliance. The production Chrome test checks all cards/images, responsive layouts, keyboard/pointer-lock behavior, actual lazy purchases/remote streaming, expiry, respawn, delayed-download rejection, replay and room continuity. It uses an isolated server with a controllable clock for deterministic expiry/layout checks, not the user's live room.

To rebuild thumbnails after changing the source weapon models, run `npm run assets:buy-thumbnails`, then `npm run build`. Screenshots are written to ignored `test-results/buy-*.png`. Local browser tests are not a guarantee of performance on every GPU or public-network latency.
