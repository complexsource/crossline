import { getMap, spawnHeight } from "../shared/maps.js";
import { eyeHeight } from "../shared/game.js";

export function chooseSpawn(room, player, now, random, visible) {
  const map = getMap(room.mapId);
  room.spawnHistory ||= new Map();
  player.recentSpawns ||= [];
  const living = [...room.players.values()].filter(
    (p) => p !== player && p.hp > 0,
  );
  const candidates = map.spawns[player.team]
    .map((s, index) => {
      const y = spawnHeight(s.x, s.z),
        key = `${player.team}:${index}`;
      const enemies = living.filter((p) => p.team !== player.team);
      const distance = Math.min(
        100,
        ...enemies.map((p) => Math.hypot(p.x - s.x, p.z - s.z)),
      );
      const exposed = enemies.filter(
        (p) =>
          Math.hypot(p.x - s.x, p.z - s.z) < 45 &&
          visible(
            { x: p.x, y: p.y + eyeHeight(p), z: p.z },
            { x: s.x, y: y + 1.25, z: s.z },
            room,
          ),
      ).length;
      const occupied = living.some(
        (p) => Math.hypot(p.x - s.x, p.z - s.z) < 1.25 && Math.abs(p.y - y) < 2,
      );
      const age = now - (room.spawnHistory.get(key) ?? -Infinity);
      return {
        ...s,
        y,
        key,
        occupied,
        distance,
        exposed,
        age,
        recent: player.recentSpawns.includes(key),
        valid: !map.boxes.some(
          (b) =>
            Math.abs(s.x - b.x) < b.w / 2 + 0.34 &&
            Math.abs(s.z - b.z) < b.d / 2 + 0.34 &&
            b.y + b.h / 2 > y + 0.01 &&
            b.y - b.h / 2 < y + 1.9,
        ),
      };
    })
    .filter((s) => s.valid);
  // Safety tiers precede randomness. A camped map still uses the safest free
  // point, never a teammate's exact position. Ten points cover at most nine peers.
  let pool = candidates.filter((s) => !s.occupied);
  if (!pool.length) pool = candidates;
  const hidden = pool.filter((s) => s.distance >= 10 && !s.exposed);
  const distant = pool.filter((s) => s.distance >= 10);
  if (hidden.length) pool = hidden;
  else if (distant.length) pool = distant;
  else {
    const best = Math.max(...pool.map((s) => s.distance));
    pool = pool.filter((s) => s.distance >= best - 2);
  }
  const fresh = pool.filter((s) => !s.recent && s.age > 4);
  if (fresh.length) pool = fresh;
  else {
    const oldest = Math.max(...pool.map((s) => s.age));
    pool = pool.filter((s) => s.age === oldest);
  }
  const spot =
    pool[Math.min(pool.length - 1, Math.floor(random() * pool.length))];
  if (!spot) throw new Error(`No valid spawn points for ${player.team}`);
  room.spawnHistory.set(spot.key, now);
  player.recentSpawns = [...player.recentSpawns, spot.key].slice(-9);
  return spot;
}
