import { io } from "socket.io-client";
import { FireButton, actionBlocksFire } from "../shared/actions.js";
import { COASTLINE, getMap, areaAt, surfaceAt } from "../shared/maps.js";
import { TEAMS, TEAM_IDS } from "../shared/teams.js";
import {
  WEAPONS,
  PRIMARIES,
  PISTOLS,
  GRENADES,
  TICK,
  move,
  emptyInput,
  isFirearm,
  wallDistance,
} from "../shared/game.js";
import {
  settings,
  saveSettings,
  showSettings,
  keyLabel,
  crossStyle,
  crossMarkup,
} from "./settings.js";
import { Sound } from "./audio.js";
import { openDialog } from "./dialog.js";
import "./style.css";

const app = document.querySelector("#app"),
  canvas = document.querySelector("#game"),
  $ = (s) => document.querySelector(s);
const esc = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const sound = new Sound(settings),
  socket = io({ reconnectionAttempts: 5, timeout: 8000 });
const fireButton = new FireButton();
let pressId = 0,
  predictedActionUntil = 0;
let room = null,
  snapshot = null,
  local = null,
  graphics = null,
  assetPromise = null,
  loadingEpoch = null,
  loadProgress = 0,
  loadText = "",
  countdownUntil = 0,
  lastCountdown = 0;
let playing = false,
  locked = false,
  scoreboard = false,
  resultsDismissed = false,
  name = "",
  page = "home",
  seq = 0,
  pending = [],
  input = emptyInput(),
  correction = { x: 0, y: 0, z: 0 };
let feed = [],
  chat = [],
  hitUntil = 0,
  hurtUntil = 0,
  flashUntil = 0,
  flashDuration = 1,
  flashStrength = 0,
  confirmationUntil = 0,
  latency = 0,
  fps = 60,
  last = performance.now(),
  accumulator = 0,
  hudAt = 0,
  fxAt = 0,
  stepAt = 0,
  wasFiring = false,
  renderAt = 0;
try {
  name = localStorage.getItem("crossline-name") || "";
} catch {}
const invite = new URLSearchParams(location.search).get("room") || "";
const logo =
  '<a class="brand" href="/" aria-label="Crossline home"><span class="brand-symbol">╱╱</span>CROSSLINE<small title="Version 2">V2</small></a>';
