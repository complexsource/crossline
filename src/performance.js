// Pixel and effect budgets are independent of gameplay/network tick rate.
export const QUALITY = {
  low: { dpr: 0.85, pixels: 1100000, shadow: 0, particles: 45, detail: 24 },
  medium: { dpr: 1, pixels: 1800000, shadow: 1024, particles: 80, detail: 42 },
  high: { dpr: 1.5, pixels: 2800000, shadow: 1536, particles: 130, detail: 65 },
  ultra: { dpr: 2, pixels: 4200000, shadow: 2048, particles: 200, detail: 95 },
};
export function effectiveQuality(value, hardware = globalThis.navigator) {
  if (Object.hasOwn(QUALITY, value)) return value;
  return hardware?.deviceMemory <= 4 || hardware?.hardwareConcurrency <= 4
    ? "low"
    : "medium";
}
export function pixelRatio(
  width,
  height,
  dpr,
  quality,
  resolution = 1,
  scale = 1,
) {
  return (
    Math.min(
      Math.min(dpr || 1, quality.dpr) * resolution,
      Math.sqrt(quality.pixels / Math.max(1, width * height)),
    ) * scale
  );
}
export class AdaptiveResolution {
  constructor() {
    this.reset();
  }
  reset() {
    this.scale = 1;
    this.samples = [];
    this.goodWindows = 0;
  }
  sample(ms, target = 1000 / 60) {
    // Ignore tab suspension, startup stalls and intentionally throttled frames.
    if (!Number.isFinite(ms) || ms <= 0 || ms > 250) return false;
    this.samples.push(ms);
    if (this.samples.length < 90) return false;
    this.samples.sort((a, b) => a - b);
    const p75 = this.samples[Math.floor(this.samples.length * 0.75)];
    this.samples.length = 0;
    const previous = this.scale;
    if (p75 > target * 1.18) {
      this.scale = Math.max(0.6, this.scale - 0.1);
      this.goodWindows = 0;
    } else if (p75 < target * 1.04 && ++this.goodWindows >= 4) {
      this.scale = Math.min(1, this.scale + 0.05);
      this.goodWindows = 0;
    } else if (p75 >= target * 1.04) this.goodWindows = 0;
    return this.scale !== previous;
  }
}
