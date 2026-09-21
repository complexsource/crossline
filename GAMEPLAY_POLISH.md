# Gameplay polish and verification

## Changes

- **Cold loading:** an inline, themed animated boot screen renders before the application bundle. The app stays hidden until its CSS is ready; optional artwork/font loading has a bounded wait. Barlow fonts are now served locally with their OFL license, avoiding late external-font swaps. Failed loading offers a retry that preserves the room invitation. Reduced-motion preferences are respected. Match loading retains real asset progress, adds an animated scan, and no longer displays a fake countdown before everyone is ready.
- **Aiming:** AUG and SG 553 now use a clear optical view, alongside SSG 08, AWP, G3SG1 and SCAR-20. Firearms retain their individual zoom values. Equipment cannot create an invalid camera FOV. A single eligibility rule governs camera, reticle, sensitivity and authoritative input. Character detail and animation update thresholds account for scope magnification; important HUD information stays above the scope mask.
- **Locomotion:** shared, interpolated stance drives both eye height and the collision capsule. Headroom checks still prevent standing through ceilings. Ground attachment handles shallow descending stairs without repeatedly entering the falling/landing states. Bounded camera offsets soften stair edges without modifying server positions or jump trajectories. Gait, crouch, airborne legs, landing, death, draw and equipment transitions are eased. Footstep cadence follows actual movement speed.
- **Grenades:** a 0.75-second staged pin-pull/wind-up/release/follow-through animation releases the projectile at 0.36 seconds. The server reserves inventory immediately and launches from the player's current position and aim at release. The fuse starts at release (HE 2s, flash 1.7s, smoke 2.3s). Dying during wind-up drops the primed grenade. Swept collision prevents thin-wall tunnelling; surface friction is consistent. Bot trajectory previews use the same physics and retain their planned aim through release. HE retains close-range damage, distance falloff, solid-cover checks, friendly-fire rules and spawn protection; successful nonfatal HE hits now show confirmed damage. Flash and smoke keep their distinct authoritative gameplay effects. Throw/bounce audio and bounded explosion/dust effects are improved.
- **Other fixes:** remote weapons that have not downloaded yet cannot crash the renderer; their throw visibility is no longer overwritten. Mouse capture no longer waits for the audio device. Raw-input fallback is limited to unsupported devices; permission/rate-limit denials are not immediately retried, and capture throttling displays a clear wait-and-retry message. Cheap palm trunks remain visible with their foliage on Low. Bot reaction delays no longer consume the grenade-planning cooldown; rejected bot purchases cannot terminate the game tick.

Room creation, joining, teams, host controls, the protected 20-second opening, 10-second respawn buying, match scoring and replay remain intact. The bomb's existing equipment presentation is smoothed, but it remains **unavailable in Team Deathmatch**; this update does not introduce a bomb game mode.

## Verification

Latest local verification: **101/101 unit/socket tests passed**, production build passed, and every browser suite listed below passed. The dependency audit reported zero vulnerabilities. These results cover the current local changes, not an externally deployed server.

Run from the repository root, sequentially. The scope test spaces real mouse-capture requests more than two seconds apart to respect [Chromium's pointer-lock rate limit](https://chromium.googlesource.com/chromium/src/third_party/%2B/044cd9be23eca0c909c7a0c60c047ab7e1a669f1%5E!/). Rapid automated menu/capture cycles reproduced that native restriction; they were not rendering or scope failures.

```sh
npm test
npm run build
node tests/browser.js
node tests/buy-browser.js
node tests/bots-browser.js
npm run test:polish
node tests/homepage.js
node tests/first-person.js
node tests/characters.js
node tests/performance-browser.js
npm audit --omit=dev --audit-level=high
```

Coverage includes real two-browser room/combat/replay flows, all 39 equipment cards, all six scopes through actual mouse controls, delayed/failed CSS loading, missing remote weapon assets, grenade release and damage, crouch/headroom/stairs, a complete ten-minute bot simulation, 107 first-person rest/reload renders and 76 character-pose cases. Rendered disposal checks exercise 72 character lifecycles. Forced render exceptions and WebGL context loss/restoration recover in the same room. Generated screenshots and JSON reports are under ignored `test-results/`.

Local complete-map Chrome measurements (Apple M2, 1440×900, nine characters visible in every measured frame): Low and High had approximately 16.7ms median frames at the browser's 60Hz cadence. CPU submission p95 was approximately 4.6ms Low / 6.4ms High. Combat stress had approximately 15.7ms GPU p95; sampled geometry/texture counts remained stable and shader program counts did not grow. These are local measurements, **not a Windows/iGPU or cross-browser performance guarantee**. Production dependency audit: zero reported vulnerabilities at verification time.

## Release checks still requiring the target environment

- Play a full match on the reported Windows 11 Dell integrated-GPU laptop, including scopes, stairs, all grenade types, tab switching and reconnects. Start with Auto or Low, then compare Medium.
- Verify intended Firefox/Safari/Edge versions, HTTPS pointer-lock behavior, real internet latency and the deployment host's WebSocket/proxy configuration. Automated browser checks here used installed Google Chrome.
- The Node production build/isolated production server are tested. Docker's daemon was unavailable, so the container itself was not launched. No public deployment, commit or push was performed.
- Deploy client and server together: the snapshot now includes stance and grenade-release timing changed. Restarting the in-memory server removes rooms; perform production updates between matches, then refresh clients.

Fonts ship in `public/fonts/`; `npm run assets:fonts` is an optional maintainer regeneration command and is not needed to start, build or deploy the game.