function toast(message) {
  let el = $("#toast");
  if (!el) {
    el = document.createElement("div");
    el.id = "toast";
    el.setAttribute("role", "status");
    document.body.append(el);
  }
  el.textContent = message;
  el.classList.add("show");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => el.classList.remove("show"), 4200);
}
function call(event, data = {}) {
  return new Promise((resolve) =>
    socket.timeout(6000).emit(event, data, (error, result) => {
      if (error || !result?.ok) {
        toast(
          error
            ? "Connection timed out. Please try again."
            : result?.error || "Unable to complete that action.",
        );
        resolve(null);
      } else resolve(result);
    }),
  );
}
const k = (action) => keyLabel(settings.bindings[action]);
function chrome(content) {
  canvas.classList.remove("active");
  return `<div class="shell"><header>${logo}<div class="online"><i class="${socket.connected ? "" : "offline"}"></i>${socket.connected ? "SERVER ONLINE" : "CONNECTING…"}</div></header>${content}<footer><span>COASTLINE <b>OPERATIONS / 02</b></span><span>DESKTOP · KEYBOARD + MOUSE</span><span>TEAM DEATHMATCH <b>2–10 PLAYERS</b></span></footer></div>`;
}
function leaveVisuals() {
  playing = false;
  sound.setPlaying(false);
  graphics?.clearPlayers();
  resetInput();
  document.exitPointerLock?.();
}
function getName() {
  name = $("#name").value.trim();
  if (!name) {
    $("#name").focus();
    toast("Enter a player name first.");
    return false;
  }
  try {
    localStorage.setItem("crossline-name", name);
  } catch {}
  sound.unlock();
  return true;
}
function showHome() {
  page = "home";
  leaveVisuals();
  app.innerHTML = chrome(
    `<main class="home"><section class="intro"><div class="eyebrow">SUN. SEA. STRATEGY.</div><h1>SAME COAST.<br><em>NEW RIVALS.</em></h1><p>Your friends. Two sides. One island.<br>Open a room, share the code, and make your move.</p><div class="edition"><span>VOLUME 02</span><b>THE COASTLINE<br>COLLECTION</b></div></section><section class="entry panel"><div class="panel-top"><span>YOUR NEXT MATCH STARTS HERE</span><i>●</i></div><h2>Bring your squad.</h2><label for="name">PLAYER NAME</label><input id="name" maxlength="20" autocomplete="nickname" placeholder="Your callsign" value="${esc(name)}"><button id="create" class="primary">CREATE ROOM <span>↗</span></button><div class="divider">HAVE AN INVITE?</div><label for="code">ROOM CODE</label><div class="join-row"><input id="code" maxlength="6" placeholder="ABCD12" value="${esc(invite.toUpperCase().slice(0, 6))}" spellcheck="false"><button id="join">JOIN ROOM</button></div><div class="entry-foot"><button id="settings" class="subtle">SETTINGS</button><button id="how" class="subtle">HOW TO PLAY ↗</button></div><p class="muted">No accounts. No downloads. Just friends.</p></section></main>`,
  );
  $("#create").onclick = () => {
    if (getName()) showCreate();
  };
  $(".shell").classList.add("home-shell");
  const modeTag = document.createElement("p");
  modeTag.className = "mode-tag";
  modeTag.textContent = "COASTLINE • TEAM DEATHMATCH • 2–10 PLAYERS";
  $(".intro > p").after(modeTag);
  $("#settings").innerHTML = '<span aria-hidden="true">⚙</span> SETTINGS';
  $("#how").innerHTML = 'HOW TO PLAY <span aria-hidden="true">↗</span>';
  $("#join").onclick = () => {
    if (getName())
      call("join", { name, code: $("#code").value.trim().toUpperCase() });
  };
  $("#settings").onclick = () => showSettings();
  $("#how").onclick = () => showGuide(false);
  $("#code").oninput = (e) =>
    (e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""));
  $("#code").onkeydown = (e) => {
    if (e.key === "Enter") $("#join").click();
  };
  $("#name").onkeydown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      // A shared invitation already identifies a room; Enter should use it.
      $($("#code").value.trim() ? "#join" : "#create").click();
    }
  };
}
function mapCard() {
  return `<article class="map-card"><img src="${COASTLINE.preview}" alt="Actual 3D COASTLINE map"><div><span class="eyebrow">SELECTED BATTLEGROUND</span><h2>COASTLINE</h2><p>${COASTLINE.description}</p><small>MEDITERRANEAN COAST · RECOMMENDED 6–10 PLAYERS</small></div></article>`;
}
function showCreate() {
  page = "create";
  app.innerHTML = chrome(
    `<main class="create-page"><div class="page-heading"><div><div class="eyebrow">YOUR ROOM. YOUR SQUAD.</div><h1>SET THE STAGE.</h1></div><button id="back-home" class="subtle">← BACK</button></div><div class="create-grid">${mapCard()}<form id="room-form" class="panel room-form"><label for="room-name">ROOM NAME</label><input id="room-name" maxlength="40" value="${esc(name)}'s room"><label for="player-limit">PLAYER LIMIT</label><select id="player-limit">${Array.from({ length: 9 }, (_, i) => `<option ${i === 8 ? "selected" : ""}>${i + 2}</option>`).join("")}</select><label>GAME MODE</label><div class="fixed-field">TEAM DEATHMATCH <small>SOLDIERS vs TERRORISTS · 10 MINUTES</small></div><button id="confirm-create" class="primary">CREATE ROOM <span>↗</span></button><p class="muted">Share the room code with friends once you’re in.</p></form></div></main>`,
  );
  $("#back-home").onclick = showHome;
  $("#room-form").onsubmit = async (e) => {
    e.preventDefault();
    $("#confirm-create").disabled = true;
    const result = await call("create", {
      name,
      roomName: $("#room-name").value.trim(),
      playerLimit: Number($("#player-limit").value),
      mode: "tdm",
      mapId: "coastline",
    });
    if (!result && $("#confirm-create")) $("#confirm-create").disabled = false;
  };
}
function teamPanel(team) {
  const players = room.players.filter((p) => p.team === team),
    self = room.players.find((p) => p.id === socket.id);
  return `<section class="team-panel ${team}"><div class="team-banner"><img src="/previews/${TEAMS[team].model}.webp" alt="${TEAMS[team].name} character"><div><small>CHOOSE YOUR SIDE</small><h2>${TEAMS[team].name}</h2><span>${players.length} PLAYERS</span></div></div><div class="roster">${players.map((p) => `<div class="player-row"><span class="avatar">${esc(p.name.charAt(0).toUpperCase())}</span><span><b>${esc(p.name)} ${p.id === socket.id ? "<small>YOU</small>" : ""}</b><small>${esc(WEAPONS[p.primary].name)} · ${esc(WEAPONS[p.secondary].name)}</small></span><span class="ready-state ${p.ready ? "ready" : ""}">${p.ready ? "READY" : "NOT READY"}${p.id === room.host ? "<small>HOST</small>" : ""}</span></div>`).join("")}${players.length < Math.ceil(room.playerLimit / 2) ? '<div class="empty-slot">＋ Waiting for your squad</div>' : ""}</div><button class="team-button" data-team="${team}" ${room.state !== "lobby" ? "disabled" : ""}>${self?.team === team ? "✓ YOUR TEAM" : "JOIN " + TEAMS[team].name}</button></section>`;
}
function weaponOptions(list, selected) {
  return [...new Set(list.map((id) => WEAPONS[id].type))]
    .map(
      (type) =>
        `<optgroup label="${type}">${list
          .filter((id) => WEAPONS[id].type === type)
          .map(
            (id) =>
              `<option value="${id}" ${id === selected ? "selected" : ""}>${WEAPONS[id].name}</option>`,
          )
          .join("")}</optgroup>`,
    )
    .join("");
}
function showRoom() {
  page = "room";
  leaveVisuals();
  const self = room.players.find((p) => p.id === socket.id),
    host = room.host === socket.id,
    inLobby = room.state === "lobby";
  if (!self) return;
  app.innerHTML = chrome(
    `<main class="lobby"><div class="page-heading"><div><div class="eyebrow">${esc(room.name)} / TEAM DEATHMATCH</div><h1>ASSEMBLE YOUR TEAM.</h1></div><button id="leave" class="subtle">LEAVE ROOM ↗</button></div><div class="room-strip panel"><div><small>ROOM CODE</small><button id="copy" title="Copy room code">${room.code} <span>⧉</span></button></div><button id="share" class="subtle">COPY INVITE LINK ↗</button><div class="host-name"><small>HOST</small><b>${esc(room.players.find((p) => p.id === room.host)?.name)}</b></div><span class="room-count">${room.players.length}<small> / ${room.playerLimit} PLAYERS</small></span></div><div class="room-layout"><div><div class="teams">${TEAM_IDS.map(teamPanel).join("")}</div><div class="loadout panel"><div class="loadout-fields"><label>PRIMARY WEAPON<select id="primary" ${!inLobby ? "disabled" : ""}>${weaponOptions(PRIMARIES, self.primary)}</select></label><label>SIDEARM<select id="secondary" ${!inLobby ? "disabled" : ""}>${weaponOptions(PISTOLS, self.secondary)}</select></label><small>Knife · HE · Flash · Smoke included. Equipment refills on respawn.</small></div><div class="deploy"><button id="ready" class="${self.ready ? "selected" : ""}" ${!inLobby ? "disabled" : ""}>${self.ready ? "✓ READY — CLICK TO CANCEL" : "I’M READY"}</button><button id="start" class="primary" ${!host || room.players.length < 2 || (inLobby && room.players.some((p) => !p.ready)) ? "disabled" : ""}>${host ? "START GAME" : "WAITING FOR HOST"} <span>↗</span></button></div></div><p class="room-notice muted">${esc(room.notice) || (!inLobby ? "Waiting for the host to return everyone to the room." : "All players must be ready. Teams balance automatically at match start.")}</p></div><aside class="briefing">${mapCard()}<p><b>10</b> MINUTE MATCH <span>·</span> <b>3</b> SECOND RESPAWN</p><button id="lobby-settings" class="subtle">SETTINGS ↗</button></aside></div></main>`,
  );
  document
    .querySelectorAll("[data-team]")
    .forEach(
      (b) => (b.onclick = () => call("choose", { team: b.dataset.team })),
    );
  $("#primary").onchange = (e) => call("choose", { primary: e.target.value });
  $("#secondary").onchange = (e) =>
    call("choose", { secondary: e.target.value });
  $("#ready").onclick = () => call("choose", { ready: !self.ready });
  $("#start").onclick = () => {
    sound.unlock();
    call("start");
  };
  $("#leave").onclick = leave;
  $("#lobby-settings").onclick = () => showSettings();
  $("#copy").onclick = () => copy(room.code, "Room code copied.");
  $("#share").onclick = () =>
    copy(`${location.origin}/?room=${room.code}`, "Invite link copied.");
}
async function copy(value, message) {
  try {
    await navigator.clipboard.writeText(value);
    toast(message);
  } catch {
    toast(value);
  }
}
async function leave() {
  if (await call("leave")) {
    room = null;
    local = null;
    snapshot = null;
    loadingEpoch = null;
    showHome();
  }
}
async function ensureAssets() {
  if (assetPromise) return assetPromise;
  assetPromise = (async () => {
    loadText = "Preparing renderer";
    loadProgress = 0.02;
    const [{ Renderer }, { loadAssets }, { materialsReady }] =
      await Promise.all([
        import("./renderer.js"),
        import("./assets.js"),
        import("./materials.js"),
      ]);
    loadText = "Loading models";
    await loadAssets((value) => {
      loadProgress = 0.06 + value * 0.77;
      updateLoading();
    });
    loadText = "Preparing materials";
    await materialsReady;
    loadProgress = 0.86;
    updateLoading();
    if (!graphics) {
      graphics = new Renderer(canvas, settings);
      graphics.setQuality(settings.quality);
      graphics.onGrenadeBounce = (position) => {
        if (!local || !playing) return;
        const dx = position.x - local.x,
          dz = position.z - local.z,
          distance = Math.hypot(dx, dz);
        if (distance > 22) return;
        sound.play("grenadeBounce", {
          volume: Math.max(0, 1 - distance / 22),
          pan: Math.max(
            -1,
            Math.min(
              1,
              (dx * Math.cos(local.yaw) - dz * Math.sin(local.yaw)) /
                Math.max(1, distance),
            ),
          ),
        });
      };
    }
    loadText = "Building COASTLINE";
    loadProgress = 0.94;
    updateLoading();
    await graphics.renderer.compileAsync(graphics.scene, graphics.camera);
    loadProgress = 1;
    loadText = "Ready to deploy";
    updateLoading();
  })().catch((error) => {
    assetPromise = null;
    loadText = error.message;
    updateLoading();
    throw error;
  });
  return assetPromise;
}
function showLoading() {
  page = "loading";
  playing = false;
  document.exitPointerLock?.();
  app.innerHTML = chrome(
    `<main class="loading-page"><div class="loading-art"><img src="${COASTLINE.preview}" alt="COASTLINE battleground"><div><div class="eyebrow">TEAM DEATHMATCH / COASTAL OPERATIONS</div><h1>COASTLINE</h1><p>Own the angles. Watch the water.</p></div></div><div class="loading-bottom panel"><div><div class="load-label"><span id="load-label">${loadText || "Preparing deployment"}</span><b id="load-percent">0%</b></div><div class="progress"><i id="load-bar"></i></div><p class="muted">${room.players.map((p) => `${esc(p.name)} ${p.loaded ? "✓" : "…"}`).join("　 ·　 ")}</p></div><strong id="countdown">${room.state === "countdown" ? Math.ceil(room.countdown) : "02"}</strong></div><p class="loading-tip">${k("grenade")} SELECT GRENADE · LEFT CLICK TO THROW · ${k("use")} PICK UP DROPPED WEAPONS</p></main>`,
  );
  updateLoading();
}
function updateLoading() {
  if (page !== "loading") return;
  $("#load-label").textContent = loadText || "Preparing deployment";
  $("#load-percent").textContent = `${Math.round(loadProgress * 100)}%`;
  $("#load-bar").style.width = `${loadProgress * 100}%`;
}
const table = (players, results = false) =>
  `<table><thead><tr><th>PLAYER</th><th>K</th><th>D</th>${results ? "<th>K/D</th><th>HS</th><th>DAMAGE</th>" : ""}<th>SCORE</th><th>PING</th></tr></thead><tbody>${players.map((p) => `<tr class="${p.id === socket.id ? "self" : ""}"><td><i class="team-dot ${p.team}"></i>${esc(p.name)}${p.id === socket.id ? " <small>YOU</small>" : ""}</td><td>${p.kills}</td><td>${p.deaths}</td>${results ? `<td>${Number(p.kd).toFixed(2)}</td><td>${p.headshots}</td><td>${p.damage}</td>` : ""}<td>${p.score ?? p.kills * 100}</td><td>${p.ping} <small>ms</small></td></tr>`).join("")}</tbody></table>`;
