import { eyeHeight } from "../shared/game.js";
const damp = (a, b, speed, dt) => a + (b - a) * (1 - Math.exp(-speed * dt));
// Small, bounded presentation offsets; never change collision, network position,
// jump height or server hits. Stance/eye height itself is shared with authority.
export class CameraMotion {
  reset(p) {
    this.spawn = p.spawnId;
    this.y = p.y;
    this.grounded = p.grounded;
    this.vy = p.vy || 0;
    this.step = 0;
    this.land = 0;
    this.landTarget = 0;
    this.phase = 0;
    this.speed = 0;
    this.death = 0;
  }
  update(p, dt, aim = false) {
    if (
      this.spawn !== p.spawnId ||
      this.y === undefined ||
      Math.abs(p.y - this.y) > 1
    )
      this.reset(p);
    const delta = p.y - this.y;
    if (p.grounded && this.grounded && Math.abs(delta) <= 0.34)
      this.step = Math.max(-0.3, Math.min(0.3, this.step - delta));
    this.step = damp(this.step, 0, 16, dt);
    if (p.grounded && !this.grounded && this.vy < -2)
      this.landTarget = Math.min(0.05, -this.vy * 0.004);
    this.land = damp(this.land, this.landTarget, 22, dt);
    this.landTarget *= Math.exp(-12 * dt);
    this.speed = damp(
      this.speed,
      p.grounded && p.hp > 0 ? Math.hypot(p.vx, p.vz) : 0,
      12,
      dt,
    );
    this.phase += this.speed * dt * 1.9;
    this.death = damp(this.death, p.hp > 0 ? 0 : 0.5, 9, dt);
    this.y = p.y;
    this.grounded = p.grounded;
    this.vy = p.vy || 0;
    const bob =
      Math.sin(this.phase * 2) *
      Math.min(0.014, this.speed * 0.002) *
      (aim ? 0.12 : 1);
    return {
      y: p.y + eyeHeight(p) + this.step - this.land - this.death + bob,
      bob: Math.sin(this.phase) * Math.min(0.01, this.speed * 0.0018),
      land: this.land,
    };
  }
}
