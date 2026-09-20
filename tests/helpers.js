import { Game } from "../server/game.js";
import { emptyInput } from "../shared/game.js";
export function fixture(options = {}) {
  let time = 100;
  const events = [],
    saved = [];
  const game = new Game(
      (target, type, data) => events.push({ target, type, data }),
      {
        now: () => time,
        random: () => 0.5,
        duration: 60,
        loadHandshake: false,
        openingBuySeconds: 0, // Combat-unit fixtures skip preparation; buy.test.js covers real timers.
        onMatch: (r) => saved.push(r),
        ...options,
      },
    ),
    room = game.enter("a", "Alpha");
  game.enter("b", "Bravo", room.code);
  const ready = () => {
    for (const p of room.players.values()) game.choose(p.id, { ready: true });
  };
  const advance = (n) => {
    time += n;
  };
  return { game, room, events, saved, advance, ready };
}
export function lineUp(f) {
  f.ready();
  f.game.start("a");
  const a = f.game.player("a"),
    b = f.game.player("b");
  Object.assign(a, {
    x: -10,
    y: 0,
    z: -14,
    yaw: 0,
    pitch: 0,
    protectedUntil: 0,
  });
  Object.assign(b, {
    x: -10,
    y: 0,
    z: -17,
    yaw: Math.PI,
    pitch: 0,
    protectedUntil: 0,
  });
  a.input = emptyInput();
  b.input = { ...emptyInput(), yaw: Math.PI };
  return { a, b };
}
