import * as THREE from "three";
import { loft, textile } from "./character-surfaces.js";
import { box, ellipsoid, joint, bake, material } from "./geometry.js";
function seam(parent, points, mat, radius, segments = 18) {
  const curve = new THREE.CatmullRomCurve3(
    points.map((p) => new THREE.Vector3(...p)),
  );
  const mesh = new THREE.Mesh(
    new THREE.TubeGeometry(
      curve,
      segments,
      radius,
      radius > 0.008 ? 12 : 6,
      false,
    ),
    mat,
  );
  mesh.userData.ownedGeometry = true;
  parent.add(mesh);
  return mesh;
}

// First-person anatomy is authored in weapon space: +Z goes toward the wrist,
// fingers wrap across the grip, not down the forearm as on the old generic glove.
export function viewHand(
  parent,
  { left = false, kind = "grip", rugged = false } = {},
) {
  const g = joint(parent, 0, 0, 0),
    cloth = textile(rugged ? 0x655340 : 0x556b58),
    rubber = textile(rugged ? 0x302b25 : 0x283c34, "leather"),
    thread = textile(rugged ? 0xac9878 : 0x91a58a),
    skin = material(0xbf8b68);
  const support = kind === "pistolSupport",
    open = kind === "open",
    wide = kind === "equipment" ? 1.35 : support ? 1.2 : 1;
  const palm = loft(
    g,
    [
      [-0.071, 0.014, 0.024, 0.059, 0.06],
      [-0.047, 0.024, 0.041, 0.061, 0.046],
      [0.004, 0.026, 0.048, 0.061, 0.032],
      [0.041, 0.022, 0.04, 0.058, 0.027],
      [0.059, 0.014, 0.028, 0.05, 0.025],
    ],
    cloth,
    { rows: 20, segments: 20, square: 2.7, folds: 0.012 },
  );
  palm.name = "palm";
  // The fleshy heel closes around the backstrap and joins the side of the palm;
  // leaving this volume out made both hands look like separate pincers.
  loft(
    g,
    [
      [-0.065, 0.02, 0.02, 0.038, 0.063],
      [-0.035, 0.044, 0.024, 0.023, 0.056],
      [0.009, 0.047, 0.024, 0.018, 0.053],
      [0.049, 0.026, 0.018, 0.025, 0.045],
    ],
    cloth,
    { rows: 16, segments: 20, square: 2.5, folds: 0.008 },
  );
  box(g, 0.087, -0.005, 0.035, 0.01, 0.071, 0.052, rubber, 0, 0.007);
  seam(
    g,
    [
      [0.09, 0.032, 0.017],
      [0.092, 0, 0.05],
      [0.082, -0.044, 0.075],
    ],
    thread,
    0.0012,
    16,
  );
  const fingers = [];
  for (let i = 0; i < 4; i++) {
    const y = 0.049 - i * 0.028,
      finger = joint(g, 0, 0, 0);
    finger.name = `finger${i}`;
    const trigger = i === 0 && kind === "grip";
    const path = trigger
      ? [
          [0.055, y, 0.011],
          [0.059, y + 0.009, -0.032],
          [0.052, y + 0.006, -0.073],
          [0.037, y - 0.004, -0.089],
        ]
      : [
          [0.058, y, 0.013],
          [0.055, y, -0.03 * wide],
          [0.015, y - 0.006, -0.057 * wide],
          [-0.034, y - 0.01, -0.041 * wide],
          [-0.047, y - 0.013, open ? -0.068 : 0.002],
        ];
    seam(finger, path, cloth, i === 3 ? 0.0105 : 0.012, 20);
    for (let j = 1; j < 3; j++) {
      const p = path[j];
      ellipsoid(finger, p[0], p[1] + 0.01, p[2], 0.013, 0.006, 0.012, rubber);
    }
    const end = path.at(-1);
    ellipsoid(finger, ...end, 0.0105, 0.0105, 0.011, rugged ? skin : cloth);
    fingers.push(finger);
  }
  seam(
    g,
    support
      ? [
          [0.058, 0.02, 0.047],
          [0.074, 0.032, 0.018],
          [0.074, 0.035, -0.028],
          [0.068, 0.033, -0.066],
        ]
      : [
          [0.054, 0.033, 0.05],
          [0.005, 0.047, 0.048],
          [-0.044, 0.048, 0.015],
          [-0.051, 0.043, -0.041],
        ],
    cloth,
    0.016,
    20,
  );
  box(g, 0.033, 0.067, 0.014, 0.03, 0.012, 0.027, rubber, 0, 0.005);
  const wrist = loft(
    g,
    [
      [0, 0.036, 0.032],
      [0.035, 0.038, 0.036],
      [0.09, 0.046, 0.043],
      [0.19, 0.052, 0.05, 0.008],
      [0.34, 0.064, 0.06, 0.014],
      [0.6, 0.078, 0.072, 0.02, 0.012],
    ],
    material(rugged ? 0xc89569 : 0xdba275),
    { rows: 30, segments: 20, folds: 0.006, square: 2.25, uvScale: 3 },
  );
  // The forearm is solved separately to a fixed off-screen elbow. Translating
  // a rigid sleeve with the reload hand would push its end cap into the camera.
  wrist.removeFromParent();
  g.userData.arm = wrist;
  g.userData.wrist = new THREE.Vector3(0.057, -0.054, 0.083);
  box(g, 0.057, -0.058, 0.1, 0.086, 0.073, 0.047, rubber, 0, 0.012);
  box(g, 0.058, -0.02, 0.101, 0.061, 0.014, 0.032, thread, 0, 0.005);
  // The underside support pose rotates the whole hand and wrist coherently.
  if (kind === "under") {
    g.rotation.x = Math.PI / 2;
    g.rotation.y = -0.08;
  }
  if (left) g.scale.x = -1;
  if (support) g.position.set(-0.012, -0.012, -0.026);
  g.userData.fingers = fingers;
  bake(g);
  return g;
}
const armStart = new THREE.Vector3(),
  armEnd = new THREE.Vector3(),
  up = new THREE.Vector3(0, 1, 0);
export function updateViewArms(g) {
  if (!g.userData.viewHands?.length) return;
  g.updateMatrixWorld(true);
  for (const { hand, left } of g.userData.viewHands) {
    const arm = hand.userData.arm;
    armStart.copy(hand.userData.wrist);
    hand.localToWorld(armStart);
    g.worldToLocal(armStart);
    armEnd.set(left ? -0.27 : 0.34, -0.72, 0.04);
    g.worldToLocal(armEnd);
    arm.position.copy(armStart);
    armEnd.sub(armStart);
    arm.scale.set(1, armEnd.length() / 0.6, 1);
    arm.quaternion.setFromUnitVectors(up, armEnd.normalize());
  }
}
