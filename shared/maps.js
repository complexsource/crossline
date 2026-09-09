// COASTLINE: metres, Y-up. Collision and rendering share the same authoritative solids.
const B = (x, y, z, w, h, d, type = "wall", extra = {}) => ({
  x,
  y,
  z,
  w,
  h,
  d,
  type,
  ...extra,
});
const boxes = [];
const add = (...items) => boxes.push(...items);
function building(x, z, w, d, h, accent = 0x5b94b3, roof = "terracotta") {
  const group = `house-${x}-${z}`;
  // Long-side walls; wide opposing doors in the short-side walls.
  add(
    B(x, h / 2, z - d / 2, w, h, 0.45, "facade", { group, accent }),
    B(x, h / 2, z + d / 2, w, h, 0.45, "facade", { group, accent }),
  );
  for (const s of [-1, 1]) {
    for (const t of [-1, 1])
      add(
        B(
          x + (s * w) / 2,
          h / 2,
          z + t * (d / 4 + 0.65),
          0.45,
          h,
          d / 2 - 1.3,
          "facade",
          { group, accent },
        ),
      );
    add(
      B(x + (s * w) / 2, h - 0.65, z, 0.45, 1.3, 2.6, "archTop", {
        group,
        accent,
      }),
    );
  }
  add(
    B(x, h + 0.13, z, w + 0.5, 0.26, d + 0.5, "roof", { group, roof, accent }),
  );
}
function stairs(x, z, height, axis = "z", sign = 1, width = 2.4) {
  const n = Math.ceil(height / 0.24);
  for (let i = 0; i < n; i++) {
    const h = ((i + 1) * height) / n;
    add(
      B(
        x + (axis === "x" ? sign * i * 0.4 : 0),
        h / 2,
        z + (axis === "z" ? sign * i * 0.4 : 0),
        axis === "x" ? 0.4 : width,
        h,
        axis === "z" ? 0.4 : width,
        "stairs",
      ),
    );
  }
}
function crate(x, z, w = 2, h = 1.5, d = 2) {
  add(B(x, h / 2, z, w, h, d, "crate"));
}
function barrier(x, z, w, d = 1) {
  add(B(x, 0.6, z, w, 1.2, d, "lowwall"));
}
// Two land banks and a sunken traversable water channel. Bridges have real overhead collision.
add(
  B(-23, -0.65, 0, 40, 1.3, 72, "land"),
  B(23, -0.65, 0, 40, 1.3, 72, "land"),
  B(0, -0.65, -32, 6, 1.3, 8, "land"),
  B(0, -0.65, 32, 6, 1.3, 8, "land"),
  B(0, -1.6, 0, 6, 0.6, 56, "canalFloor"),
);
for (const z of [-20, -2, 17]) add(B(0, 0.12, z, 7.5, 0.24, 3.3, "bridge"));
// Water-channel stairs are below the ground datum, unlike rooftop stairs.
for (const z of [8, -11])
  for (const s of [-1, 1])
    for (let i = 0; i < 6; i++)
      add(
        B(
          s * (0.7 + i * 0.44),
          -1.3 + ((i + 1) * 0.22) / 2,
          z,
          0.44,
          (i + 1) * 0.22,
          2.2,
          "waterstep",
        ),
      );
building(-29, -8, 12, 10, 4.3, 0xb57561);
building(29, -8, 12, 10, 4.3, 0x4f8fb6);
building(-14, -27, 12, 7, 5, 0xb57561);
building(14, -27, 12, 7, 5, 0x4f8fb6);
building(-15, 5, 10, 8, 4.1, 0x829e77);
building(15, 5, 10, 8, 4.1, 0x4a8ca5);
building(-29, 17, 11, 7, 4.4, 0x65969e);
building(29, 17, 11, 7, 4.4, 0xbf8b67);
building(-13, 27, 11, 7, 4.3, 0xa38872);
building(13, 27, 11, 7, 4.3, 0x7b9d8a);
// A and B use different cover arrangements and a cross-map north rotation.
crate(-22, -18, 3, 1.6, 2);
crate(-31, -22, 2, 2.6, 2);
barrier(-17, -13, 4);
crate(21, -20, 2, 2.4, 2);
crate(30, -18, 3, 1.5, 2);
barrier(16, -14, 1, 5);
// Low, authored landmarks add useful cover while leaving the original routes open.
add(B(-27, 0.48, -19, 2.2, 0.96, 2.2, "courtyardFountain"));
add(B(27, 0.65, -24, 2.2, 1.3, 1.6, "harborMonument"));
for (const x of [-7, 7]) add(B(x, 0.45, -1.5, 1.8, 0.9, 1.1, "quayCover"));
crate(-10, -7, 1.8, 1.4, 2);
crate(10, -8, 2, 1.5, 1.7);
crate(-7, 12, 1.8, 1.3, 2);
crate(7, 12, 1.8, 1.3, 2);
barrier(-39, -3, 1, 8);
barrier(39, 1, 1, 8);
barrier(-22, 34, 8);
barrier(22, 34, 8);
stairs(-36.65, -13, 4.56, "z", 1, 2.6);
stairs(36.65, -13, 4.56, "z", 1, 2.6);
for (const x of [-36.65, 36.65])
  add(B(x, 2.28, -4.8, 2.9, 4.56, 2.4, "stairsLanding"));
