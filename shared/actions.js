export const GRENADE_THROW_SECONDS = 0.55;
export const ACTION_STATES = Object.freeze({
  idle: "IDLE",
  shoot: "FIRING",
  reload: "RELOADING",
  draw: "SWITCHING",
  throw: "THROWING_GRENADE",
  slash: "KNIFE_ATTACK",
  drop: "DROPPING_WEAPON",
  pickup: "PICKING_UP_WEAPON",
  death: "DEAD",
  respawn: "RESPAWNING",
});
const exclusive = new Set(["reload", "draw", "throw", "drop", "pickup"]);
export function actionState(p, now) {
  if (p.hp <= 0) return "DEAD";
  const remaining = now === undefined ? p.actionTime : p.actionUntil - now;
  return remaining > 0 ? ACTION_STATES[p.action] || "IDLE" : "IDLE";
}
export function actionBlocksFire(p, now) {
  return (
    p.hp <= 0 ||
    (now === undefined ? p.reload > 0 : p.reloadAt > now) ||
    ((now === undefined ? p.actionTime : p.actionUntil - now) > 0 &&
      exclusive.has(p.action))
  );
}

// Physical press state is separate from effective fire input. Cancelling an
// action never manufactures a release, so key repeat/held mouse cannot rearm it.
export class FireButton {
  held = false;
  active = false;
  press(allowed) {
    if (this.held) return false;
    this.held = true;
    this.active = !!allowed;
    return this.active;
  }
  release() {
    this.held = this.active = false;
  }
  cancel() {
    this.active = false;
  }
}
