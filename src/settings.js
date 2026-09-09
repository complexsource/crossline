import { openDialog } from "./dialog.js";

export const BINDINGS = {
  forward: "KeyW",
  back: "KeyS",
  left: "KeyA",
  right: "KeyD",
  jump: "Space",
  run: "ShiftLeft",
  crouch: "ControlLeft",
  shoot: "Mouse0",
  aim: "Mouse2",
  reload: "KeyR",
  use: "KeyE",
  drop: "KeyG",
  primary: "Digit1",
  secondary: "Digit2",
  knife: "Digit3",
  grenade: "Digit4",
  objective: "Digit5",
  previous: "KeyQ",
  cycleUp: "WheelUp",
  cycleDown: "WheelDown",
  scoreboard: "Tab",
  chat: "KeyY",
};
export const DEFAULTS = {
  sensitivity: 0.0021,
  aimSensitivity: 0.6,
  invert: false,
  quality: "high",
  resolution: 1,
  shadows: true,
  effects: true,
  textures: "high",
  antialias: true,
  fov: 78,
  fpsLimit: 0,
  master: 0.5,
  guns: 0.8,
  environment: 0.3,
  music: 0.12,
  crossColor: "#d5efba",
  crossSize: 7,
  crossThickness: 2,
  crossGap: 5,
  crossDot: false,
  crossDynamic: true,
  hitmarker: true,
  killfeed: true,
  showFps: false,
  showPing: true,
  hideGuide: false,
  bindings: { ...BINDINGS },
};
export function readSettings(storage = globalThis.localStorage) {
  try {
    const raw = JSON.parse(storage.getItem("crossline-v2-settings") || "{}"),
      s = { ...DEFAULTS, bindings: { ...BINDINGS } };
    for (const [k, v] of Object.entries(raw))
      if (k in DEFAULTS && k !== "bindings" && typeof v === typeof DEFAULTS[k])
        s[k] = v;
    if (raw.bindings)
      for (const [k, v] of Object.entries(raw.bindings))
        if (
          k in BINDINGS &&
          typeof v === "string" &&
          !Object.values(s.bindings).some(
            (other) => other === v && s.bindings[k] !== v,
          )
        )
          s.bindings[k] = v;
    return s;
  } catch {
    return { ...DEFAULTS, bindings: { ...BINDINGS } };
  }
}
export function rebind(settings, action, code) {
  if (!Object.hasOwn(BINDINGS, action)) return "Unknown action";
  if (code === "Escape") return "Escape is reserved for the browser menu.";
  const duplicate = Object.entries(settings.bindings).find(
    ([a, key]) => a !== action && key === code,
  );
  if (duplicate) return `Already assigned to ${duplicate[0]}.`;
  settings.bindings[action] = code;
  return null;
}
export const keyLabel = (key) =>
  ({
    Mouse0: "LMB",
    Mouse1: "MMB",
    Mouse2: "RMB",
    WheelUp: "WHEEL ↑",
    WheelDown: "WHEEL ↓",
    Space: "SPACE",
    ShiftLeft: "SHIFT",
    ControlLeft: "CTRL",
  })[key] || key.replace("Key", "").replace("Digit", "").toUpperCase();
export const settings = readSettings();
export function saveSettings() {
  try {
    localStorage.setItem("crossline-v2-settings", JSON.stringify(settings));
  } catch {}
  window.dispatchEvent(new Event("settingschange"));
}
export function crossStyle(extraGap = 0) {
  return `--cross:${settings.crossColor};--size:${settings.crossSize}px;--thickness:${settings.crossThickness}px;--gap:${settings.crossGap + extraGap}px;--dot:${settings.crossDot ? "block" : "none"}`;
}
export const crossMarkup = "<i></i><i></i><i></i><i></i><b></b>";
const groups = {
  MOVEMENT: ["forward", "back", "left", "right", "jump", "run", "crouch"],
  COMBAT: ["shoot", "aim", "reload", "use", "drop"],
  WEAPONS: [
    "primary",
    "secondary",
    "knife",
    "grenade",
    "objective",
    "previous",
    "cycleUp",
    "cycleDown",
  ],
  GAME: ["scoreboard", "chat"],
};
let capture = null,
  settingsDialog = null;
