import { randomBytes } from "node:crypto";
import { blastDamage } from "./explosions.js";
import { beginAction, fireBarrier } from "./actions.js";
import {
  actionBlocksFire,
  actionState,
  GRENADE_THROW_SECONDS,
} from "../shared/actions.js";
import { chooseSpawn } from "./spawns.js";
import { BOT_NAMES, BOT_DIFFICULTIES } from "../shared/bots.js";
import { getBotNavigation } from "./bot-navigation.js";
import { resetBot, updateBot } from "./bots.js";
import { getMap, validMap, groundAt } from "../shared/maps.js";
import {
  WEAPONS,
  PRIMARIES,
  PISTOLS,
  GRENADES,
  isFirearm,
} from "../shared/weapons.js";
import { TEAM_IDS, TEAMS, emptyScores } from "../shared/teams.js";
import {
  TICK,
  MATCH_SECONDS,
  move,
  direction,
  eyeHeight,
  playerHeight,
  rayBox,
  wallDistance,
  emptyInput,
  clamp,
} from "../shared/game.js";
import {
  resetInventory,
  owned,
  equip,
  drop,
  pickup,
  nearestPickup,
} from "./inventory.js";

const nameOf = (v, max, label) => {
  if (typeof v !== "string" || v.length > max)
    throw Error(`Enter ${label} (1–${max} characters).`);
  v = v.replace(/[\x00-\x1f\x7f]/g, "").trim();
  if (!v) throw Error(`Enter ${label} (1–${max} characters).`);
  return v;
};
export class Game {
  constructor(
    emit,
    {
      duration = MATCH_SECONDS,
      now = () => performance.now() / 1000,
      random = Math.random,
      loadHandshake = true,
      countdown = 3,
      onMatch = () => {},
    } = {},
  ) {
    Object.assign(this, {
      emit,
      duration,
      now,
      random,
      loadHandshake,
      countdown,
      onMatch,
    });
    this.rooms = new Map();
    this.members = new Map();
  }
  roomOf(id) {
    return this.rooms.get(this.members.get(id));
  }
  player(id) {
    return this.roomOf(id)?.players.get(id);
  }
  lobby(r) {
    return {
      code: r.code,
      name: r.name,
      host: r.host,
      state: r.state,
      mapId: r.mapId,
      mode: r.mode,
      playerLimit: r.playerLimit,
      loadEpoch: r.loadEpoch,
      countdown: Math.max(0, (r.beginsAt || 0) - this.now()),
      notice: r.notice,
      players: [...r.players.values()].map((p) => ({
        id: p.id,
        name: p.name,
        bot: p.bot,
        difficulty: p.difficulty,
        team: p.team,
        primary: p.primary,
        secondary: p.secondary,
        ready: p.ready,
        loaded: p.loaded,
        ping: p.ping,
      })),
      scores: r.scores,
      results: r.results,
    };
  }
  broadcast(r) {
    this.emit(r.code, "room", this.lobby(r));
  }
  enter(id, name, code, options = {}) {
    if (this.members.has(id)) throw Error("Leave your current room first.");
    name = nameOf(name, 20, "a player name");
    let r;
    if (code !== undefined) {
      if (typeof code !== "string" || !/^[A-Z0-9]{6}$/.test(code.toUpperCase()))
        throw Error("Enter a six-character room code.");
      r = this.rooms.get(code.toUpperCase());
      if (!r) throw Error("Room not found. Check the code.");
      if (r.state !== "lobby") throw Error("This match has already started.");
      if (r.players.size >= r.playerLimit) throw Error("This room is full.");
    } else {
      if (this.rooms.size >= 1000) throw Error("The server is full.");
      const mapId = options.mapId ?? "coastline",
        limit = options.playerLimit ?? 10,
        mode = options.mode ?? "tdm";
      if (
        !validMap(mapId) ||
        mode !== "tdm" ||
        !Number.isInteger(limit) ||
        limit < 2 ||
        limit > 10
      )
        throw Error("Choose COASTLINE, Team Deathmatch and 2–10 players.");
      const roomName = nameOf(
        options.roomName || `${name}'s room`,
        40,
        "a room name",
      );
      do {
        code = randomBytes(3).toString("hex").toUpperCase();
      } while (this.rooms.has(code));
      r = {
        code,
        name: roomName,
        host: id,
        state: "lobby",
        mode,
        mapId,
        playerLimit: limit,
        players: new Map(),
        scores: emptyScores(),
        grenades: [],
        smokes: [],
        drops: [],
        results: null,
        notice: "",
      };
      this.rooms.set(code, r);
    }
    const soldiers = [...r.players.values()].filter(
        (p) => p.team === "soldiers",
      ).length,
      team = soldiers <= r.players.size - soldiers ? "soldiers" : "terrorists";
    r.players.set(id, {
      id,
      name,
      bot: false,
      difficulty: null,
      team,
      primary: TEAMS[team].primary,
      secondary: TEAMS[team].secondary,
      ready: false,
      loaded: false,
      kills: 0,
      deaths: 0,
      headshots: 0,
      damage: 0,
      ping: 0,
      input: emptyInput(),
      ack: 0,
      receivedSeq: 0,
      lastInput: 0,
      spawnId: 0,
    });
    this.members.set(id, r.code);
    return r;
  }
  choose(id, { team, primary, secondary, ready } = {}) {
    const r = this.roomOf(id),
      p = this.player(id);
    if (!r || r.state !== "lobby")
      throw Error("Choices can only change in the waiting room.");
    if (
      (team !== undefined && !TEAM_IDS.includes(team)) ||
      (primary !== undefined && !PRIMARIES.includes(primary)) ||
      (secondary !== undefined && !PISTOLS.includes(secondary)) ||
      (ready !== undefined && typeof ready !== "boolean")
    )
      throw Error("Invalid team or loadout.");
    if (team !== undefined) p.team = team;
    if (primary !== undefined) p.primary = primary;
    if (secondary !== undefined) p.secondary = secondary;
    p.ready = ready ?? false;
    this.broadcast(r);
  }
  botLobby(id) {
    const r = this.roomOf(id);
    if (!r || r.host !== id || this.player(id)?.bot || r.state !== "lobby")
      throw Error("Only the human host can manage bots in the waiting room.");
    return r;
  }
  addBot(id, { difficulty = "normal", team = "auto" } = {}) {
    const r = this.botLobby(id);
    if (
      typeof difficulty !== "string" ||
      !Object.hasOwn(BOT_DIFFICULTIES, difficulty) ||
      !["auto", ...TEAM_IDS].includes(team)
    )
      throw Error("Choose Easy, Normal or Hard and a valid team.");
    if (r.players.size >= r.playerLimit)
      throw Error("This room is full. Remove a bot to make space.");
    const used = new Set(
      [...r.players.values()].filter((p) => p.bot).map((p) => p.botIndex),
    );
    const index = BOT_NAMES.findIndex((_, i) => !used.has(i));
    if (index < 0)
      throw Error("At least one slot is reserved for a human player.");
    getBotNavigation(); // Cached at server startup; standalone Game users initialize in the lobby.
    const botId = `bot-${randomBytes(8).toString("hex")}`;
    this.enter(botId, `[BOT] ${BOT_NAMES[index]}`, r.code);
    const p = r.players.get(botId);
    if (team !== "auto") p.team = team;
    Object.assign(p, {
      bot: true,
      botIndex: index,
      difficulty,
      ready: true,
      loaded: true,
      primary: TEAMS[p.team].primary,
      secondary: TEAMS[p.team].secondary,
    });
    this.broadcast(r);
    return { id: botId };
  }
  configureBot(id, { botId, difficulty, team } = {}) {
    const r = this.botLobby(id),
      p = r.players.get(botId);
    if (!p?.bot) throw Error("Bot not found in this room.");
    if (
      (difficulty !== undefined &&
        (typeof difficulty !== "string" ||
          !Object.hasOwn(BOT_DIFFICULTIES, difficulty))) ||
      (team !== undefined && !TEAM_IDS.includes(team))
    )
      throw Error("Invalid bot settings.");
    if (difficulty !== undefined) p.difficulty = difficulty;
    if (team !== undefined) {
      p.team = team;
      p.primary = TEAMS[team].primary;
      p.secondary = TEAMS[team].secondary;
    }
    this.broadcast(r);
  }
  removeBot(id, { botId } = {}) {
    const r = this.botLobby(id);
    if (!r.players.get(botId)?.bot) throw Error("Bot not found in this room.");
    this.leave(botId);
  }
  configure(id, options = {}) {
    const r = this.roomOf(id);
    if (!r || r.host !== id || r.state !== "lobby")
      throw Error("Only the host can change settings before a match.");
    const limit = options.playerLimit ?? r.playerLimit;
    if (
      !validMap(options.mapId ?? r.mapId) ||
      !Number.isInteger(limit) ||
      limit < r.players.size ||
      limit < 2 ||
      limit > 10
    )
      throw Error("Invalid room settings.");
    r.playerLimit = limit;
    this.broadcast(r);
  }
  start(id) {
    const r = this.roomOf(id);
    if (!r || r.host !== id) throw Error("Only the host can start.");
    if (!["lobby", "results"].includes(r.state))
      throw Error("The match is already starting or running.");
    if (r.players.size < 2) throw Error("Invite a friend or add a bot.");
    if (r.state === "lobby" && [...r.players.values()].some((p) => !p.ready))
      throw Error("Every player must be ready.");
    const teams = () =>
      TEAM_IDS.map((t) => [...r.players.values()].filter((p) => p.team === t));
    let t = teams();
    while (Math.abs(t[0].length - t[1].length) > 1) {
      const big = t[0].length > t[1].length ? 0 : 1;
      const p = t[big].find((p) => p.bot) || t[big].at(-1);
      p.team = TEAM_IDS[1 - big];
      if (p.bot) {
        p.primary = TEAMS[p.team].primary;
        p.secondary = TEAMS[p.team].secondary;
      }
      t = teams();
    }
    r.results = null;
    r.notice = "";
    r.scores = emptyScores();
    r.grenades = [];
    r.smokes = [];
    r.drops = [];
    r.loadEpoch = randomBytes(6).toString("hex");
    r.state = "loading";
    r.loadingDeadline = this.now() + 120;
    for (const p of r.players.values()) {
      p.loaded = !!p.bot;
      p.kills = p.deaths = p.headshots = p.damage = 0;
    }
    if (!this.loadHandshake) {
      r.beginsAt = this.now();
      this.begin(r);
    } else this.broadcast(r);
  }
  loaded(id, epoch) {
    const r = this.roomOf(id),
      p = this.player(id);
    if (!r || r.state !== "loading" || epoch !== r.loadEpoch) return;
    p.loaded = true;
    if ([...r.players.values()].every((p) => p.loaded)) {
      r.state = "countdown";
      r.beginsAt = this.now() + this.countdown;
    }
    this.broadcast(r);
  }
  begin(r) {
    r.state = "playing";
    r.endsAt = this.now() + this.duration;
    r.matchId = randomBytes(8).toString("hex");
    for (const p of r.players.values()) this.spawn(r, p);
    this.broadcast(r);
    this.snapshot(r);
  }
  returnRoom(id) {
    const r = this.roomOf(id);
    if (!r || r.host !== id || r.state !== "results")
      throw Error("The host can return everyone after a match.");
    r.state = "lobby";
    r.drops = [];
    r.smokes = [];
    for (const p of r.players.values()) p.ready = !!p.bot;
    this.broadcast(r);
  }
  leave(id) {
    const r = this.roomOf(id);
    if (!r) return;
    const p = r.players.get(id);
    if (r.state === "playing" && p.hp > 0) drop(r, p, this.now());
    r.players.delete(id);
    this.members.delete(id);
    const humans = [...r.players.values()].filter((p) => !p.bot);
    if (!humans.length) {
      for (const bot of r.players.values()) this.members.delete(bot.id);
      r.players.clear();
      r.grenades = [];
      r.smokes = [];
      r.drops = [];
      this.rooms.delete(r.code);
      return;
    }
    if (r.host === id) r.host = humans[0].id;
    if (
      r.state === "playing" &&
      !TEAM_IDS.every((t) => [...r.players.values()].some((p) => p.team === t))
    )
      this.finish(r, "A team left the match.");
    if (["loading", "countdown"].includes(r.state)) {
      if (r.players.size < 2) {
        r.state = "lobby";
        r.notice = "Not enough players to start.";
        for (const p of r.players.values()) p.ready = !!p.bot;
      } else if (
        r.state === "loading" &&
        [...r.players.values()].every((p) => p.loaded)
      ) {
        r.state = "countdown";
        r.beginsAt = this.now() + this.countdown;
      }
    }
    this.broadcast(r);
  }
  spawn(r, p) {
    const spot = chooseSpawn(r, p, this.now(), this.random, (a, b) =>
      this.visible(a, b, r),
    );
    Object.assign(p, {
      x: spot.x,
      z: spot.z,
      y: spot.y,
      vx: 0,
      vy: 0,
      vz: 0,
      yaw: 0,
      pitch: 0,
      hp: 100,
      armor: 0,
      grounded: true,
      crouch: false,
      jumpHeld: false,
      nextFire: 0,
      shotCooldownUntil: 0,
      nextUse: 0,
      respawnAt: 0,
      protectedUntil: this.now() + 1.5,
      input: emptyInput(),
      wasShooting: false,
      lastInput: this.now(),
      action: "respawn",
      actionUntil: this.now() + 0.5,
      flashUntil: 0,
      flashStrength: 0,
      pendingShot: null,
    });
    resetInventory(p);
    p.spawnId++;
    if (p.bot) resetBot(p, this.now());
  }
  input(id, data) {
    const p = this.player(id),
      r = this.roomOf(id);
    if (
      !p ||
      r.state !== "playing" ||
      p.hp <= 0 ||
      !data ||
      !Number.isSafeInteger(data.seq) ||
      data.seq <= Math.max(p.ack, p.receivedSeq) ||
      data.seq > p.ack + 10000 ||
      data.spawnId !== p.spawnId ||
      !Number.isFinite(data.yaw) ||
      !Number.isFinite(data.pitch)
    )
      return;
    const input = emptyInput();
    for (const k of Object.keys(input))
      if (typeof input[k] === "boolean") input[k] = data[k] === true;
    input.yaw = data.yaw % (Math.PI * 2);
    input.pitch = clamp(data.pitch, -1.48, 1.48);
    input.shoot &&= data.fireEpoch === p.fireEpoch && data.weapon === p.weapon;
    p.input = input;
    p.receivedSeq = data.seq;
    p.lastInput = this.now();
  }
  action(id, type, value) {
    const p = this.player(id),
      r = this.roomOf(id),
      now = this.now();
    if (!p || r.state !== "playing" || p.hp <= 0) return false;
    if (type === "fire") {
      if (
        !value ||
        value.spawnId !== p.spawnId ||
        value.fireEpoch !== p.fireEpoch ||
        value.weapon !== p.weapon ||
        !Number.isSafeInteger(value.pressId) ||
        value.pressId <= (p.lastPressId || 0) ||
        !Number.isFinite(value.yaw) ||
        !Number.isFinite(value.pitch)
      )
        return false;
      p.lastPressId = value.pressId;
      if (actionBlocksFire(p, now) || now < p.nextFire) return false;
      p.fireArmed = true;
      p.pendingShot = {
        yaw: value.yaw % (Math.PI * 2),
        pitch: clamp(value.pitch, -1.48, 1.48),
        aim: value.aim === true,
        time: now,
        weapon: p.weapon,
        fireEpoch: p.fireEpoch,
      };
      return true;
    }
    if (p.action === "throw" && now < p.actionUntil) return false;
    if (type === "switch") {
      let target = value;
      if (value === "primary" || value === "secondary") target = p.slots[value];
      if (value === "previous") target = p.previousWeapon;
      if (value === "grenade") {
        const gs = GRENADES.filter((g) => p.grenades[g] > 0);
        target = gs[(gs.indexOf(p.weapon) + 1) % gs.length];
      }
      if (equip(p, target, now))
        this.emit(r.code, "fx", { type: "draw", id, weapon: target });
    }
    if (type === "cycle") {
      const list = owned(p),
        i = list.indexOf(p.weapon);
      equip(
        p,
        list[(i + (value < 0 ? -1 : 1) + list.length) % list.length],
        now,
      );
    }
    if (type === "drop") {
      const item = drop(r, p, now);
      if (item)
        this.emit(r.code, "fx", {
          type: "drop",
          id,
          weapon: item.weapon,
          origin: item,
        });
    }
    if (type === "pickup") {
      const canSee = (d) =>
        this.visible(
          { x: p.x, y: p.y + 1, z: p.z },
          { x: d.x, y: d.y + 0.2, z: d.z },
          r,
        );
      const item = nearestPickup(r, p, canSee);
      if (item && pickup(r, p, item.id, now, canSee))
        this.emit(id, "fx", { type: "pickup", id, weapon: item.weapon });
    }
    if (type === "reload" && isFirearm(p.weapon)) {
      const w = WEAPONS[p.weapon],
        a = p.ammo[p.weapon];
      if (
        !actionBlocksFire(p, now) &&
        !p.reloadAt &&
        a.mag < w.mag &&
        a.reserve > 0
      ) {
        p.reloadAt = now + w.reload;
        beginAction(p, "reload", now, w.reload);
        this.emit(r.code, "fx", { type: "reload", id, weapon: p.weapon });
      }
    }
    return true;
  }
  visible(a, b, r) {
    const v = { x: b.x - a.x, y: b.y - a.y, z: b.z - a.z },
      len = Math.hypot(v.x, v.y, v.z);
    return (
      wallDistance(
        a,
        { x: v.x / (len || 1), y: v.y / (len || 1), z: v.z / (len || 1) },
        getMap(r.mapId).boxes,
      ) >=
      len - 0.1
    );
  }
  throwGrenade(r, p) {
    const now = this.now(),
      kind = p.weapon;
    if (
      !GRENADES.includes(kind) ||
      !p.grenades[kind] ||
      now < p.nextUse ||
      now < p.nextFire ||
      actionBlocksFire(p, now)
    )
      return;
    p.grenades[kind]--;
    p.nextUse = now + 0.7;
    p.protectedUntil = 0;
    const d = direction(p.yaw, p.pitch);
    r.grenades.push({
      id: randomBytes(5).toString("hex"),
      kind,
      owner: p.id,
      team: p.team,
      ownerName: p.name,
      x: p.x,
      y: p.y + eyeHeight(p),
      z: p.z,
      vx: d.x * 13,
      vy: d.y * 13 + 4,
      vz: d.z * 13,
      explodeAt: now + (kind === "he" ? 2 : kind === "flash" ? 1.7 : 2.3),
    });
    beginAction(p, "throw", now, GRENADE_THROW_SECONDS);
    this.emit(r.code, "fx", { type: "throw", id: p.id, weapon: kind });
  }
  damage(r, target, amount, shooter, weapon, headshot = false) {
    if (
      !Number.isFinite(amount) ||
      amount <= 0 ||
      target.hp <= 0 ||
      target.protectedUntil > this.now() ||
      (target.team === shooter.team && target.id !== shooter.id)
    )
      return;
    const taken = Math.min(target.hp, Math.round(amount));
    if (!taken) return;
    target.hp -= taken;
    if (target.id !== shooter.id)
      shooter.damage = (shooter.damage || 0) + taken;
    this.emit(target.id, "hurt", { hp: target.hp, headshot });
    if (target.id !== shooter.id)
      this.emit(shooter.id, "hit", {
        headshot,
        killed: target.hp === 0,
        weapon,
      });
    if (!target.hp) {
      target.deaths++;
      target.respawnAt = this.now() + 3;
      target.reloadAt = 0;
      target.input = emptyInput();
      fireBarrier(target);
      target.returnWeapon = null;
      target.action = "death";
      target.actionUntil = target.respawnAt;
      drop(r, target, this.now(), { death: true });
      if (target.id !== shooter.id) {
        shooter.kills = (shooter.kills || 0) + 1;
        if (headshot) shooter.headshots = (shooter.headshots || 0) + 1;
        r.scores[shooter.team]++;
      }
      this.emit(r.code, "fx", {
        type: "kill",
        killer: shooter.name,
        victim: target.name,
        weapon,
        headshot,
        id: target.id,
        team: shooter.team,
      });
    }
  }
  fire(r, p) {
    if (actionBlocksFire(p, this.now())) return;
    if (GRENADES.includes(p.weapon)) {
      this.throwGrenade(r, p);
      return;
    }
    const now = this.now(),
      w = WEAPONS[p.weapon],
      ammo = p.ammo[p.weapon];
    if (!w || now < p.nextFire || p.reloadAt) return;
    if (!ammo?.mag && p.weapon !== "knife") {
      p.nextFire = now + 0.3;
      this.emit(p.id, "fx", { type: "empty", id: p.id });
      return;
    }
    p.nextFire = now + w.interval;
    p.shotCooldownUntil = p.nextFire;
    p.protectedUntil = 0;
    if (p.weapon !== "knife") ammo.mag--;
    p.action = p.weapon === "knife" ? "slash" : "shoot";
    p.actionUntil = now + (p.weapon === "knife" ? 0.32 : 0.13);
    const origin = { x: p.x, y: p.y + eyeHeight(p), z: p.z },
      ends = [],
      solids = getMap(r.mapId).boxes;
    for (let i = 0; i < (w.pellets || 1); i++) {
      const spread =
          w.spread *
          (p.input.aim ? (w.type === "SNIPER" ? 0.025 : 0.55) : 1) *
          (Math.hypot(p.vx, p.vz) > 1 ? w.movementSpread : 1) *
          (p.grounded ? 1 : 3),
        d = direction(
          p.yaw + (this.random() - 0.5) * spread * 2,
          p.pitch + (this.random() - 0.5) * spread * 2,
        ),
        wall = wallDistance(origin, d, solids);
      let distance = Math.min(w.range, wall),
        hit = null,
        head = false;
      for (const t of r.players.values()) {
        if (t === p || t.hp <= 0 || t.team === p.team || t.protectedUntil > now)
          continue;
        const h = playerHeight(t),
          hd = rayBox(origin, d, {
            x: t.x,
            y: t.y + h - 0.23,
            z: t.z,
            w: 0.5,
            h: 0.46,
            d: 0.5,
          }),
          bd = rayBox(origin, d, {
            x: t.x,
            y: t.y + (h - 0.46) / 2,
            z: t.z,
            w: 0.62,
            h: h - 0.46,
            d: 0.62,
          }),
          td = Math.min(hd, bd);
        if (td < distance) {
          distance = td;
          hit = t;
          head = hd <= bd;
        }
      }
      if (hit)
        this.damage(
          r,
          hit,
          w.damage * (head ? w.headshot : 1),
          p,
          p.weapon,
          head,
        );
      const end = {
        x: origin.x + d.x * distance,
        y: origin.y + d.y * distance,
        z: origin.z + d.z * distance,
        hit: !!hit,
      };
      if (!hit && wall <= w.range) {
        end.normal = { x: 0, y: 1, z: 0 };
        const b = solids.find(
          (b) => Math.abs(rayBox(origin, d, b) - wall) < 0.001,
        );
        if (b) {
          let min = Infinity;
          for (const [a, s] of [
            ["x", "w"],
            ["y", "h"],
            ["z", "d"],
          ])
            for (const sign of [-1, 1]) {
              const delta = Math.abs(end[a] - b[a] - (sign * b[s]) / 2);
              if (delta < min) {
                min = delta;
                end.normal = { x: 0, y: 0, z: 0, [a]: sign };
              }
            }
        }
      }
      ends.push(end);
    }
    this.emit(r.code, "fx", {
      type: "shot",
      id: p.id,
      weapon: p.weapon,
      origin,
      ends,
    });
  }
  detonate(r, g) {
    const now = this.now(),
      owner = r.players.get(g.owner) || {
        id: g.owner,
        team: g.team,
        name: g.ownerName,
      };
    if (g.kind === "smoke") {
      r.smokes.push({
        id: g.id,
        x: g.x,
        y: g.y,
        z: g.z,
        start: now,
        end: now + 15,
        radius: 4.6,
      });
      this.emit(r.code, "fx", { type: "smoke", ...g });
      return;
    }
    for (const p of r.players.values()) {
      if (p.hp <= 0) continue;
      if (g.kind === "he") {
        this.damage(
          r,
          p,
          blastDamage(g, p, (a, b) => this.visible(a, b, r)),
          owner,
          "he",
        );
        continue;
      }
      const eye = { x: p.x, y: p.y + eyeHeight(p), z: p.z },
        delta = { x: g.x - eye.x, y: g.y - eye.y, z: g.z - eye.z },
        distance = Math.hypot(delta.x, delta.y, delta.z);
      if (p.hp <= 0 || !this.visible(g, eye, r)) continue;
      if (g.kind === "flash" && distance < 20) {
        const look = direction(p.yaw, p.pitch),
          facing =
            (look.x * delta.x + look.y * delta.y + look.z * delta.z) /
            (distance || 1),
          strength =
            (1 - distance / 20) * (facing > 0.4 ? 1 : facing > 0 ? 0.65 : 0.25);
        p.flashUntil = Math.max(p.flashUntil, now + strength * 4);
        p.flashStrength = Math.max(p.flashStrength, strength);
        this.emit(p.id, "flash", { duration: strength * 4, strength });
      }
    }
    this.emit(r.code, "fx", {
      type: g.kind === "flash" ? "flashbang" : "explosion",
      x: g.x,
      y: g.y,
      z: g.z,
    });
  }
  tick() {
    const now = this.now();
    for (const r of this.rooms.values()) {
      if (r.state === "loading" && now > r.loadingDeadline) {
        r.state = "lobby";
        r.notice =
          "Loading timed out. Check your connection and ready up again.";
        for (const p of r.players.values()) p.ready = !!p.bot;
        this.broadcast(r);
      }
      if (r.state === "countdown" && now >= r.beginsAt) this.begin(r);
      if (r.state !== "playing") continue;
      if (now >= r.endsAt) {
        this.finish(r);
        continue;
      }
      for (const p of r.players.values()) {
        if (p.hp <= 0) {
          if (now >= p.respawnAt) this.spawn(r, p);
          continue;
        }
        if (p.bot) updateBot(this, r, p, now);
        if (now - p.lastInput > 0.25)
          p.input = { ...emptyInput(), yaw: p.yaw, pitch: p.pitch };
        move(p, p.input, TICK, getMap(r.mapId).boxes);
        p.ack = p.receivedSeq;
        if (p.action === "throw" && now >= p.actionUntil) {
          const target = owned(p).includes(p.returnWeapon)
            ? p.returnWeapon
            : p.slots.primary || p.slots.secondary || "knife";
          equip(p, target, now);
          p.returnWeapon = null;
          this.emit(r.code, "fx", { type: "draw", id: p.id, weapon: target });
        }
        if (p.reloadAt && now >= p.reloadAt) {
          const a = p.ammo[p.weapon];
          if (a) {
            const n = Math.min(WEAPONS[p.weapon].mag - a.mag, a.reserve);
            a.mag += n;
            a.reserve -= n;
          }
          p.reloadAt = 0;
          fireBarrier(p);
          p.action = "idle";
        }
        const press = p.pendingShot;
        p.pendingShot = null;
        if (
          press &&
          now - press.time < 0.2 &&
          press.weapon === p.weapon &&
          press.fireEpoch === p.fireEpoch
        ) {
          const { yaw, pitch } = p,
            aim = p.input.aim;
          p.yaw = press.yaw;
          p.pitch = press.pitch;
          p.input.aim = press.aim;
          this.fire(r, p);
          p.yaw = yaw;
          p.pitch = pitch;
          p.input.aim = aim;
        } else if (p.fireArmed && p.input.shoot && WEAPONS[p.weapon].auto)
          this.fire(r, p);
        p.wasShooting = p.input.shoot;
      }
      for (const g of r.grenades) {
        g.vy -= 16 * TICK;
        let impact = 0;
        for (const a of ["x", "y", "z"]) {
          const old = g[a];
          g[a] += g["v" + a] * TICK;
          if (
            getMap(r.mapId).boxes.some(
              (b) =>
                Math.abs(g.x - b.x) < b.w / 2 + 0.1 &&
                Math.abs(g.y - b.y) < b.h / 2 + 0.1 &&
                Math.abs(g.z - b.z) < b.d / 2 + 0.1,
            )
          ) {
            g[a] = old;
            impact = Math.max(impact, Math.abs(g["v" + a]));
            if (a === "y" && g.vy < 0) {
              g.vx *= 0.84;
              g.vz *= 0.84;
            }
            g["v" + a] *= -0.5;
          }
        }
        const floor = groundAt(g.x, g.z) + 0.12;
        if (g.y < floor) {
          g.y = floor;
          impact = Math.max(impact, Math.abs(g.vy));
          g.vy = Math.abs(g.vy) * 0.35;
          g.vx *= 0.94;
          g.vz *= 0.94;
        }
        if (impact > 1.6 && now > (g.bounceAt || 0)) {
          this.emit(r.code, "fx", {
            type: "grenadeBounce",
            x: g.x,
            y: g.y,
            z: g.z,
          });
          g.bounceAt = now + 0.12;
        }
        if (now >= g.explodeAt) this.detonate(r, g);
      }
      r.grenades = r.grenades.filter((g) => g.explodeAt > now);
      r.smokes = r.smokes.filter((s) => s.end > now);
      for (const item of r.drops) {
        const floor = Math.max(
          groundAt(item.x, item.z),
          ...getMap(r.mapId)
            .boxes.filter(
              (b) =>
                Math.abs(item.x - b.x) < b.w / 2 &&
                Math.abs(item.z - b.z) < b.d / 2 &&
                b.y + b.h / 2 <= item.y + 0.01,
            )
            .map((b) => b.y + b.h / 2),
        );
        item.vy = (item.vy || 0) - 16 * TICK;
        item.y = Math.max(floor + 0.08, item.y + item.vy * TICK);
        if (item.y <= floor + 0.081) item.vy = 0;
      }
      r.drops = r.drops.filter((d) => d.expiresAt > now);
    }
  }
  snapshot(r) {
    const now = this.now();
    this.emit(r.code, "state", {
      time: now,
      remaining: Math.max(0, r.endsAt - now),
      scores: r.scores,
      grenades: r.grenades.map(({ id, kind, x, y, z }) => ({
        id,
        kind,
        x,
        y,
        z,
      })),
      smokes: r.smokes.map((s) => ({
        ...s,
        age: now - s.start,
        remaining: s.end - now,
      })),
      drops: r.drops.map(({ expiresAt, vy, ...d }) => d),
      players: [...r.players.values()].map((p) => ({
        id: p.id,
        name: p.name,
        bot: p.bot,
        difficulty: p.difficulty,
        team: p.team,
        x: p.x,
        y: p.y,
        z: p.z,
        vx: p.vx,
        vy: p.vy,
        vz: p.vz,
        yaw: p.yaw,
        pitch: p.pitch,
        crouch: p.crouch,
        grounded: p.grounded,
        jumpHeld: p.jumpHeld,
        hp: p.hp,
        armor: p.armor,
        weapon: p.weapon,
        primary: p.primary,
        secondary: p.secondary,
        slots: p.slots,
        grenades: p.grenades,
        ammo: p.ammo[p.weapon] || {
          mag: p.grenades[p.weapon] || 0,
          reserve: 0,
        },
        reload: Math.max(0, p.reloadAt - now),
        respawn: Math.max(0, p.respawnAt - now),
        protected: p.protectedUntil > now,
        kills: p.kills,
        deaths: p.deaths,
        headshots: p.headshots,
        damage: p.damage,
        ping: p.ping,
        ack: p.ack,
        spawnId: p.spawnId,
        fireEpoch: p.fireEpoch,
        actionState: actionState(p, now),
        action: now < p.actionUntil ? p.action : "idle",
        actionTime: Math.max(0, p.actionUntil - now),
      })),
    });
  }
  finish(r, reason = "Time is up.") {
    if (r.state !== "playing") return;
    r.state = "results";
    r.grenades = [];
    r.smokes = [];
    r.results = {
      id: r.matchId,
      mapId: r.mapId,
      endedAt: new Date().toISOString(),
      winner:
        r.scores.soldiers === r.scores.terrorists
          ? "draw"
          : r.scores.soldiers > r.scores.terrorists
            ? "soldiers"
            : "terrorists",
      reason,
      scores: { ...r.scores },
      players: [...r.players.values()]
        .map((p) => ({
          id: p.id,
          name: p.name,
          bot: p.bot,
          difficulty: p.difficulty,
          team: p.team,
          kills: p.kills,
          deaths: p.deaths,
          headshots: p.headshots,
          damage: p.damage,
          ping: p.ping,
          score: p.kills * 100,
          kd: p.deaths ? p.kills / p.deaths : p.kills,
        }))
        .sort((a, b) => b.score - a.score),
    };
    this.onMatch(r.results);
    this.broadcast(r);
  }
}