// North tower platform, reached from a protected stair along the north bank.
add(B(0, 2.5, -32, 5, 5, 5, "tower"), B(0, 5.15, -32, 7, 0.3, 7, "towerDeck"));
stairs(-12.6, -32, 5.3, "x", 1, 2.2);
// Market stalls, dock cargo and decorative barrels all have matching collision.
for (const [x, z] of [
  [-20, 19],
  [-7, 23],
  [7, 23],
  [21, 19],
])
  add(B(x, 0.65, z, 2.3, 1.3, 1.4, "stall"));
for (const [x, z] of [
  [-35, 5],
  [35, 8],
  [-18, -22],
  [17, -18],
  [-22, 23],
  [34, 29],
])
  add(B(x, 0.65, z, 1, 1.3, 1, "barrel"));
add(B(38, 0.12, 28, 8, 0.24, 11, "dock"));
crate(36, 25, 1.6, 1.4, 1.6);
// Edge parapets/cliff boundaries prevent walking out of the play space.
for (const x of [-43.2, 43.2]) add(B(x, 1, 0, 0.5, 2, 73, "edge"));
for (const z of [-36.4, 36.4]) add(B(0, 1, z, 87, 2, 0.5, "edge"));
export const COASTLINE = {
  id: "coastline",
  name: "COASTLINE",
  category: "MEDITERRANEAN COAST",
  recommended: "6–10",
  minPlayers: 2,
  maxPlayers: 10,
  description:
    "Sunlit courtyards, winding coastal streets and a hidden water route. One island. Every angle matters.",
  preview: "/previews/coastline.webp",
  bounds: { x: 42.6, z: 35.8 },
  boxes,
  spawns: {
    soldiers: [
      { x: -38, z: 29 },
      { x: -38, z: 24 },
      { x: -33, z: 31 },
      { x: -26, z: 29 },
      { x: -20, z: 31 },
      { x: -40, z: 12 },
      { x: -23, z: 24 },
      { x: -32, z: 25 },
      { x: -22, z: 14 },
      { x: -8, z: 34 },
    ],
    terrorists: [
      { x: 38, z: 20 },
      { x: 37, z: 32 },
      { x: 33, z: 32 },
      { x: 26, z: 29 },
      { x: 20, z: 31 },
      { x: 40, z: 12 },
      { x: 23, z: 24 },
      { x: 32, z: 25 },
      { x: 22, z: 14 },
      { x: 8, z: 34 },
    ],
  },
  sites: { A: { x: -24, z: -18, radius: 6 }, B: { x: 25, z: -19, radius: 6 } },
  locations: [
    ["A Site", -24, -18],
    ["B Site", 25, -19],
    ["Mid", 0, -2],
    ["Long", 37, -11],
    ["Short", -20, 0],
    ["A Connector", -10, -12],
    ["B Connector", 10, -12],
    ["Soldier Spawn", -33, 29],
    ["Terrorist Spawn", 33, 29],
    ["Underpass / Water", 0, 8],
    ["Tower / Sniper", 0, -32],
    ["Market", -18, 20],
    ["Beach", -40, 24],
    ["Dock", 38, 28],
    ["Main Entrance", 0, 31],
  ],
};
export const MAPS = [COASTLINE];
export const getMap = (id) => COASTLINE;
export const validMap = (id) => id === "coastline";
export const groundAt = (x, z) =>
  Math.abs(x) < 3 && Math.abs(z) < 28 ? -1.3 : 0;
export const spawnHeight = (x, z) =>
  Math.max(
    groundAt(x, z),
    ...boxes
      .filter(
        (b) =>
          Math.abs(x - b.x) < b.w / 2 + 0.32 &&
          Math.abs(z - b.z) < b.d / 2 + 0.32 &&
          b.y + b.h / 2 <= 0.3,
      )
      .map((b) => b.y + b.h / 2),
  );
export const areaAt = (x, z) =>
  COASTLINE.locations.reduce((best, p) =>
    Math.hypot(x - p[1], z - p[2]) < Math.hypot(x - best[1], z - best[2])
      ? p
      : best,
  )[0];
export const surfaceAt = (x, z) =>
  Math.abs(x) < 3 && Math.abs(z) < 28
    ? "water"
    : x > 34 && z > 22
      ? "wood"
      : x < -37 && z > 18
        ? "sand"
        : "stone";