function range(key, label, min, max, step) {
  return `<label class="setting"><span>${label}<output>${settings[key]}</output></span><input data-setting="${key}" type="range" min="${min}" max="${max}" step="${step}" value="${settings[key]}"></label>`;
}
function check(key, label) {
  return `<label class="check"><input data-setting="${key}" type="checkbox" ${settings[key] ? "checked" : ""}>${label}</label>`;
}
function select(key, label, values) {
  return `<label class="setting"><span>${label}</span><select data-setting="${key}">${values.map((v) => `<option value="${v}" ${settings[key] === v ? "selected" : ""}>${String(v).toUpperCase()}</option>`).join("")}</select></label>`;
}
export function showSettings(category = "controls", onClose = () => {}) {
  const replacing = document.querySelector("#settings-modal")?.open,
    returnFocus = replacing
      ? settingsDialog?.returnFocus
      : document.activeElement;
  settingsDialog?.close(false);
  const modal = document.createElement("dialog");
  modal.id = "settings-modal";
  modal.className = "modal";
  modal.innerHTML = `<section class="settings-card panel"><div class="dialog-heading"><div><div class="eyebrow">MAKE IT YOURS</div><h2 id="settings-title">SETTINGS</h2></div><button id="settings-close" class="subtle">CLOSE ×</button></div><nav class="settings-tabs" aria-label="Settings categories">${["controls", "graphics", "audio", "gameplay"].map((c) => `<button data-category="${c}" aria-pressed="${c === category}" class="${c === category ? "selected" : ""}">${c.toUpperCase()}</button>`).join("")}</nav><div id="settings-content"></div><p id="binding-status" role="status"></p></section>`;
  document.body.append(modal);
  const panel = modal.querySelector("#settings-content");
  if (category === "controls")
    panel.innerHTML = `<div class="setting-grid">${range("sensitivity", "Mouse sensitivity", 0.0005, 0.006, 0.0001)}${range("aimSensitivity", "Aim multiplier", 0.1, 1, 0.05)}${check("invert", "Invert vertical look")}</div>${Object.entries(
      groups,
    )
      .map(
        ([group, actions]) =>
          `<h3>${group}</h3><div class="binding-grid">${actions.map((a) => `<div><span>${a.replace(/([A-Z])/g, " $1").toUpperCase()}</span><button data-bind="${a}">${keyLabel(settings.bindings[a])}</button></div>`).join("")}</div>`,
      )
      .join(
        "",
      )}<p class="muted">ESC always releases the mouse. Objective equipment is unavailable in Team Deathmatch.</p><button id="reset-bindings">RESET CONTROLS</button>`;
  if (category === "graphics")
    panel.innerHTML = `<div class="setting-grid">${select("quality", "Graphics preset", ["low", "medium", "high", "ultra"])}${range("resolution", "Resolution scale", 0.5, 1.5, 0.1)}${range("fov", "Field of view", 65, 100, 1)}${select("fpsLimit", "FPS limit (0 = display refresh)", [0, 30, 60, 90, 120, 144])}${select("textures", "Texture detail / filtering", ["low", "high"])}${check("shadows", "Shadows")}${check("effects", "Decorative effects")}${check("antialias", "Anti-aliasing (takes effect after page reload)")}</div><p class="muted">VSync is controlled by your browser and display. Smoke visibility does not change with quality settings.</p><button id="fullscreen">TOGGLE FULLSCREEN ↗</button>`;
  if (category === "audio")
    panel.innerHTML = `<div class="setting-grid">${range("master", "Master volume", 0, 1, 0.05)}${range("guns", "Weapons & equipment", 0, 1, 0.05)}${range("environment", "Ocean & footsteps", 0, 1, 0.05)}${range("music", "Menu ambience", 0, 1, 0.05)}</div><p class="muted">Spatial gunfire follows the shooter. Voice chat is not included in V2.</p>`;
  if (category === "gameplay")
    panel.innerHTML = `<div class="cross-preview"><div class="crosshair" style="${crossStyle()}">${crossMarkup}</div><span>LIVE CROSSHAIR PREVIEW</span></div><div class="setting-grid"><label class="setting"><span>Crosshair color</span><input type="color" data-setting="crossColor" value="${settings.crossColor}"></label>${range("crossSize", "Size", 2, 18, 1)}${range("crossThickness", "Thickness", 1, 5, 1)}${range("crossGap", "Gap", 0, 15, 1)}${check("crossDot", "Center dot")}${check("crossDynamic", "Dynamic crosshair")}${check("hitmarker", "Hit markers")}${check("killfeed", "Kill feed")}${check("showFps", "Show FPS")}${check("showPing", "Show ping")}</div>`;
  const close = () => {
    capture = null;
    settingsDialog?.close();
    settingsDialog = null;
    onClose();
  };
  modal.querySelector("#settings-close").onclick = close;
  modal.querySelectorAll("[data-category]").forEach(
    (b) =>
      (b.onclick = () => {
        capture = null;
        showSettings(b.dataset.category, onClose);
      }),
  );
  modal.querySelectorAll("[data-setting]").forEach(
    (el) =>
      (el.oninput = () => {
        const key = el.dataset.setting;
        settings[key] =
          el.type === "checkbox"
            ? el.checked
            : typeof DEFAULTS[key] === "number"
              ? Number(el.value)
              : el.value;
        el.parentElement
          .querySelector("output")
          ?.replaceChildren(String(settings[key]));
        saveSettings();
        const preview = modal.querySelector(".crosshair");
        if (preview) preview.setAttribute("style", crossStyle());
      }),
  );
  modal.querySelectorAll("[data-bind]").forEach(
    (b) =>
      (b.onclick = () => {
        capture = b.dataset.bind;
        modal.querySelector("#binding-status").textContent =
          `Press a key, mouse button or wheel for ${capture}. Escape cancels.`;
      }),
  );
  modal.querySelector("#reset-bindings")?.addEventListener("click", () => {
    settings.bindings = { ...BINDINGS };
    settings.sensitivity = DEFAULTS.sensitivity;
    settings.aimSensitivity = DEFAULTS.aimSensitivity;
    saveSettings();
    showSettings("controls", onClose);
  });
  modal.querySelector("#fullscreen")?.addEventListener("click", async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch {
      modal.querySelector("#binding-status").textContent =
        "Fullscreen is unavailable in this browser.";
    }
  });
  settingsDialog = openDialog(modal, {
    labelledBy: "settings-title",
    initialFocus: replacing
      ? `[data-category="${category}"]`
      : "#settings-close",
    returnFocus,
    onDismiss: close,
  });
}
function bindEvent(e, code) {
  if (!capture) return;
  e.preventDefault();
  e.stopImmediatePropagation();
  if (code === "Escape") {
    capture = null;
    document.querySelector("#binding-status").textContent =
      "Binding cancelled.";
    return;
  }
  const error = rebind(settings, capture, code);
  document.querySelector("#binding-status").textContent =
    error || "Binding saved.";
  if (!error) {
    document.querySelector(`[data-bind="${capture}"]`).textContent =
      keyLabel(code);
    capture = null;
    saveSettings();
  }
}
if (typeof document !== "undefined") {
  document.addEventListener("keydown", (e) => bindEvent(e, e.code), true);
  document.addEventListener(
    "mousedown",
    (e) => bindEvent(e, `Mouse${e.button}`),
    true,
  );
  document.addEventListener(
    "wheel",
    (e) => bindEvent(e, e.deltaY < 0 ? "WheelUp" : "WheelDown"),
    { capture: true, passive: false },
  );
}
