// Mode-gated objective logic. TDM never creates a bomb or enables objective actions.
export class BombObjective {
  constructor({
    enabled = false,
    now = () => performance.now() / 1000,
    onEvent = () => {},
  } = {}) {
    this.enabled = enabled;
    this.now = now;
    this.onEvent = onEvent;
    this.reset();
  }
  reset() {
    this.state = "inactive";
    this.carrier = null;
    this.position = null;
    this.progress = null;
    this.site = null;
    this.deadline = 0;
    this.result = null;
    this.nextBeep = 0;
  }
  give(player) {
    if (
      !this.enabled ||
      this.state !== "inactive" ||
      player.hp <= 0 ||
      player.team !== "terrorists"
    )
      return false;
    this.state = "carried";
    this.carrier = player.id;
    this.position = { x: player.x, y: player.y, z: player.z };
    this.onEvent("pickup");
    return true;
  }
  drop(player) {
    if (this.state !== "carried" || this.carrier !== player.id) return false;
    this.state = "dropped";
    this.position = { x: player.x, y: player.y, z: player.z };
    this.carrier = null;
    this.progress = null;
    this.onEvent("drop");
    return true;
  }
  pickup(player) {
    if (
      !this.enabled ||
      this.state !== "dropped" ||
      player.hp <= 0 ||
      player.team !== "terrorists" ||
      !this.near(player, 2)
    )
      return false;
    this.carrier = player.id;
    this.state = "carried";
    this.onEvent("pickup");
    return true;
  }
  near(player, r) {
    return (
      this.position &&
      Math.hypot(player.x - this.position.x, player.z - this.position.z) < r &&
      Math.abs(player.y - this.position.y) < 2
    );
  }
  plant(player, site) {
    if (this.progress)
      return (
        this.progress.actor === player.id && this.progress.kind === "plant"
      );
    if (
      !this.enabled ||
      this.state !== "carried" ||
      player.id !== this.carrier ||
      player.team !== "terrorists" ||
      player.hp <= 0 ||
      !player.grounded ||
      Math.hypot(player.x - site.x, player.z - site.z) > site.radius
    )
      return false;
    this.progress = {
      kind: "plant",
      actor: player.id,
      start: this.now(),
      x: player.x,
      z: player.z,
    };
    this.site = site.id;
    this.position = { x: player.x, y: player.y, z: player.z };
    this.onEvent("planting");
    return true;
  }
  defuse(player) {
    if (this.progress)
      return (
        this.progress.actor === player.id && this.progress.kind === "defuse"
      );
    if (
      !this.enabled ||
      this.state !== "planted" ||
      player.team !== "soldiers" ||
      player.hp <= 0 ||
      !this.near(player, 2)
    )
      return false;
    this.progress = {
      kind: "defuse",
      actor: player.id,
      start: this.now(),
      x: player.x,
      z: player.z,
    };
    this.onEvent("defusing");
    return true;
  }
  cancel(id) {
    if (this.progress?.actor === id) this.progress = null;
  }
  tick(players) {
    if (!this.enabled) return;
    if (this.state === "carried") {
      const owner = players.get(this.carrier);
      if (!owner || owner.hp <= 0) {
        this.drop(owner || { id: this.carrier, ...this.position });
      } else this.position = { x: owner.x, y: owner.y, z: owner.z };
    }
    const now = this.now(),
      job = this.progress;
    if (job) {
      const p = players.get(job.actor);
      if (
        !p ||
        p.hp <= 0 ||
        !p.using ||
        Math.hypot(p.x - job.x, p.z - job.z) > 0.3
      )
        this.progress = null;
      else if (now - job.start >= (job.kind === "plant" ? 3 : 5)) {
        this.progress = null;
        if (job.kind === "plant") {
          this.state = "planted";
          this.carrier = null;
          this.deadline = now + 40;
          this.nextBeep = now;
          this.onEvent("planted");
        } else {
          this.state = "defused";
          this.result = "soldiers";
          this.onEvent("defused");
        }
      }
    }
    if (this.state === "planted") {
      if (now >= this.deadline) {
        this.state = "exploded";
        this.result = "terrorists";
        this.progress = null;
        this.onEvent("explosion", this.position);
      } else if (now >= this.nextBeep) {
        this.nextBeep = now + Math.max(0.12, (this.deadline - now) / 40);
        this.onEvent("beep", this.position);
      }
    }
  }
  snapshot() {
    return {
      state: this.state,
      carrier: this.carrier,
      position: this.position,
      site: this.site,
      remaining: Math.max(0, this.deadline - this.now()),
      progress: this.progress
        ? {
            kind: this.progress.kind,
            actor: this.progress.actor,
            elapsed: this.now() - this.progress.start,
          }
        : null,
      result: this.result,
    };
  }
}
