import { WEAPONS } from "../shared/weapons.js";

const clamp = (v) => Math.max(0, Math.min(1, v));
export const smooth = (v) => {
  const t = clamp(v);
  return t * t * (3 - 2 * t);
};

// Presentation only: these curves never change fire cadence, ammunition or hit tests.
export function weaponPose(id) {
  const w = WEAPONS[id],
    pistol = w.type === "PISTOL";
  const support =
    {
      p90: -0.32,
      bizon: -0.34,
      mac10: -0.11,
      mp9: -0.23,
      mp7: -0.25,
      aug: -0.31,
      famas: -0.29,
      nova: -0.49,
      xm1014: -0.5,
      sawedoff: -0.34,
      mag7: -0.31,
      m249: -0.46,
      negev: -0.44,
    }[id] ?? -0.38;
  return {
    pistol,
    equipment: w.type === "GRENADE" || w.type === "OBJECTIVE",
    grip:
      w.type === "GRENADE"
        ? [0.021, -0.028, 0.052]
        : id === "bomb"
          ? [0.19, -0.08, 0.038]
          : id === "knife"
            ? [0.012, -0.045, -0.005]
            : [
                id === "dualberettas" ? 0.126 : 0,
                pistol ? -0.12 : -0.173,
                pistol ? 0.112 : 0.13,
              ],
    support:
      w.type === "GRENADE"
        ? [-0.12, 0.11, 0.012]
        : id === "bomb"
          ? [-0.19, -0.08, 0.038]
          : id === "p90"
            ? [-0.032, -0.125, -0.222]
            : ["mp9", "mp7"].includes(id)
              ? [-0.022, -0.19, -0.269]
              : pistol
                ? [0, -0.13, 0.108]
                : [0, -0.025, support],
    sight:
      w.type === "SNIPER"
        ? 0.244
        : ["aug", "sg553"].includes(id)
          ? 0.212
          : pistol
            ? 0.08
            : 0.145,
    scale: pistol
      ? 0.82
      : w.type === "GRENADE"
        ? 0.95
        : id === "bomb"
          ? 0.82
          : 0.83,
    position: pistol
      ? [0.17, -0.17, -0.83]
      : w.type === "GRENADE"
        ? [0.28, -0.28, -0.8]
        : id === "bomb"
          ? [0.24, -0.24, -0.87]
          : [0.24, -0.2, -0.63],
    yaw: pistol ? 0.12 : 0.07,
    kick:
      w.type === "SHOTGUN"
        ? 1.25
        : w.type === "SNIPER"
          ? 1.4
          : pistol
            ? 0.9
            : 0.7,
  };
}

export function reloadPose(id, remaining) {
  const w = WEAPONS[id],
    t = remaining > 0 && w.reload > 0 ? clamp(1 - remaining / w.reload) : 0;
  const out = smooth((t - 0.12) / 0.18) * (1 - smooth((t - 0.64) / 0.14));
  const seat = Math.sin(clamp((t - 0.77) / 0.1) * Math.PI) * (t < 0.88 ? 1 : 0);
  const tilt = smooth(t / 0.16) * (1 - smooth((t - 0.84) / 0.16));
  const tube = ["nova", "xm1014", "sawedoff"].includes(id);
  const top = id === "p90",
    side = id === "bizon",
    heavy = w.type === "HEAVY";
  const magazine = top
    ? [0, out * 0.19, out * 0.1]
    : side
      ? [-out * 0.17, -out * 0.1, out * 0.14]
      : [
          0,
          -out * (w.type === "PISTOL" ? 0.26 : 0.34) + seat * 0.018,
          out * 0.06,
        ];
  const grab = smooth((t - 0.055) / 0.11) * (1 - smooth((t - 0.78) / 0.08));
  const rack = smooth((t - 0.81) / 0.045) * (1 - smooth((t - 0.93) / 0.06));
  const rest = weaponPose(id).support;
  const magGrip = top
    ? [0, 0.18, -0.15]
    : side
      ? [0, -0.14, -0.24]
      : w.type === "PISTOL"
        ? [0, -0.217, 0.11]
        : [
            0,
            heavy ? -0.26 : -0.25,
            ["mac10", "mp9", "mp7"].includes(id)
              ? 0.112
              : ["aug", "famas"].includes(id)
                ? 0.22
                : -0.13,
          ];
  const rackGrip = w.type === "PISTOL" ? [0, 0.025, 0.09] : [-0.02, 0.08, 0.11];
  const support = rest.map(
    (v, i) => (magGrip[i] + magazine[i] - v) * grab + (rackGrip[i] - v) * rack,
  );
  if (id === "dualberettas") support.fill(0); // both palms retain their own pistols
  const cylinder =
    id === "r8" ? smooth(t / 0.18) * (1 - smooth((t - 0.78) / 0.16)) : 0;
  if (id === "r8")
    for (let i = 0; i < 3; i++)
      support[i] = ([-0.04, 0.01, -0.04][i] - rest[i]) * cylinder;
  return {
    t,
    tilt,
    seat,
    magazine: top
      ? [0, out * 0.19, out * 0.1]
      : side
        ? [-out * 0.17, -out * 0.1, out * 0.14]
        : [
            0,
            -out * (w.type === "PISTOL" ? 0.26 : 0.34) + seat * 0.018,
            out * 0.06,
          ],
    magazineAngle: top ? out * -0.24 : side ? out * 0.5 : out * 0.17,
    grab,
    rack,
    cylinder,
    support: tube
      ? [-0.06 * tilt, -Math.abs(Math.sin(t * Math.PI * 4)) * 0.1, tilt * 0.22]
      : support,
    bolt: Math.sin(clamp((t - 0.84) / 0.12) * Math.PI) * (t < 0.96 ? 1 : 0),
    cover: heavy ? tilt * -1.1 : 0,
    tube,
  };
}

// Future objective presentation is separate from the TDM inventory/state machine.
export function equipmentPose(state, progress = 0) {
  const t = clamp(progress);
  if (state === "planting")
    return {
      lower: smooth(t) * 0.2,
      pitch: -0.42 * smooth(t),
      tap: Math.sin(t * Math.PI * 8) * 0.025,
      pulse: 0,
    };
  if (state === "dropped" || state === "planted")
    return {
      lower: 0,
      pitch: -Math.PI / 2,
      tap: 0,
      pulse: state === "planted" ? 1 : 0,
    };
  if (state === "pickup")
    return {
      lower: (1 - smooth(t)) * 0.3,
      pitch: (1 - smooth(t)) * -0.6,
      tap: 0,
      pulse: 0,
    };
  return { lower: 0, pitch: 0, tap: 0, pulse: 0 };
}
