import { WEAPONS, isFirearm } from "../shared/weapons.js";
export class Sound {
  constructor(options) {
    this.options = options;
    this.ctx = null;
    this.playing = false;
    this.active = 0;
    this.reloadSounds = new Set();
  }
  async unlock() {
    if (!this.ctx) {
      const c = (this.ctx = new AudioContext());
      this.master = c.createGain();
      this.master.connect(c.destination);
      this.environment = c.createGain();
      this.environment.connect(this.master);
      this.music = c.createGain();
      this.music.connect(this.master);
      this.noise = c.createBuffer(1, c.sampleRate * 2, c.sampleRate);
      const data = this.noise.getChannelData(0);
      let last = 0;
      for (let i = 0; i < data.length; i++) {
        const white = Math.random() * 2 - 1;
        data[i] = white;
        last = white;
      }
      const sea = c.createBufferSource();
      sea.buffer = this.noise;
      sea.loop = true;
      const filter = c.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.value = 350;
      const gain = c.createGain();
      gain.gain.value = 0.065;
      sea.connect(filter).connect(gain).connect(this.environment);
      sea.start();
      // Slow wave envelope; no recorded or borrowed weapon audio.
      const swell = c.createOscillator(),
        sw = c.createGain();
      swell.frequency.value = 0.12;
      sw.gain.value = 0.025;
      swell.connect(sw).connect(gain.gain);
      swell.start();
      for (const hz of [110, 164.81, 220, 293.66]) {
        const osc = c.createOscillator(),
          gain = c.createGain();
        osc.type = "sine";
        osc.frequency.value = hz;
        gain.gain.value = 0.018;
        osc.connect(gain).connect(this.music);
        osc.start();
      }
    }
    this.apply();
    if (this.ctx.state === "suspended") await this.ctx.resume();
  }
  apply() {
    if (!this.ctx) return;
    this.master.gain.value = this.options.master;
    this.environment.gain.value = this.options.environment;
    this.music.gain.value = this.playing ? 0 : this.options.music;
  }
  setPlaying(value) {
    this.playing = value;
    this.apply();
    if (!value) this.cancelReload();
  }
  cancelReload() {
    for (const source of this.reloadSounds) {
      try {
        source.stop();
      } catch {}
    }
    this.reloadSounds.clear();
  }
  play(type, { volume = 1, pan = 0, weapon = "m4a4", surface = "stone" } = {}) {
    const c = this.ctx;
    if (!c || c.state !== "running" || this.active > 48) return;
    const t = c.currentTime,
      shot = isFirearm(type),
      w = WEAPONS[type],
      boom = type === "explosion" || type === "bombExplosion",
      step = type === "step";
    if (type === "reload") {
      this.cancelReload();
      const config = WEAPONS[weapon],
        tube = ["nova", "xm1014", "sawedoff"].includes(weapon);
      for (const f of tube ? [0.2, 0.4, 0.6, 0.82] : [0.14, 0.65, 0.87]) {
        const source = this.clickAt(
          t + (WEAPONS[weapon]?.reload || 2) * f,
          f > 0.8
            ? config?.type === "PISTOL"
              ? 2750
              : 1800
            : weapon === "p90"
              ? 1200
              : 670,
          volume * (f > 0.8 ? 0.27 : 0.18),
          pan,
        );
        if (source) this.reloadSounds.add(source);
      }
      return;
    }
    if (
      [
        "draw",
        "pickup",
        "drop",
        "throw",
        "bombPlant",
        "bombPickup",
        "bombDrop",
      ].includes(type)
    ) {
      const metallic = type === "throw" ? 2700 : type === "drop" ? 540 : 1300;
      this.clickAt(t, metallic, volume * 0.12, pan, 0.035);
      this.clickAt(t + 0.065, metallic * 0.58, volume * 0.08, pan, 0.065);
      return;
    }
    if (type === "grenadeBounce") {
      this.clickAt(t, 1350, volume * 0.16, pan, 0.033);
      this.clickAt(t + 0.015, 490, volume * 0.1, pan, 0.06);
      return;
    }
    if (
      type === "bombBeep" ||
      type === "countdown" ||
      type === "hit" ||
      type === "headshot" ||
      type === "kill"
    ) {
      this.clickAt(
        t,
        type === "bombBeep"
          ? 1100
          : type === "headshot"
            ? 1500
            : type === "kill"
              ? 850
              : 630,
        volume * 0.3,
        pan,
        0.07,
        true,
      );
      return;
    }
    const duration = boom
      ? 0.85
      : shot
        ? w.type === "SNIPER"
          ? 0.26
          : w.suppressed
            ? 0.095
            : 0.16
        : type === "flashbang"
          ? 0.32
          : type === "smoke"
            ? 1.25
            : step
              ? surface === "water"
                ? 0.19
                : 0.07
              : 0.07;
    const frequency = boom
      ? 140
      : shot
        ? Math.max(350, 2100 - w.damage * 19 + (w.interval < 0.1 ? 150 : 0))
        : step
          ? { stone: 420, wood: 260, metal: 1700, sand: 700, water: 900 }[
              surface
            ] || 400
          : type === "knife"
            ? 2300
            : type === "empty"
              ? 2600
              : 1500;
    const channel = step ? this.environment : this.master,
      amplitude =
        volume *
        (step
          ? 0.11
          : shot
            ? w.suppressed
              ? 0.18
              : 0.5
            : boom
              ? 0.65
              : 0.16) *
        (step ? 1 : this.options.guns),
      gain = c.createGain(),
      stereo = c.createStereoPanner();
    stereo.pan.value = pan;
    gain.connect(stereo).connect(channel);
    gain.gain.setValueAtTime(Math.max(0.001, amplitude), t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration);
    const source = c.createBufferSource();
    source.buffer = this.noise;
    const filter = c.createBiquadFilter();
    filter.type =
      type === "smoke" ? "highpass" : step || boom ? "lowpass" : "bandpass";
    filter.frequency.value = frequency;
    filter.Q.value = shot
      ? w.type === "SMG"
        ? 0.95
        : w.type === "SHOTGUN"
          ? 0.38
          : 0.65
      : 0.7;
    source.connect(filter).connect(gain);
    source.playbackRate.value = 0.96 + Math.random() * 0.08;
    source.start(t, Math.random() * 0.2);
    source.stop(t + duration);
    this.active++;
    if (shot || boom) {
      const osc = c.createOscillator();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(boom ? 78 : 170 - w.damage * 0.8, t);
      osc.frequency.exponentialRampToValueAtTime(35, t + duration);
      osc.connect(gain);
      osc.start();
      osc.stop(t + duration);
      osc.onended = () => osc.disconnect();
    }
    if (shot && !w.suppressed) {
      const heavy = ["SHOTGUN", "SNIPER", "HEAVY"].includes(w.type);
      this.clickAt(
        t,
        heavy ? 2450 : 3300,
        volume * 0.18,
        pan,
        heavy ? 0.03 : 0.014,
      );
      this.clickAt(
        t + 0.045,
        w.type === "PISTOL" ? 2850 : 1800,
        volume * 0.045,
        pan,
        0.025,
      );
      this.clickAt(t + 0.09, 850, volume * (heavy ? 0.07 : 0.035), pan, 0.12);
      this.clickAt(t + 0.175, 620, volume * 0.022, -pan * 0.35, 0.15);
    } else if (shot) {
      this.clickAt(t + 0.025, 2200, volume * 0.055, pan, 0.025);
    }
    if (type === "flashbang")
      this.clickAt(t + 0.02, 3400, volume * 0.04, pan, 0.24, true);
    source.onended = () => {
      this.reloadSounds.delete(source);
      source.disconnect();
      filter.disconnect();
      gain.disconnect();
      stereo.disconnect();
      this.active--;
    };
  }
  clickAt(t, frequency, volume, pan = 0, duration = 0.045, tone = false) {
    const c = this.ctx;
    if (!c || this.active > 48) return;
    const source = tone ? c.createOscillator() : c.createBufferSource(),
      filter = c.createBiquadFilter(),
      gain = c.createGain(),
      stereo = c.createStereoPanner();
    if (tone) {
      source.type = "sine";
      source.frequency.value = frequency;
    } else source.buffer = this.noise;
    filter.type = "bandpass";
    filter.frequency.value = frequency;
    gain.gain.setValueAtTime(Math.max(0.001, volume * this.options.guns), t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration);
    stereo.pan.value = pan;
    source.connect(filter).connect(gain).connect(stereo).connect(this.master);
    source.start(t);
    source.stop(t + duration);
    this.active++;
    source.onended = () => {
      this.reloadSounds.delete(source);
      source.disconnect();
      filter.disconnect();
      gain.disconnect();
      stereo.disconnect();
      this.active--;
    };
    return source;
  }
}
