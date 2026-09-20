# Crossline bots

Branch: `codex/bots`. This adds optional practice opponents and teammates to the existing COASTLINE Team Deathmatch flow; it does not introduce a separate mode, service, login or database.

## Playing

1. Create a room. In **BOT PLAYERS**, select a difficulty and **Auto Balance**, **Soldiers** or **Terrorists**, then **Add Bot**.
2. Add friends or more bots, up to the room's combined 2–10-player limit. A solo host can start with one bot; the maximum is nine bots with one human.
3. Bots are automatically ready. Humans select **I'm ready**, and the host selects **Start Game**.
4. After the match, **Play Again** keeps the squad and resets scores/equipment. **Return to Room** lets the host edit each bot's difficulty/team or remove it.

Bot names start with `[BOT]` in the roster, world labels, kill feed, scoreboard and results. Only the human host can manage bots, and only in the waiting room. A full room does not silently evict a bot when a friend joins: the host must remove one first. Host transfer always chooses another human. The last human leaving destroys the room and all its bot state, even during loading or results.

## Difficulty and fairness

| Level  | Reaction baseline¹ | Perception/decision rate (maximum) | Behavior                                                                                                 |
| ------ | ------------------ | ---------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Easy   | 750 ms             | 5 Hz                               | Less accurate, slower turning, shorter bursts and sight range; patrol and pursue visible enemies         |
| Normal | 420 ms             | 7.2 Hz                             | Better aim; seeks nearby cover while hurt/reloading/low on ammo; follows nearby moving teammates         |
| Hard   | 260 ms             | 10 Hz                              | Faster but imperfect aim/turning, longer sight range, cover/team following and limited tactical grenades |

¹ Reaction delay varies by ±15%; turning and weapon actions can delay firing further. All levels retain misses and pauses. Difficulty does not change health, weapon damage, spread, fire cadence, ammunition or reload duration.

Bots use the existing Soldier/Terrorist characters and team-standard M4A4/USP-S or AK-47/Glock-18 loadouts. They reload with finite reserves, switch to their pistol if the primary is exhausted, and fall back to the knife when firearms are dry. Respawn restores the same equipment as for humans. The same server validates input, shots, headshots, damage, deaths, team points, protection and three-second respawns.

Perception checks horizontal field of view, range, solid-wall line of sight, smoke and server-authoritative flash exposure. Aim uses the last observed position/velocity, never hidden live coordinates. A lost target leaves at most 2.5 seconds of last-seen memory for investigation. Perception updates at the listed bounded rates, not every movement tick; a just-disappeared target can therefore receive a short stale burst until the next check, without live tracking through cover.

Normal/Hard cover selection samples a small neighborhood against actual colliders. Navigation is derived from COASTLINE's shared collision map, including banks, bridges, stairs, roof/tower levels and the crouched canal underpass. Bots use normal movement/jumping/crouching, not teleportation. Stuck recovery retries a route, attempts a jump and abandons an unproductive route.

Hard bots can throw HE at a visible, separated enemy, use a flash after HE is spent, and place defensive smoke when badly hurt. A bounded ballistic preview checks fuse/bounces, landing distance and blast line of sight; nearby teammates/self discourage unsafe HE/flash throws. Inventory, weapon switching, throw animation, bounce, fuse, effects and damage still use the normal authoritative equipment pipeline. Decisions have cooldowns and bots won't release new grenades when three projectiles are active; smoke release additionally checks active/pending smoke. These limits apply to bot additions, not human controls. Moving players can still enter a blast after a throw; this is not a guarantee against every accidental self-flash or self-hit.

## Performance and architecture

- `shared/bots.js`: difficulty parameters and bot names.
- `server/bot-navigation.js`: one cached, static multilevel navigation graph, bounded A\* searches and local cover queries. Prepared before the normal server accepts connections so the first Add Bot does not stall another room.
- `server/bots.js`: server-only perception, memory, aiming, tactics and generation of ordinary input/actions. Decisions are staggered; route requests are limited to roughly one per second except bounded stuck recovery.
- `server/game.js`: room lifecycle, bot identity, balancing, snapshots/results and invoking AI inside the existing 60 Hz simulation.
- `server/index.js`: host-authorized socket handlers using the acting socket's identity; no client-supplied bot identity can redirect normal input/actions.
- `src/main.js` / `src/style.css`: waiting-room controls. `shared/snapshot.js` carries only public bot/difficulty metadata, never paths or private AI state.

Bots create no network sockets, animation loops, timers or extra model types. Their positions, shots and equipment use existing 20 Hz room snapshots/events and ordinary interpolated player visuals. Character LOD, shared resources, adaptive resolution and bounded effects remain in use. There is no client-side pathfinding. Removing a room releases its players, paths, memories and effects; only the reusable static graph remains.

More visible characters and more simultaneous combat still cost GPU/CPU time, just as additional human players do. Start with 1–2 bots and Auto/Low graphics on integrated GPUs. Nine bots is supported, not a promise of 60 FPS on every laptop. No advanced squad communication, hearing simulation, human-quality tactics, bomb objectives or automatic mid-match replacement is implemented.

## Verification

```sh
npm test
npm run build
npm run test:bots
npm run test:browser
npm run test:performance
npm run test:home
```

`tests/bots.test.js` covers permissions, validation, capacity, real movement over key routes, cover, following, lost-target memory, walls/smoke/flash, reaction delays, real damage/reloads/respawns, all three grenades, bounded decisions, a full ten-minute nine-bot simulation, replay and cleanup. `tests/bots-network.test.js` exercises the real socket boundary and solo loading handshake. `tests/bots-browser.js` uses the production client with real Chrome profiles for solo combat, UI at narrow/desktop widths, all difficulty choices, a ten-player mixed match, scoreboard/results, replay, host transfer and last-human refresh.

The browser test writes screenshots and `test-results/bots-browser.json` with observed frame intervals, heap usage, WebGL/error checks and server tick timings. These are local samples; heap size is not a memory-leak proof, frame intervals are not GPU utilization, and an accelerated simulated match is not a hardware soak test. Final feel/performance should also be checked on the Windows 11 Dell integrated-GPU laptop and with friends over the intended network. No repository deployment, push or merge is performed by these tests.
