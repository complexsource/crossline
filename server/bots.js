import { BOT_DIFFICULTIES } from "../shared/bots.js";
import {
  TICK,
  direction,
  eyeHeight,
  emptyInput,
  clamp,
  collisionCandidates,
} from "../shared/game.js";
import { groundAt } from "../shared/maps.js";
import { WEAPONS, GRENADES, isFirearm } from "../shared/weapons.js";
import { actionBlocksFire } from "../shared/actions.js";
import { getBotNavigation } from "./bot-navigation.js";

const angle = (value) => Math.atan2(Math.sin(value), Math.cos(value));
const eye = (p) => ({ x: p.x, y: p.y + eyeHeight(p), z: p.z });
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
function smokeBlocks(room, a, b, now) {
  const dx = b.x - a.x,
    dy = b.y - a.y,
    dz = b.z - a.z,
    length = Math.hypot(dx, dy, dz);
  if (!length) return false;
  for (const s of room.smokes) {
    if (now - s.start < 0.3 || s.end - now < 0.4) continue;
    const center = { x: s.x, y: s.y + 0.8, z: s.z },
      r = s.radius * 0.85;
    const ox = a.x - center.x,
      oy = a.y - center.y,
      oz = a.z - center.z;
    const along = -(ox * dx + oy * dy + oz * dz) / length;
    const perpendicular = ox * ox + oy * oy + oz * oz - along * along;
    if (perpendicular >= r * r) continue;
    const half = Math.sqrt(r * r - perpendicular);
    if (Math.min(length, along + half) - Math.max(0, along - half) > 0.65)
      return true;
  }
  return false;
}
export function canSeeEnemy(game, room, p, enemy, now = game.now()) {
  const config = BOT_DIFFICULTIES[p.difficulty];
  if (
    !config ||
    enemy === p ||
    enemy.team === p.team ||
    enemy.hp <= 0 ||
    (p.flashUntil > now && p.flashStrength > 0.2)
  )
    return false;
  const a = eye(p),
    b = eye(enemy),
    dist = distance(a, b);
  if (dist > config.range) return false;
  const yaw = Math.atan2(p.x - enemy.x, p.z - enemy.z);
  if (Math.abs(angle(yaw - p.yaw)) > (config.fov * Math.PI) / 360) return false;
  return !smokeBlocks(room, a, b, now) && game.visible(a, b, room);
}
export function resetBot(p, now) {
  p.botState = {
    nextThink: now + (p.botIndex % 8) * 0.013,
    nextPath: 0,
    path: [],
    goal: null,
    patrolIndex: (p.botIndex * 3 + p.spawnId) % 9,
    target: null,
    memory: null,
    reactAt: Infinity,
    burstUntil: 0,
    nextBurst: 0,
    nextError: 0,
    errorYaw: 0,
    errorPitch: 0,
    nextCover: 0,
    coverUntil: 0,
    nextGrenade: now + 7 + (p.botIndex % 4),
    grenade: null,
    checkAt: now + 1,
    lastPosition: { x: p.x, y: p.y, z: p.z },
    stuck: 0,
    jumpUntil: 0,
    decisions: 0,
    paths: 0,
  };
}
function route(ai, p, goal, now, nav) {
  if (now < ai.nextPath) return;
  ai.nextPath = now + 0.9;
  ai.path = nav.path(p, goal);
  ai.paths++;
  ai.goal = { x: goal.x, y: goal.y, z: goal.z };
}
function decide(game, room, p, now, config) {
  const ai = p.botState,
    nav = getBotNavigation();
  ai.decisions++;
  ai.nextThink = now + config.think;
  let target = null,
    best = Infinity;
  for (const enemy of room.players.values())
    if (canSeeEnemy(game, room, p, enemy, now)) {
      const score = distance(p, enemy) * (ai.target?.id === enemy.id ? 0.7 : 1);
      if (score < best) {
        target = enemy;
        best = score;
      }
    }
  if (target) {
    if (ai.target?.id !== target.id)
      ai.reactAt = now + config.reaction * (0.85 + game.random() * 0.3);
    ai.target = {
      id: target.id,
      x: target.x,
      y: target.y,
      z: target.z,
      vx: target.vx,
      vz: target.vz,
      crouch: target.crouch,
      seenAt: now,
    };
    ai.memory = { ...ai.target };
  } else {
    ai.target = null;
    if (ai.memory && now - ai.memory.seenAt > 2.5) ai.memory = null;
  }
  if (now >= ai.nextError) {
    ai.nextError = now + 0.32;
    ai.errorYaw = (game.random() * 2 - 1) * config.error;
    ai.errorPitch = (game.random() * 2 - 1) * config.error * 0.6;
  }
  const ammo = p.ammo[p.weapon],
    lowAmmo = ammo && ammo.mag < WEAPONS[p.weapon].mag * 0.25;
  if (
    config.cover &&
    ai.target &&
    (p.hp < 55 || p.reloadAt || lowAmmo) &&
    now >= ai.nextCover
  ) {
    ai.nextCover = now + 2.5;
    const cover = nav.cover(p, eye(ai.target), (a, b) =>
      game.visible(a, b, room),
    );
    if (cover) {
      ai.coverUntil = now + 3;
      route(ai, p, cover, now, nav);
    }
  }
  if (ai.coverUntil > now) return;
  if (ai.target) {
    const d = distance(p, ai.target);
    if (d > (p.weapon === "knife" ? 1.3 : config.range * 0.6))
      route(ai, p, ai.target, now, nav);
    else {
      ai.path = [];
      ai.goal = null;
    }
    return;
  }
  if (ai.memory) {
    route(ai, p, ai.memory, now, nav);
    return;
  }
  if (config.cover) {
    const leader = [...room.players.values()].find(
      (friend) =>
        friend.id !== p.id &&
        friend.team === p.team &&
        friend.hp > 0 &&
        Math.hypot(friend.vx, friend.vz) > 1 &&
        distance(p, friend) > 6 &&
        distance(p, friend) < 18,
    );
    if (leader) {
      route(ai, p, leader, now, nav);
      return;
    }
  }
  if (!ai.path.length || !ai.goal || distance(p, ai.goal) < 1.2) {
    const goal = nav.patrol[ai.patrolIndex++ % nav.patrol.length];
    if (goal) route(ai, p, goal, now, nav);
  }
}
// Bounded local trajectory preview. Actual projectiles still use Game's
// collision/fuse/damage code; the preview never damages or moves a player.
function landing(p, yaw, pitch, kind) {
  const d = direction(yaw, pitch),
    g = { ...eye(p), vx: d.x * 13, vy: d.y * 13 + 4, vz: d.z * 13 };
  const ticks = Math.ceil(
    (kind === "he" ? 2 : kind === "flash" ? 1.7 : 2.3) / TICK,
  );
  for (let i = 0; i < ticks; i++) {
    g.vy -= 16 * TICK;
    for (const axis of ["x", "y", "z"]) {
      const old = g[axis];
      g[axis] += g["v" + axis] * TICK;
      if (
        collisionCandidates(g.x, g.z).some(
          (b) =>
            Math.abs(g.x - b.x) < b.w / 2 + 0.1 &&
            Math.abs(g.y - b.y) < b.h / 2 + 0.1 &&
            Math.abs(g.z - b.z) < b.d / 2 + 0.1,
        )
      ) {
        g[axis] = old;
        if (axis === "y" && g.vy < 0) {
          g.vx *= 0.84;
          g.vz *= 0.84;
        }
        g["v" + axis] *= -0.5;
      }
    }
    const floor = groundAt(g.x, g.z) + 0.12;
    if (g.y < floor) {
      g.y = floor;
      g.vy = Math.abs(g.vy) * 0.35;
      g.vx *= 0.94;
      g.vz *= 0.94;
    }
  }
  return g;
}
export function planBotGrenade(game, room, p, now = game.now()) {
  const ai = p.botState,
    target = ai?.target;
  if (
    !BOT_DIFFICULTIES[p.difficulty]?.grenades ||
    !target ||
    now < ai.nextGrenade ||
    actionBlocksFire(p, now) ||
    room.grenades.length >= 3 ||
    p.flashUntil > now
  )
    return null;
  ai.nextGrenade = now + 3; // Failed tactical searches are also rate limited.
  const dist = distance(p, target);
  if (dist < 9 || dist > 24 || now < ai.reactAt) return null;
  const kind =
    p.hp < 45 && p.grenades.smoke > 0 && room.smokes.length < 3
      ? "smoke"
      : p.grenades.he > 0
        ? "he"
        : p.grenades.flash > 0
          ? "flash"
          : null;
  if (!kind) return null;
  const goal =
    kind === "smoke"
      ? {
          x: p.x + (target.x - p.x) * 0.5,
          y: p.y,
          z: p.z + (target.z - p.z) * 0.5,
        }
      : target;
  const yaw = Math.atan2(p.x - goal.x, p.z - goal.z);
  let best = null,
    score = Infinity;
  for (const pitch of [-0.12, 0.08, 0.28, 0.48, 0.68]) {
    const end = landing(p, yaw, pitch, kind),
      error = Math.hypot(end.x - goal.x, end.z - goal.z, end.y - goal.y - 0.8);
    if (error > 4 || error >= score) continue;
    if (kind !== "smoke" && !game.visible(end, eye(target), room)) continue;
    if (
      kind !== "smoke" &&
      [...room.players.values()].some(
        (friend) =>
          friend.team === p.team &&
          friend.hp > 0 &&
          distance(friend, end) < (kind === "flash" ? 9 : 6),
      )
    )
      continue;
    if (kind === "smoke" && distance(p, end) < 3) continue;
    score = error;
    best = { kind, yaw, pitch, expires: now + 1.5 };
  }
  return best;
}
function press(game, p, input) {
  return game.action(p.id, "fire", {
    pressId: (p.lastPressId || 0) + 1,
    spawnId: p.spawnId,
    fireEpoch: p.fireEpoch,
    weapon: p.weapon,
    yaw: input.yaw,
    pitch: input.pitch,
    aim: input.aim,
  });
}
export function updateBot(game, room, p, now) {
  const config = BOT_DIFFICULTIES[p.difficulty];
  if (!config || p.hp <= 0) return;
  if (!p.botState) resetBot(p, now);
  const ai = p.botState;
  if (!ai.bought && game.now() + 0.1 < p.buyUntil) {
    // Default team kit is always usable. Re-equip the previous chosen kit on
    // respawn through the same authoritative buy validation as human players.
    try {
      game.buy(p.id, {
        itemId: p.previousLoadout ? "previous" : p.primary,
        spawnId: p.spawnId,
        epoch: room.loadEpoch,
      });
    } catch (error) {
      // An expired window after a server stall is a normal rejected purchase.
      if (game.now() < p.buyUntil) throw error;
    }
    ai.bought = true;
  }
  if (game.opening(room)) {
    game.input(p.id, {
      ...emptyInput(),
      yaw: p.yaw,
      pitch: p.pitch,
      seq: Math.max(p.receivedSeq, p.ack) + 1,
      spawnId: p.spawnId,
      fireEpoch: p.fireEpoch,
      weapon: p.weapon,
    });
    return;
  }
  if (now >= ai.nextThink) decide(game, room, p, now, config);
  const input = emptyInput();
  let wantedYaw = p.yaw,
    wantedPitch = 0;
  while (
    ai.path.length &&
    Math.hypot(ai.path[0].x - p.x, ai.path[0].z - p.z) < 0.43 &&
    Math.abs(ai.path[0].y - p.y) < 0.35
  )
    ai.path.shift();
  const waypoint = ai.path[0];
  if (ai.target) {
    const age = Math.min(0.15, now - ai.target.seenAt),
      dx = ai.target.x + ai.target.vx * age - p.x,
      dz = ai.target.z + ai.target.vz * age - p.z;
    wantedYaw = Math.atan2(-dx, -dz) + ai.errorYaw;
    wantedPitch =
      Math.atan2(
        ai.target.y + (ai.target.crouch ? 0.9 : 1.15) - eye(p).y,
        Math.hypot(dx, dz),
      ) + ai.errorPitch;
  } else if (waypoint)
    wantedYaw = Math.atan2(p.x - waypoint.x, p.z - waypoint.z);
  else wantedYaw = p.yaw + 0.3 * TICK;
  if (!ai.grenade) {
    const plan = planBotGrenade(game, room, p, now);
    if (plan) {
      ai.grenade = plan;
      ai.nextGrenade = now + 12;
      game.action(p.id, "switch", plan.kind);
    }
  }
  if (ai.grenade) {
    if (ai.grenade.expires < now || !p.grenades[ai.grenade.kind])
      ai.grenade = null;
    else {
      wantedYaw = ai.grenade.yaw;
      wantedPitch = ai.grenade.pitch;
    }
  }
  input.yaw =
    p.yaw +
    clamp(angle(wantedYaw - p.yaw), -config.turn * TICK, config.turn * TICK);
  input.pitch =
    p.pitch +
    clamp(wantedPitch - p.pitch, -config.turn * TICK, config.turn * TICK);
  const blinded = p.flashUntil > now && p.flashStrength > 0.2;
  if (waypoint && !ai.grenade) {
    const dx = waypoint.x - p.x,
      dz = waypoint.z - p.z,
      len = Math.hypot(dx, dz) || 1;
    const forward =
      (-Math.sin(input.yaw) * dx - Math.cos(input.yaw) * dz) / len;
    const right = (Math.cos(input.yaw) * dx - Math.sin(input.yaw) * dz) / len;
    input.forward = forward > 0.38;
    input.back = forward < -0.38;
    input.right = right > 0.38;
    input.left = right < -0.38;
    input.crouch = !!waypoint.crouch;
    input.run = !ai.target && !input.crouch && !p.reloadAt;
  } else if (ai.coverUntil > now) input.crouch = true;
  if (now >= ai.checkAt) {
    const travel = distance(p, ai.lastPosition);
    ai.stuck = waypoint && travel < 0.18 ? ai.stuck + 1 : 0;
    ai.checkAt = now + 0.8;
    ai.lastPosition = { x: p.x, y: p.y, z: p.z };
    if (ai.stuck) {
      ai.jumpUntil = now + 0.04;
      ai.nextPath = now;
      if (ai.stuck >= 3) {
        ai.path = [];
        ai.goal = null;
        ai.memory = null;
        ai.coverUntil = 0;
      } else if (ai.goal) route(ai, p, ai.goal, now, getBotNavigation());
    }
  }
  input.jump = ai.jumpUntil > now && !input.crouch && !ai.grenade;
  if (isFirearm(p.weapon) && !actionBlocksFire(p, now)) {
    const ammo = p.ammo[p.weapon],
      w = WEAPONS[p.weapon];
    if (ammo && ammo.mag === 0 && ammo.reserve === 0) {
      const backup = [p.slots.primary, p.slots.secondary].find(
        (id) =>
          id &&
          id !== p.weapon &&
          (p.ammo[id]?.mag > 0 || p.ammo[id]?.reserve > 0),
      );
      game.action(p.id, "switch", backup || "knife");
    } else if (
      ammo &&
      ammo.reserve > 0 &&
      (ammo.mag === 0 || (!ai.target && ammo.mag < w.mag * 0.5))
    )
      game.action(p.id, "reload");
  }
  if (GRENADES.includes(p.weapon)) {
    // Recheck at release: several bots may have planned while slots were free.
    const effectSlot =
      room.grenades.length < 3 &&
      (p.weapon !== "smoke" ||
        room.smokes.length +
          room.grenades.filter((g) => g.kind === "smoke").length <
          3);
    if (
      ai.grenade &&
      effectSlot &&
      !blinded &&
      !actionBlocksFire(p, now) &&
      Math.abs(angle(input.yaw - wantedYaw)) < 0.08 &&
      Math.abs(input.pitch - wantedPitch) < 0.08
    )
      press(game, p, input);
    else if (!ai.grenade && p.action !== "throw")
      game.action(
        p.id,
        "switch",
        p.returnWeapon || p.slots.primary || p.slots.secondary || "knife",
      );
  } else if (
    ai.target &&
    !blinded &&
    now >= ai.reactAt &&
    !actionBlocksFire(p, now) &&
    Math.abs(angle(input.yaw - wantedYaw)) < 0.12 &&
    Math.abs(input.pitch - wantedPitch) < 0.12
  ) {
    const w = WEAPONS[p.weapon];
    input.aim = p.weapon !== "knife";
    input.run = false;
    if (now >= ai.nextBurst && now >= ai.burstUntil) {
      ai.burstUntil = now + config.burst;
      ai.nextBurst = ai.burstUntil + config.pause;
    }
    if (
      now < ai.burstUntil &&
      (p.weapon !== "knife" || distance(p, ai.target) < 2.1)
    ) {
      if ((!p.fireArmed || !w.auto) && now >= p.nextFire) press(game, p, input);
      input.shoot = !!p.fireArmed;
    }
  }
  game.input(p.id, {
    ...input,
    seq: Math.max(p.receivedSeq, p.ack) + 1,
    spawnId: p.spawnId,
    fireEpoch: p.fireEpoch,
    weapon: p.weapon,
  });
}
