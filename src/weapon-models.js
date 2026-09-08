import * as THREE from "three";
import { WEAPONS } from "../shared/weapons.js";
import {
  box,
  cylinder,
  ellipsoid,
  joint,
  material,
  bake,
  silhouette,
} from "./geometry.js";
import {
  ring,
  wire,
  grenadeModel,
  bombModel,
  knifeModel,
} from "./equipment.js";

// Original model blueprints: receiver, barrel, stock, furniture and magazine profile.
// Shared manufactured details are reused; silhouettes and operating parts vary by family.
const shapes = {
  glock18: [0.29, 0.29, 0.0, 0xb8ad8b, 0],
  usps: [0.3, 0.51, 0, 0x424f4a, 0],
  p2000: [0.28, 0.28, 0, 0x777c66, 0],
  dualberettas: [0.33, 0.32, 0, 0x9b6a48, 0],
  p250: [0.27, 0.28, 0, 0xb7a680, 0],
  fiveseven: [0.31, 0.32, 0, 0x5d6c69, 0],
  tec9: [0.34, 0.43, 0, 0x9a9876, 0],
  cz75: [0.29, 0.31, 0, 0xad5e50, 0],
  deagle: [0.37, 0.4, 0, 0xc5af85, 0],
  r8: [0.31, 0.42, 0, 0x9e6f46, 0],
  mac10: [0.32, 0.4, 0.39, 0x767d6e, 0],
  mp9: [0.36, 0.48, 0.45, 0xb6a17c, 0],
  mp7: [0.36, 0.47, 0.44, 0xae9e7d, 0],
  mp5sd: [0.43, 0.7, 0.53, 0x515c56, 0.06],
  ump45: [0.43, 0.52, 0.57, 0x657369, 0.04],
  p90: [0.53, 0.48, 0.43, 0x90998c, 0],
  bizon: [0.43, 0.56, 0.54, 0x5b6d63, 0],
  nova: [0.37, 0.83, 0.65, 0xa8a183, 0],
  mag7: [0.45, 0.54, 0.36, 0x69776c, 0],
  sawedoff: [0.32, 0.58, 0.28, 0x9b6e43, 0],
  xm1014: [0.4, 0.85, 0.6, 0x59675d, 0],
  m249: [0.53, 0.9, 0.67, 0x8c946d, 0],
  negev: [0.55, 0.83, 0.61, 0x778569, 0],
  ak47: [0.43, 0.78, 0.6, 0xa37843, 0.13],
  m4a4: [0.43, 0.72, 0.6, 0xb7a27c, 0.045],
  m4a1s: [0.43, 0.91, 0.6, 0x5a6b61, 0.045],
  galil: [0.48, 0.8, 0.58, 0x969974, 0.065],
  famas: [0.45, 0.65, 0.44, 0x657268, 0],
  sg553: [0.43, 0.79, 0.6, 0xad9c78, 0.04],
  aug: [0.53, 0.79, 0.42, 0x9aab7a, 0],
  ssg08: [0.45, 0.98, 0.63, 0x94a397, 0],
  awp: [0.57, 1.02, 0.64, 0x859967, 0],
  g3sg1: [0.53, 0.94, 0.66, 0x767b69, 0.025],
  scar20: [0.5, 0.91, 0.62, 0xc1a274, 0.025],
};
function screw(p, x, y, z, steel) {
  const m = cylinder(p, x, y, z, 0.008, 0.006, steel);
  m.rotation.z = Math.PI / 2;
  box(p, x + 0.004, y, z, 0.003, 0.002, 0.01, 0x485650);
}
function rail(p, z, length, steel, y = 0.135) {
  for (let i = 0; i < Math.floor(length / 0.029); i++)
    box(p, 0, y, z + i * 0.029, 0.1, 0.018, 0.016, steel, 0, 0.003);
}
function grip(p, z, y, mat, scale = 1) {
  const m = box(
    p,
    0,
    y,
    z,
    0.077 * scale,
    0.205 * scale,
    0.105 * scale,
    mat,
    0,
    0.014,
  );
  m.rotation.x = -0.24;
  for (const s of [-1, 1])
    for (let i = 0; i < 6; i++)
      box(
        p,
        s * 0.041 * scale,
        y - 0.067 + i * 0.024 * scale,
        z,
        0.004,
        0.009,
        0.065 * scale,
        0x36443c,
        0,
        0.003,
      ).rotation.x = -0.24;
}
function guard(p, z, y, steel) {
  const r = ring(p, 0, y, z, 0.061, 0.008, 0x657469);
  r.rotation.y = Math.PI / 2;
  r.scale.set(1, 0.75, 1);
  box(p, 0, y + 0.017, z, 0.012, 0.05, 0.016, steel, 0, 0.004).rotation.x =
    -0.3;
}
function scope(p, z, steel, big = false) {
  const y = big ? 0.244 : 0.212,
    r = big ? 0.048 : 0.031,
    len = big ? 0.36 : 0.22;
  for (const zz of [z - len * 0.3, z + len * 0.3]) {
    box(p, 0, 0.153, zz, 0.066, 0.1, 0.05, steel, 0, 0.005);
    ring(p, 0, y, zz, r + 0.007, 0.008, 0x374842);
  }
  cylinder(p, 0, y, z, r, len, steel, true);
  cylinder(p, 0, y, z - len * 0.57, r * (big ? 1.46 : 1.22), 0.08, steel, true);
  cylinder(p, 0, y, z + len * 0.57, r * 1.2, 0.06, steel, true);
  cylinder(
    p,
    0,
    y,
    z - len * 0.57 - 0.041,
    r * (big ? 1.32 : 1.08),
    0.002,
    material(0x337e85, 0.85),
    true,
  );
  cylinder(
    p,
    0,
    y,
    z + len * 0.57 + 0.031,
    r * 1.1,
    0.002,
    material(0x20545e, 0.85),
    true,
  );
  cylinder(p, 0, y + r + 0.014, z, 0.024, 0.033, steel);
  const cap = cylinder(p, 0.056, y, z, 0.021, 0.032, steel);
  cap.rotation.z = Math.PI / 2;
}
function magazine(p, z, length, curve, steel) {
  silhouette(
    p,
    [
      [z - 0.053, -0.07],
      [z + 0.055, -0.07],
      [z + 0.06 + curve * 0.2, -0.16],
      [z + 0.05 + curve, -0.07 - length],
      [z - 0.06 + curve, -0.085 - length],
      [z - 0.065 + curve * 0.2, -0.16],
    ],
    0.066,
    steel,
  );
  for (const s of [-1, 1])
    for (let i = 0; i < 3; i++)
      wire(
        p,
        [
          [s * 0.037, -0.115, z - 0.036 + i * 0.03],
          [
            s * 0.037,
            -0.15 - length * 0.25,
            z - 0.033 + i * 0.03 + curve * 0.3,
          ],
          [s * 0.037, -0.065 - length, z - 0.036 + i * 0.03 + curve * 0.88],
        ],
        0x78837b,
        0.004,
      );
}
function stock(p, len, furniture, steel, style) {
  if (style === "wire" || style === "skeleton") {
    for (const y of [0.054, -0.098])
      wire(
        p,
        [
          [0, y, 0.16],
          [0, y, len - 0.035],
          [0, -0.18, len],
        ],
        0x929e91,
        0.012,
      );
    box(p, 0, -0.058, len, 0.085, 0.25, 0.036, steel, 0, 0.009);
  } else {
    silhouette(
      p,
      [
        [0.17, 0.045],
        [0.3, 0.082],
        [len, 0.065],
        [len, -0.19],
        [len - 0.07, -0.192],
        [0.29, -0.07],
      ],
      0.105,
      furniture,
    );
    if (style !== "wood") {
      box(
        p,
        0,
        0.073,
        (len + 0.3) / 2,
        0.101,
        0.04,
        len - 0.3,
        steel,
        0,
        0.008,
      );
      for (const s of [-1, 1])
        box(
          p,
          s * 0.056,
          -0.066,
          len - 0.13,
          0.006,
          0.059,
          0.11,
          0x58695b,
          0,
          0.012,
        );
    }
    box(p, 0, -0.067, len + 0.016, 0.12, 0.26, 0.035, 0x34473d, 0, 0.011);
  }
}
function singlePistol(id) {
  const w = WEAPONS[id],
    [receiver, barrel, , color] = shapes[id],
    g = new THREE.Group(),
    steel = material(id === "deagle" ? 0xc7bca3 : 0x77847c, 0.7),
    dark = material(0x38463f, 0.6),
    furniture = material(color, 0.16),
    mag = joint(g, 0, 0, 0),
    bolt = joint(g, 0, 0, 0);
  mag.name = "magazine";
  bolt.name = "bolt";
  const big = id === "deagle" ? 1.17 : 1;
  silhouette(
    g,
    [
      [0.15, 0.05],
      [-receiver + 0.12, 0.04],
      [-receiver + 0.1, -0.05],
      [-0.02, -0.066],
      [0.09, -0.096],
      [0.15, -0.06],
    ],
    0.087 * big,
    furniture,
  );
  grip(g, 0.088, -0.135, furniture, big);
  guard(g, -0.003, -0.097, steel);
  if (id === "r8") {
    cylinder(bolt, 0, 0.044, -0.02, 0.06, 0.11, steel, true);
    for (let i = 0; i < 6; i++) {
      const a = (i * Math.PI) / 3;
      cylinder(
        bolt,
        Math.sin(a) * 0.047,
        0.044 + Math.cos(a) * 0.047,
        -0.02,
        0.014,
        0.112,
        dark,
        true,
      );
    }
    box(g, 0, 0.075, -0.23, 0.072, 0.07, 0.24, steel, 0, 0.01);
    cylinder(g, 0, 0.042, -0.28, 0.03, 0.28, steel, true);
    box(g, 0, 0.09, 0.1, 0.029, 0.057, 0.043, steel, 0, 0.003).rotation.x =
      -0.4;
  } else {
    box(
      bolt,
      0,
      0.065,
      -receiver / 2 + 0.12,
      0.086 * big,
      0.091 * big,
      receiver,
      steel,
      0,
      0.013,
    );
    box(
      bolt,
      0.045 * big,
      0.065,
      -0.04,
      0.005,
      0.033,
      0.065,
      0x35463e,
      0,
      0.003,
    );
    for (const s of [-1, 1])
      for (let i = 0; i < 7; i++)
        box(
          bolt,
          s * 0.046 * big,
          0.073,
          0.034 + i * 0.012,
          0.004,
          0.048,
          0.003,
          0x42554a,
          0,
          0.001,
        );
    cylinder(g, 0, 0.046, -barrel / 2 + 0.0, 0.022, barrel, steel, true);
    if (id === "usps") {
      cylinder(g, 0, 0.049, -0.32, 0.045, 0.23, dark, true);
      ring(g, 0, 0.049, -0.23, 0.045, 0.004, 0x7d8e7f);
    }
    if (id === "tec9") {
      cylinder(g, 0, 0.052, -0.235, 0.043, 0.23, dark, true);
      for (let i = 0; i < 4; i++)
        for (const s of [-1, 1])
          ellipsoid(
            g,
            s * 0.04,
            0.065,
            -0.15 - i * 0.035,
            0.004,
            0.012,
            0.013,
            0x131e1a,
          );
      magazine(mag, 0.083, 0.36, 0, dark);
    } else
      box(
        mag,
        0,
        -0.255 * big,
        0.117,
        0.086 * big,
        0.029,
        0.112,
        furniture,
        0,
        0.008,
      );
    if (id === "cz75") {
      const spare = joint(g, 0, -0.02, -0.16);
      grip(spare, 0, -0.12, furniture, 0.65);
    }
  }
  const muzzle =
    id === "usps" ? -0.443 : id === "tec9" ? -0.36 : -barrel + 0.04;
  cylinder(g, 0, 0.047, muzzle, 0.018, 0.004, 0x14231b, true);
  box(g, 0, 0.125, -receiver + 0.15, 0.019, 0.023, 0.025, dark, 0, 0.003);
  box(g, 0, 0.125, 0.135, 0.067, 0.021, 0.028, dark, 0, 0.002);
  for (const x of [-0.023, 0.023])
    box(g, x, 0.13, 0.152, 0.009, 0.009, 0.002, 0xbce890);
  box(g, 0, 0.139, -receiver + 0.162, 0.011, 0.012, 0.006, 0xc9f0a0);
  screw(g, 0.052, -0.02, 0.091, steel);
  g.userData.muzzle = muzzle;
  return g;
}
export function weaponModel(id) {
  if (id === "knife") return knifeModel();
  if (id === "bomb") return bombModel();
  if (["he", "flash", "smoke"].includes(id)) return grenadeModel(id);
  const w = WEAPONS[id];
  if (!w) throw Error(`Unknown model ${id}`);
  let g;
  if (w.type === "PISTOL") {
    if (id === "dualberettas") {
      g = new THREE.Group();
      for (const s of [-1, 1]) {
        const pistol = singlePistol(id);
        pistol.position.set(s * 0.12, 0, s * 0.025);
        pistol.rotation.z = s * -0.055;
        g.add(pistol);
      }
    } else g = singlePistol(id);
  } else {
    const [receiver, barrel, stockLength, color, curve] = shapes[id],
      steel = material(0x63766d, 0.67),
      light = material(0x99a79a, 0.66),
      dark = material(0x293e34, 0.4),
      furniture = material(color, w.model === "wood" ? 0.07 : 0.22),
      mag = joint(new THREE.Group(), 0, 0, 0);
    g = mag.parent;
    mag.name = "magazine";
    const bolt = joint(g, 0, 0, 0);
    bolt.name = "bolt";
    const smg = w.type === "SMG",
      heavy = w.type === "HEAVY",
      sniper = w.type === "SNIPER",
      pump = ["nova", "xm1014", "sawedoff"].includes(id),
      bull = ["p90", "famas", "aug"].includes(id);
    const start = -receiver + 0.17;
    silhouette(
      g,
      [
        [0.19, 0.075],
        [start, 0.07],
        [start - 0.02, -0.048],
        [-0.03, -0.076],
        [0.09, -0.097],
        [0.19, -0.06],
      ],
      heavy ? 0.145 : 0.105,
      steel,
    );
    box(
      g,
      0,
      0.084,
      (start + 0.17) / 2,
      0.11,
      0.056,
      receiver,
      light,
      0,
      0.009,
    );
    grip(g, 0.115, -0.165, furniture, heavy ? 1.1 : 1);
    guard(g, 0.006, -0.102, steel);
    if (!bull) stock(g, stockLength, furniture, steel, w.model);
    else {
      silhouette(
        g,
        [
          [0.39, 0.07],
          [0.39, -0.19],
          [0.27, -0.22],
          [0.07, -0.115],
          [-0.25, -0.065],
          [-0.29, 0.06],
        ],
        0.15,
        furniture,
      );
      box(g, 0, -0.065, 0.4, 0.17, 0.26, 0.035, dark, 0, 0.01);
      if (id === "p90") {
        const hoop = ring(g, 0, -0.16, -0.2, 0.095, 0.024, color);
        hoop.rotation.y = Math.PI / 2;
        hoop.scale.set(1, 1.12, 1);
        box(
          mag,
          0,
          0.124,
          -0.08,
          0.13,
          0.049,
          0.46,
          material(0x9c8e66, 0.23),
          0,
          0.012,
        );
        for (let i = 0; i < 13; i++) {
          const round = cylinder(
            mag,
            0,
            0.146,
            -0.28 + i * 0.03,
            0.01,
            0.078,
            material(0xc5a766, 0.65),
          );
          round.rotation.z = Math.PI / 2;
        }
      } else {
        magazine(mag, 0.265, 0.23, curve, steel);
        if (id === "aug") grip(g, -0.38, -0.11, furniture, 0.66);
      }
    }
    // Front furniture with handguard ribs and recessed cooling ports.
    const handLength = Math.max(0.16, barrel * 0.37),
      handZ = start - handLength * 0.22;
    if (id !== "p90")
      box(
        g,
        0,
        0.025,
        handZ,
        heavy ? 0.17 : 0.133,
        0.125,
        handLength,
        furniture,
        0,
        0.02,
      );
    for (let i = 0; i < Math.floor(handLength / 0.036); i++)
      for (const s of [-1, 1])
        box(
          g,
          s * (heavy ? 0.087 : 0.069),
          0.024,
          handZ - handLength / 2 + 0.022 + i * 0.036,
          0.004,
          0.033,
          0.022,
          dark,
          0,
          0.005,
        );
    cylinder(g, 0, 0.047, -barrel / 2 - 0.1, 0.021, barrel - 0.2, steel, true);
    const suppressed = w.suppressed,
      muzzle = -barrel - (suppressed ? 0.08 : 0);
    cylinder(
      g,
      0,
      0.047,
      suppressed ? muzzle + 0.08 : muzzle + 0.017,
      suppressed ? 0.046 : 0.031,
      suppressed ? 0.23 : 0.085,
      dark,
      true,
    );
    cylinder(
      g,
      0,
      0.047,
      muzzle - 0.027,
      suppressed ? 0.038 : 0.019,
      0.004,
      0x11231c,
      true,
    );
    if (suppressed)
      for (const z of [muzzle - 0.015, muzzle + 0.15])
        ring(g, 0, 0.047, z, 0.046, 0.004, 0x7c8d7f);
    if (pump) {
      cylinder(g, 0, -0.024, -barrel * 0.52, 0.027, barrel * 0.85, dark, true);
      const fore = joint(g, 0, 0, 0);
      fore.name = "pump";
      box(
        fore,
        0,
        -0.01,
        -barrel * 0.48,
        0.142,
        0.14,
        0.235,
        furniture,
        0,
        0.025,
      );
      for (let i = 0; i < 10; i++)
        box(
          fore,
          0,
          -0.005,
          -barrel * 0.48 - 0.105 + i * 0.022,
          0.147,
          0.142,
          0.006,
          dark,
          0,
          0.003,
        );
      if (id === "sawedoff") {
        cylinder(g, 0.027, 0.047, -0.38, 0.026, 0.39, steel, true);
        cylinder(g, -0.027, 0.047, -0.38, 0.026, 0.39, steel, true);
      }
    } else if (heavy) {
      box(mag, 0, -0.216, -0.054, 0.22, 0.265, 0.25, furniture, 0, 0.025);
      box(mag, 0, -0.105, -0.05, 0.235, 0.034, 0.268, dark, 0, 0.008);
      for (let i = 0; i < 7; i++) {
        const round = cylinder(
          mag,
          0.11 + Math.sin(i * 0.2) * 0.055,
          -0.02 - i * 0.032,
          -0.08,
          0.014,
          0.102,
          material(0xc3ab65, 0.72),
          true,
        );
        box(
          mag,
          0.102 + Math.sin(i * 0.2) * 0.055,
          -0.02 - i * 0.032,
          -0.08,
          0.022,
          0.019,
          0.068,
          0x32473a,
          0,
          0.003,
        );
      }
      wire(
        g,
        [
          [0, 0.12, -0.18],
          [0, 0.27, -0.14],
          [0, 0.28, -0.01],
          [0, 0.12, 0.06],
        ],
        0x364d3d,
        0.017,
      );
      for (const s of [-1, 1])
        wire(
          g,
          [
            [s * 0.07, 0.01, -barrel * 0.64],
            [s * 0.15, -0.3, -barrel * 0.76],
            [s * 0.17, -0.32, -barrel * 0.78],
          ],
          0x647a67,
          0.014,
        );
    } else if (id === "bizon") {
      cylinder(mag, 0, -0.116, -0.22, 0.072, 0.43, furniture, true);
      for (const z of [-0.425, -0.02])
        ring(mag, 0, -0.116, z, 0.07, 0.009, 0x415b46);
    } else if (!bull) {
      magazine(
        mag,
        smg && ["mac10", "mp9", "mp7"].includes(id) ? 0.11 : -0.025,
        smg ? 0.31 : sniper ? 0.17 : 0.29,
        curve,
        steel,
      );
    }
    if (w.scoped) scope(g, sniper ? -0.06 : -0.14, dark, sniper);
    else if (id === "famas") {
      for (const z of [-0.28, 0.18])
        box(g, 0, 0.17, z, 0.05, 0.19, 0.038, steel, 0, 0.007);
      box(g, 0, 0.258, -0.05, 0.075, 0.045, 0.5, steel, 0, 0.011);
    } else {
      rail(g, start + 0.02, receiver - 0.035, steel);
      box(g, 0, 0.161, 0.12, 0.095, 0.035, 0.03, steel, 0, 0.004);
      ring(g, 0, 0.151, -barrel * 0.67, 0.032, 0.009, 0x4a6252);
      box(g, 0, 0.136, -barrel * 0.67, 0.013, 0.065, 0.021, steel, 0, 0.003);
      box(g, 0, 0.165, -barrel * 0.67, 0.01, 0.017, 0.026, 0xc7de9c);
    }
    if (id === "mp7") grip(g, -0.275, -0.16, dark, 0.67);
    box(bolt, 0.058, 0.035, 0.034, 0.014, 0.046, 0.14, dark, 0, 0.004);
    box(bolt, 0.069, 0.035, 0.02, 0.017, 0.02, 0.1, light, 0, 0.003);
    if (w.model === "bolt" || w.model === "scout") {
      wire(
        bolt,
        [
          [0.066, 0.04, 0.1],
          [0.104, -0.017, 0.1],
          [0.15, -0.041, 0.1],
        ],
        0x687e6b,
        0.009,
      );
      ellipsoid(bolt, 0.15, -0.041, 0.1, 0.024, 0.024, 0.024, dark);
    }
    for (const z of [start + 0.06, 0.133])
      for (const s of [-1, 1]) screw(g, s * 0.062, -0.007, z, light);
    if (w.model === "wood")
      for (const s of [-1, 1])
        for (let i = 0; i < 5; i++)
          wire(
            g,
            [
              [s * 0.055, -0.02 + i * 0.013, 0.33],
              [s * 0.056, -0.01 + i * 0.012, 0.41],
              [s * 0.055, -0.023 + i * 0.014, 0.55],
            ],
            0x795630,
            0.0018,
          );
    g.userData.muzzle = muzzle;
  }
  g.name = id;
  const muzzle = joint(
    g,
    0,
    0.047,
    g.userData.muzzle ?? -shapes[id][1] - 0.035,
  );
  muzzle.name = "muzzle";
  bake(g);
  return g;
}