function showResults() {
  page = "results";
  leaveVisuals();
  const r = room.results,
    host = room.host === socket.id;
  app.innerHTML = chrome(
    `<main class="results panel"><div class="eyebrow">COASTLINE / MATCH COMPLETE</div><h1 class="${r.winner}">${r.winner === "draw" ? "DRAW." : TEAMS[r.winner].name + " WIN."}</h1><div class="result-scores"><span class="soldiers">SOLDIERS <b>${r.scores.soldiers}</b></span><span>—</span><span class="terrorists"><b>${r.scores.terrorists}</b> TERRORISTS</span></div><p class="muted">${esc(r.reason)}</p>${TEAM_IDS.map(
      (t) =>
        `<h3 class="${t}">${TEAMS[t].name}</h3>${table(
          r.players.filter((p) => p.team === t),
          true,
        )}`,
    ).join(
      "",
    )}<div class="result-actions"><button id="again" class="primary" ${!host || room.players.length < 2 ? "disabled" : ""}>${host ? "PLAY AGAIN" : "WAITING FOR HOST"} ↗</button><button id="back">RETURN TO ROOM</button><button id="results-leave" class="subtle">LEAVE</button></div></main>`,
  );
  $("#again").onclick = () => call("start");
  $("#back").onclick = () => {
    if (host) call("return");
    else {
      resultsDismissed = true;
      showRoom();
    }
  };
  $("#results-leave").onclick = leave;
}
function controlsMarkup() {
  return `<div class="key-grid">${[
    ["forward", "WALK / STRAFE"],
    ["shoot", "SHOOT"],
    ["aim", "AIM / SCOPE"],
    ["jump", "JUMP"],
    ["run", "RUN"],
    ["crouch", "CROUCH"],
    ["reload", "RELOAD"],
    ["primary", "PRIMARY"],
    ["secondary", "PISTOL"],
    ["knife", "KNIFE"],
    ["grenade", "CYCLE GRENADES"],
    ["previous", "PREVIOUS WEAPON"],
    ["drop", "DROP WEAPON"],
    ["use", "USE / PICK UP"],
    ["scoreboard", "SCOREBOARD"],
    ["chat", "CHAT"],
  ]
    .map(
      ([key, label]) =>
        `<div><kbd>${key === "forward" ? [k("forward"), k("left"), k("back"), k("right")].join(" ") : k(key)}</kbd><span>${label}</span></div>`,
    )
    .join("")}</div>`;
}
function showGuide(inMatch = true) {
  if ($("#guide")) return;
  const el = document.createElement("dialog");
  el.className = "modal";
  el.id = "guide";
  el.innerHTML = `<section class="guide-card panel"><div class="eyebrow">A QUICK FIELD GUIDE</div><h2 id="guide-title">KNOW YOUR MOVES.</h2><p class="muted">Move with the keyboard. Look with the mouse. Enemy kills earn your team one point. Highest score after 10 minutes wins.</p>${controlsMarkup()}<div class="guide-notes"><p><b>GRENADES</b> Select with ${k("grenade")}, cycle to HE, Flash or Smoke, then ${k("shoot")} to throw.</p><p><b>KEEP FIGHTING</b> Respawn in 3 seconds. Equipment refills. Team damage is off.</p><p><b>OBJECTIVES</b> Bomb equipment is reserved for a future Bomb/Defuse mode, not Team Deathmatch.</p></div>${inMatch ? '<label class="check"><input id="hide-guide" type="checkbox">Don’t show again</label>' : ""}<button id="guide-close" class="primary">GOT IT <span>↗</span></button></section>`;
  document.body.append(el);
  const close = (enterMatch = false) => {
    if (inMatch) {
      settings.hideGuide = !!$("#hide-guide")?.checked;
      saveSettings();
    }
    dialog.close();
    if (enterMatch && inMatch) captureMouse();
  };
  el.querySelector("#guide-close").onclick = () => close(true);
  const dialog = openDialog(el, {
    labelledBy: "guide-title",
    initialFocus: "#guide-close",
    // Escape dismisses the guide without recapturing the pointer.
    onDismiss: () => close(),
  });
}
function showMatch() {
  page = "match";
  playing = true;
  resultsDismissed = false;
  scoreboard = false;
  feed = [];
  chat = [];
  pending = [];
  local = null;
  input = emptyInput();
  correction = { x: 0, y: 0, z: 0 };
  flashUntil = 0;
  canvas.classList.add("active");
  sound.setPlaying(true);
  app.innerHTML = `<div class="hud"><div class="map-label"><b>COASTLINE</b><span id="area">DEPLOYING</span><small id="connection-stats"></small></div><div class="match-score"><div class="score soldiers"><span>SOLDIERS</span><b id="soldiers-score">0</b></div><div class="clock"><small>TEAM DEATHMATCH</small><b id="timer">10:00</b></div><div class="score terrorists"><b id="terrorists-score">0</b><span>TERRORISTS</span></div></div><div id="kill-feed"></div><div id="crosshair" class="crosshair" style="${crossStyle()}">${crossMarkup}</div><div id="scope"><i></i></div><div id="hitmarker">×</div><div id="damage-flash"></div><div id="smoke-veil"></div><div id="flash-veil"></div><div id="confirmation">ENEMY ELIMINATED</div><div id="pickup-prompt"></div><div id="death"><small>YOU DIED</small><h2>RESPAWNING IN <span id="respawn">3</span></h2><p>Returning to your team’s position</p></div><div class="hud-bottom"><div class="health-block"><span>+</span><div><small>HEALTH</small><b id="health">100</b><div class="health-bar"><i id="health-fill"></i></div></div></div><div id="weapon-slots" class="weapon-slots"></div><div class="ammo-block"><small id="weapon-name"></small><div><b id="ammo">30</b><span>/ <span id="reserve">120</span></span></div><small id="reload-prompt"></small></div></div><div class="hud-help">${k("scoreboard")} SCOREBOARD <span>·</span> ${k("use")} PICK UP <span>·</span> ESC PAUSE</div><div id="board" class="scoreboard panel"></div><div id="chat-log"></div></div><div id="pause" class="pause-screen"><section class="pause-card panel"><div class="eyebrow">${TEAMS[room.players.find((p) => p.id === socket.id).team].name} / COASTLINE</div><h2>BACK TO THE COAST.</h2><p class="muted">Capture your mouse to play. Escape releases it.</p><button id="enter" class="primary">ENTER MATCH <span>↗</span></button><div class="pause-options"><button data-settings="controls">CONTROLS</button><button data-settings="graphics">GRAPHICS</button><button data-settings="audio">AUDIO</button><button data-settings="gameplay">GAMEPLAY</button></div><button id="pause-how" class="subtle">HOW TO PLAY</button><button id="exit-match" class="subtle">LEAVE MATCH</button></section></div><form id="chat-form" class="hidden"><input id="chat-input" maxlength="140" placeholder="Message your room · Enter to send"></form>`;
  $("#enter").onclick = () => {
    if (!settings.hideGuide) showGuide();
    else captureMouse();
  };
  $("#pause-how").onclick = () => showGuide();
  $("#exit-match").onclick = leave;
  document
    .querySelectorAll("[data-settings]")
    .forEach((b) => (b.onclick = () => showSettings(b.dataset.settings)));
  $("#chat-form").onsubmit = (e) => {
    e.preventDefault();
    socket.emit("chat", $("#chat-input").value);
    $("#chat-input").value = "";
    $("#chat-form").classList.add("hidden");
    captureMouse();
  };
  confirmationUntil = performance.now() + 1200;
  $("#confirmation").textContent = "FIGHT";
}
async function captureMouse() {
  await sound.unlock();
  try {
    await canvas.requestPointerLock({ unadjustedMovement: true });
  } catch {
    try {
      await canvas.requestPointerLock();
    } catch {
      toast("Mouse capture was blocked. Click Enter match again.");
    }
  }
}
function updateServerStatus(connected) {
  const status = $(".online");
  if (status) {
    status.setAttribute("role", "status");
    status.innerHTML = connected
      ? "<i></i>SERVER ONLINE"
      : '<i class="offline"></i>SERVER OFFLINE';
  }
}
// Connection status must not rebuild the form and erase an in-progress name/code.
socket.on("connect", () => updateServerStatus(true));
socket.on("connect_error", () => {
  updateServerStatus(false);
  toast("Cannot reach the server. Check your connection.");
});
socket.on("disconnect", () => {
  room = null;
  local = null;
  snapshot = null;
  locked = false;
  loadingEpoch = null;
  $("#guide")?.remove();
  $("#settings-modal")?.remove();
  showHome();
  toast("Disconnected. You have left the room. Rejoin with its code.");
});
socket.on("room", (data) => {
  const previous = room?.state;
  room = data;
  if (data.state === "playing") {
    if (previous !== "playing") showMatch();
  } else if (["loading", "countdown"].includes(data.state)) {
    if (data.state === "countdown")
      countdownUntil = performance.now() + data.countdown * 1000;
    showLoading();
    if (loadingEpoch !== data.loadEpoch) {
      loadingEpoch = data.loadEpoch;
      const epoch = loadingEpoch;
      ensureAssets()
        .then(() => {
          if (room?.state === "loading" && room.loadEpoch === epoch)
            call("loaded", { epoch });
        })
        .catch((error) => toast(`Loading failed: ${error.message}`));
    }
  } else if (data.state === "results") {
    if (resultsDismissed) showRoom();
    else showResults();
  } else {
    loadingEpoch = null;
    resultsDismissed = false;
    showRoom();
  }
});
socket.on("state", (state) => {
  if (!playing || !graphics) return;
  snapshot = state;
  const own = state.players.find((p) => p.id === socket.id);
  if (!own) return;
  graphics.sync(state, socket.id);
  if (own.hp <= 0 || (local && local.weapon !== own.weapon))
    sound.cancelReload();
  if (
    !local ||
    local.spawnId !== own.spawnId ||
    local.fireEpoch !== own.fireEpoch ||
    own.hp <= 0
  ) {
    cancelFire();
    predictedActionUntil = 0;
  }
  if (!local || local.spawnId !== own.spawnId) {
    local = { ...own };
    seq = Math.max(own.ack, seq);
    pending = [];
    input.yaw = own.yaw;
    input.pitch = own.pitch;
    correction = { x: 0, y: 0, z: 0 };
    fxAt = 0;
    graphics.clearEffects();
  } else {
    const old = { x: local.x, y: local.y, z: local.z };
    pending = pending.filter((c) => c.seq > own.ack);
    local = { ...own };
    if (local.hp > 0)
      for (const cmd of pending) move(local, cmd, TICK, COASTLINE.boxes);
    const distance = Math.hypot(
      old.x - local.x,
      old.y - local.y,
      old.z - local.z,
    );
    if (distance < 1) {
      for (const a of ["x", "y", "z"]) correction[a] += old[a] - local[a];
    } else correction = { x: 0, y: 0, z: 0 };
    if (local.hp > 0) {
      local.yaw = input.yaw;
      local.pitch = input.pitch;
    }
  }
});
socket.on("fx", (event) => {
  if (!playing) return;
  graphics?.fx(event, socket.id);
  if (event.type === "kill") {
    feed.unshift({ ...event, at: performance.now() });
    feed = feed.slice(0, 5);
  }
  if (
    event.id === socket.id &&
    ["throw", "draw", "reload", "drop", "pickup"].includes(event.type)
  )
    cancelFire();
  const pos = event.origin || event,
    dx = (pos.x ?? local?.x ?? 0) - (local?.x || 0),
    dz = (pos.z ?? local?.z ?? 0) - (local?.z || 0),
    distance = Math.hypot(dx, dz),
    pan = local
      ? Math.max(
          -1,
          Math.min(
            1,
            (dx * Math.cos(local.yaw) - dz * Math.sin(local.yaw)) /
              (distance || 1),
          ),
        )
      : 0;
  if (event.type === "shot" && event.id !== socket.id)
    sound.play(event.weapon, {
      volume: Math.max(0.02, 1 - distance / 65),
      pan,
    });
  else if (
    ["explosion", "flashbang", "smoke", "grenadeBounce"].includes(event.type)
  )
    sound.play(event.type, { volume: Math.max(0.03, 1 - distance / 45), pan });
  else if (event.id === socket.id || event.type === "pickup")
    sound.play(event.type, { weapon: event.weapon });
});
socket.on("hit", (data) => {
  hitUntil = performance.now() + 150;
  $("#hitmarker")?.classList.toggle("headshot", data.headshot);
  sound.play(data.killed ? "kill" : data.headshot ? "headshot" : "hit");
  if (data.killed) {
    confirmationUntil = performance.now() + 1300;
    if ($("#confirmation"))
      $("#confirmation").textContent = data.headshot
        ? "HEADSHOT · ENEMY ELIMINATED"
        : data.weapon === "he"
          ? "✹ HE GRENADE · ENEMY ELIMINATED"
          : "ENEMY ELIMINATED";
  }
});
socket.on("hurt", () => (hurtUntil = performance.now() + 230));
socket.on("flash", (data) => {
  flashUntil = Math.max(flashUntil, performance.now() + data.duration * 1000);
  flashDuration = data.duration * 1000;
  flashStrength = data.strength;
});
socket.on("chat", (data) => {
  chat.push({ ...data, at: performance.now() });
  chat = chat.slice(-4);
});
socket.on("latencyProbe", (ack) => {
  if (typeof ack === "function") ack();
});
setInterval(() => {
  if (socket.connected) {
    const start = performance.now();
    socket.timeout(2500).emit("pingCheck", (error) => {
      if (!error) latency = Math.round(performance.now() - start);
    });
  }
}, 2000);
function resetInput() {
  const { yaw, pitch } = input;
  input = { ...emptyInput(), yaw, pitch };
  scoreboard = false;
  cancelFire();
  fireButton.release();
}
function cancelFire() {
  input.shoot = false;
  wasFiring = false;
  fireButton.cancel();
}
function canStartFire() {
  return (
    local &&
    !actionBlocksFire(local) &&
    performance.now() >= predictedActionUntil
  );
}
document.addEventListener("pointerlockchange", () => {
  locked = document.pointerLockElement === canvas;
  if ($("#pause")) $("#pause").style.display = locked ? "none" : "grid";
  if (!locked) resetInput();
});
window.addEventListener("blur", resetInput);
document.addEventListener("visibilitychange", () => {
  if (document.hidden) resetInput();
});
document.addEventListener("mousemove", (e) => {
  if (!locked || !playing || !local || local.hp <= 0) return;
  const factor = input.aim
    ? settings.aimSensitivity *
      (WEAPONS[local.weapon].type === "SNIPER" ? 0.4 : 1)
    : 1;
  input.yaw -= e.movementX * settings.sensitivity * factor;
  input.pitch = Math.max(
    -1.48,
    Math.min(
      1.48,
      input.pitch -
        e.movementY *
          settings.sensitivity *
          factor *
          (settings.invert ? -1 : 1),
    ),
  );
});
document.addEventListener("contextmenu", (e) => {
  if (playing || $("#settings-modal")) e.preventDefault();
});
function feedbackShot(now) {
  if (
    !local ||
    !canStartFire() ||
    !(local.ammo.mag > 0 || local.weapon === "knife") ||
    !(isFirearm(local.weapon) || local.weapon === "knife") ||
    now < fxAt
  )
    return;
  const w = WEAPONS[local.weapon];
  graphics.localShot(local.weapon);
  sound.play(local.weapon);
  input.pitch = Math.min(1.48, input.pitch + w.recoil * (input.aim ? 0.7 : 1));
  fxAt = now + w.interval * 1000;
}
function control(code, down, repeat = false) {
  if (!playing || $("#settings-modal") || $("#guide")) return false;
  const action = Object.entries(settings.bindings).find(
    ([, key]) => key === code,
  )?.[0];
  if (!action) return false;
  if (action === "shoot" && !down) {
    fireButton.release();
    input.shoot = false;
    return true;
  }
  if (
    action === "scoreboard" &&
    (!$("#chat-input") || document.activeElement !== $("#chat-input"))
  ) {
    scoreboard = down;
    return true;
  }
  if (!locked) return false;
  if (action === "shoot") {
    if (!repeat && fireButton.press(canStartFire())) {
      input.shoot = true;
      socket.emit("action", {
        type: "fire",
        value: {
          yaw: input.yaw,
          pitch: input.pitch,
          aim: input.aim,
          spawnId: local.spawnId,
          weapon: local.weapon,
          fireEpoch: local.fireEpoch,
          pressId: ++pressId,
        },
      });
      feedbackShot(performance.now());
      if (GRENADES.includes(local.weapon)) {
        cancelFire();
        input.aim = false;
        predictedActionUntil = performance.now() + 750;
      }
    }
    return true;
  }
  if (
    [
      "forward",
      "back",
      "left",
      "right",
      "jump",
      "run",
      "crouch",
      "aim",
    ].includes(action)
  ) {
    input[action] = down;
    return true;
  }
  if (!down || repeat) return true;
  if (local?.action === "throw" && local.actionTime > 0) return true;
  if (action === "reload" || action === "drop" || action === "use") {
    cancelFire();
    if (action !== "reload") sound.cancelReload();
    input.aim = false;
    predictedActionUntil = performance.now() + 200;
    socket.emit("action", { type: action === "use" ? "pickup" : action });
    return true;
  }
  if (action === "objective") {
    cancelFire();
    toast("Objective equipment is not used in Team Deathmatch.");
    return true;
  }
  if (action === "chat") {
    document.exitPointerLock();
    $("#chat-form").classList.remove("hidden");
    $("#chat-input").focus();
    return true;
  }
  input.aim = false;
  cancelFire();
  sound.cancelReload();
  predictedActionUntil = performance.now() + 200;
  fxAt = performance.now() + 220;
  socket.emit(
    "action",
    action.startsWith("cycle")
      ? { type: "cycle", value: action === "cycleUp" ? -1 : 1 }
      : { type: "switch", value: action },
  );
  return true;
}
document.addEventListener("keydown", (e) => {
  if (e.code === "Escape" && locked) {
    document.exitPointerLock();
    return;
  }
  if (control(e.code, true, e.repeat)) e.preventDefault();
});
document.addEventListener("keyup", (e) => {
  if (control(e.code, false)) e.preventDefault();
});
document.addEventListener("mousedown", (e) =>
  control(`Mouse${e.button}`, true),
);
document.addEventListener("mouseup", (e) => control(`Mouse${e.button}`, false));
document.addEventListener(
  "wheel",
  (e) => {
    if (control(e.deltaY < 0 ? "WheelUp" : "WheelDown", true)) {
      e.preventDefault();
    }
  },
  { passive: false },
);
window.addEventListener("settingschange", () => {
  sound.apply();
  if (graphics) {
    graphics.options = settings;
    graphics.setQuality(settings.quality);
  }
});
function updateHud(now) {
  if (!playing || !local || !snapshot) return;
  const text = (id, value) => {
      const el = document.getElementById(id);
      if (el) el.textContent = value;
    },
    w = WEAPONS[local.weapon],
    secs = Math.max(0, Math.ceil(snapshot.remaining));
  text(
    "timer",
    `${Math.floor(secs / 60)
      .toString()
      .padStart(2, "0")}:${(secs % 60).toString().padStart(2, "0")}`,
  );
  for (const t of TEAM_IDS) text(t + "-score", snapshot.scores[t]);
  text("health", local.hp);
  text("ammo", local.weapon === "knife" ? "∞" : local.ammo.mag);
  text("reserve", local.ammo.reserve);
  text("weapon-name", w.name.toUpperCase());
  text("respawn", Math.max(1, Math.ceil(local.respawn)));
  text("area", areaAt(local.x, local.z));
  text(
    "connection-stats",
    [
      settings.showFps ? `${Math.round(fps)} FPS` : "",
      settings.showPing ? `${latency} MS` : "",
    ]
      .filter(Boolean)
      .join(" / "),
  );
  text(
    "reload-prompt",
    local.reload > 0
      ? `RELOADING ${local.reload.toFixed(1)}s`
      : local.protected
        ? "SPAWN PROTECTION"
        : w.type === "GRENADE"
          ? "LEFT CLICK TO THROW"
          : local.weapon === "knife"
            ? "CLOSE QUARTERS"
            : local.ammo.mag === 0
              ? `EMPTY · ${k("reload")} TO RELOAD`
              : `${k("reload")} TO RELOAD`,
  );
  $("#health-fill").style.width = `${local.hp}%`;
  $("#death").classList.toggle("visible", local.hp <= 0);
  const scope = input.aim && w.type === "SNIPER" && local.hp > 0 && locked;
  $("#scope").classList.toggle("visible", scope);
  $("#crosshair").classList.toggle("hidden", local.hp <= 0 || !locked || scope);
  $("#crosshair").setAttribute(
    "style",
    crossStyle(
      settings.crossDynamic && !input.aim
        ? Math.min(9, Math.hypot(local.vx, local.vz)) +
            (graphics?.kick || 0) * 8
        : 0,
    ),
  );
  $("#board").classList.toggle("visible", scoreboard);
  if (scoreboard)
    $("#board").innerHTML =
      `<div class="board-title">COASTLINE <small>ROOM ${room.code}</small></div>${TEAM_IDS.map((t) => `<h3 class="${t}">${TEAMS[t].name}</h3>${table(snapshot.players.filter((p) => p.team === t).sort((a, b) => b.kills - a.kills))}`).join("")}`;
  $("#weapon-slots").innerHTML = [
    ["primary", local.slots.primary],
    ["secondary", local.slots.secondary],
    ["knife", "knife"],
    ...GRENADES.map((id) => ["grenade", id]),
  ]
    .map(
      ([key, id]) =>
        `<span class="${id === local.weapon ? "active" : ""} ${!id ? "empty" : ""}"><kbd>${k(key)}</kbd>${!id ? "EMPTY" : GRENADES.includes(id) ? `${id.toUpperCase()} ${local.grenades[id]}` : WEAPONS[id].name}</span>`,
    )
    .join("");
  feed = feed.filter((f) => now - f.at < 6500);
  $("#kill-feed").innerHTML = settings.killfeed
    ? feed
        .map(
          (f) =>
            `<div><b class="${f.team}">${esc(f.killer)}</b><span>${f.weapon === "he" ? '<i aria-label="Grenade kill">✹</i> ' : f.headshot ? "⌖ " : ""}${esc(WEAPONS[f.weapon]?.name)}</span><b>${esc(f.victim)}</b></div>`,
        )
        .join("")
    : "";
  const nearest = (snapshot.drops || [])
    .filter((d) => {
      const dx = d.x - local.x,
        dz = d.z - local.z,
        dy = d.y + 0.2 - local.y - 1,
        len = Math.hypot(dx, dz, dy);
      return (
        Math.hypot(dx, dz) < 2 &&
        Math.abs(d.y - local.y) < 1.8 &&
        wallDistance(
          { x: local.x, y: local.y + 1, z: local.z },
          { x: dx / len, y: dy / len, z: dz / len },
          COASTLINE.boxes,
        ) >=
          len - 0.1
      );
    })
    .sort(
      (a, b) =>
        Math.hypot(a.x - local.x, a.z - local.z) -
        Math.hypot(b.x - local.x, b.z - local.z),
    )[0];
  text(
    "pickup-prompt",
    nearest && local.hp > 0
      ? `${k("use")} — PICK UP ${WEAPONS[nearest.weapon].name.toUpperCase()}`
      : "",
  );
  $("#pickup-prompt").classList.toggle("visible", !!nearest && locked);
  $("#chat-log").innerHTML = chat
    .filter((m) => now - m.at < 12000)
    .map((m) => `<div><b>${esc(m.name)}</b> ${esc(m.message)}</div>`)
    .join("");
}
function frame(now) {
  const elapsed = (now - last) / 1000,
    dt = Math.min(0.05, elapsed);
  last = now;
  if (playing && local) {
    accumulator += dt;
    while (accumulator >= TICK) {
      accumulator -= TICK;
      if (local.hp > 0) {
        const cmd = {
          ...input,
          seq: ++seq,
          spawnId: local.spawnId,
          fireEpoch: local.fireEpoch,
          weapon: local.weapon,
        };
        socket.volatile.emit("input", cmd);
        move(local, cmd, TICK, COASTLINE.boxes);
        pending.push(cmd);
        if (pending.length > 90) pending.shift();
      }
    }
    local.reload = Math.max(0, local.reload - dt);
    local.respawn = Math.max(0, local.respawn - dt);
    local.actionTime = Math.max(0, local.actionTime - dt);
    if (snapshot) snapshot.remaining = Math.max(0, snapshot.remaining - dt);
    if (
      locked &&
      input.shoot &&
      fireButton.active &&
      canStartFire() &&
      local.hp > 0 &&
      !local.reload &&
      (local.ammo.mag > 0 || local.weapon === "knife") &&
      (isFirearm(local.weapon) || local.weapon === "knife")
    ) {
      const w = WEAPONS[local.weapon];
      if (now >= fxAt && (w.auto || !wasFiring)) {
        graphics.localShot(local.weapon);
        sound.play(local.weapon);
        input.pitch = Math.min(
          1.48,
          input.pitch + w.recoil * (input.aim ? 0.7 : 1),
        );
        fxAt = now + w.interval * 1000;
      }
    }
    wasFiring = input.shoot;
    if (
      local.hp > 0 &&
      local.grounded &&
      Math.hypot(local.vx, local.vz) > 2 &&
      now > stepAt
    ) {
      sound.play("step", {
        surface: surfaceAt(local.x, local.z),
        volume: local.crouch ? 0.25 : 0.7,
      });
      stepAt = now + (input.run ? 300 : 410);
    }
    for (const a of ["x", "y", "z"]) correction[a] *= Math.exp(-15 * dt);
  }
  if (
    graphics &&
    playing &&
    now - renderAt >= 1000 / (settings.fpsLimit || 1000) - 1
  ) {
    const renderDt = Math.min(0.1, (now - renderAt) / 1000);
    fps += (1 / Math.max(0.001, renderDt) - fps) * 0.08;
    graphics.render(
      renderDt,
      local
        ? {
            ...local,
            x: local.x + correction.x,
            y: local.y + correction.y,
            z: local.z + correction.z,
          }
        : null,
      playing,
      input.aim && locked,
    );
    renderAt = now;
  }
  if (page === "loading" && room?.state === "countdown") {
    const remaining = Math.max(1, Math.ceil((countdownUntil - now) / 1000));
    if ($("#countdown")) $("#countdown").textContent = remaining;
    if (remaining !== lastCountdown) {
      lastCountdown = remaining;
      sound.play("countdown");
    }
  }
  if (now > hudAt) {
    updateHud(now);
    hudAt = now + 80;
  }
  if ($("#hitmarker"))
    $("#hitmarker").style.opacity =
      settings.hitmarker && now < hitUntil ? "1" : "0";
  if ($("#damage-flash"))
    $("#damage-flash").style.opacity = now < hurtUntil ? ".55" : "0";
  if ($("#confirmation"))
    $("#confirmation").style.opacity = now < confirmationUntil ? "1" : "0";
  if ($("#smoke-veil"))
    $("#smoke-veil").style.opacity = graphics?.smokeOpacity || 0;
  if ($("#flash-veil"))
    $("#flash-veil").style.opacity =
      now < flashUntil
        ? Math.min(
            1,
            ((flashUntil - now) / flashDuration) *
              Math.min(2, flashStrength * 3),
          )
        : 0;
  requestAnimationFrame(frame);
}
showHome();
requestAnimationFrame(frame);
