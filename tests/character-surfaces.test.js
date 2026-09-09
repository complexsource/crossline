import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { loft } from "../src/character-surfaces.js";

const rows = 12;
const segments = 20;
const profile = [
  [0, 0.08, 0.07],
  [0.2, 0.11, 0.09, 0.015, -0.005],
  [0.42, 0.09, 0.08, 0.04, -0.01],
];

function specimen(t, options = {}) {
  const material = new THREE.MeshBasicMaterial();
  const model = loft(new THREE.Group(), profile, material, {
    rows,
    segments,
    ...options,
  });
  model.updateMatrixWorld(true);
  t.after(() => {
    model.geometry.dispose();
    material.dispose();
  });
  return model;
}

function geometricEdges(geometry) {
  const positions = geometry.attributes.position;
  const indices = geometry.index;
  const edges = new Map();
  // UV and normal seams intentionally duplicate vertices. Weld positions only
  // for this topological check, normalizing near-zero floating-point residue.
  const positionKey = (index) =>
    [positions.getX(index), positions.getY(index), positions.getZ(index)]
      .map((value) => Math.round(value * 1e7))
      .join("/");
  for (let i = 0; i < indices.count; i += 3)
    for (let e = 0; e < 3; e++) {
      const key = [
        positionKey(indices.getX(i + e)),
        positionKey(indices.getX(i + ((e + 1) % 3))),
      ]
        .sort()
        .join("|");
      edges.set(key, (edges.get(key) || 0) + 1);
    }
  return edges;
}

test("character lofts are watertight by default with finite geometry", (t) => {
  const model = specimen(t);
  for (const name of ["position", "normal", "uv"])
    assert.ok(
      [...model.geometry.attributes[name].array].every(Number.isFinite),
      `${name} data must remain finite`,
    );
  const edges = geometricEdges(model.geometry);
  assert.ok(edges.size > 0);
  assert.ok(
    [...edges.values()].every((count) => count === 2),
    "each geometric edge belongs to exactly two triangles, including both end caps",
  );
  assert.equal(
    model.geometry.index.count / 3,
    rows * segments * 2 + segments * 2,
  );
});

test("loft caps have independent planar, outward-facing normals", (t) => {
  const model = specimen(t);
  const normals = model.geometry.attributes.normal;
  const sideVertices = (rows + 1) * (segments + 1);
  const capVertices = segments + 2;
  assert.equal(normals.count, sideVertices + capVertices * 2);
  for (const [cap, expectedY] of [
    [0, -1],
    [1, 1],
  ])
    for (let i = 0; i < capVertices; i++) {
      const vertex = sideVertices + cap * capVertices + i;
      assert.ok(Math.abs(normals.getX(vertex)) < 1e-6);
      assert.ok(Math.abs(normals.getY(vertex) - expectedY) < 1e-6);
      assert.ok(Math.abs(normals.getZ(vertex)) < 1e-6);
    }
  // Side shading must not inherit a flat cap normal through shared vertices.
  assert.ok(Math.abs(normals.getX(0)) > 0.5);
});

test("loft caps are front-face ray-hittable from outside both ends", (t) => {
  const model = specimen(t);
  for (const [origin, direction, height, normalY] of [
    [[0, -0.5, 0], [0, 1, 0], 0, -1],
    [[0.04, 0.9, -0.01], [0, -1, 0], 0.42, 1],
  ]) {
    const hits = new THREE.Raycaster(
      new THREE.Vector3(...origin),
      new THREE.Vector3(...direction),
    ).intersectObject(model);
    assert.ok(
      hits.length > 0,
      "an open or backward-facing cap would be missed",
    );
    assert.ok(Math.abs(hits[0].point.y - height) < 1e-6);
    assert.ok(Math.abs(hits[0].face.normal.y - normalY) < 1e-6);
  }
});

test("caps:false retains intentionally open loft profiles", (t) => {
  const open = specimen(t, { caps: false });
  const closed = specimen(t);
  assert.equal(
    open.geometry.attributes.position.count,
    (rows + 1) * (segments + 1),
  );
  assert.equal(
    closed.geometry.index.count - open.geometry.index.count,
    segments * 6,
  );
  const boundaryEdges = [...geometricEdges(open.geometry).values()].filter(
    (count) => count === 1,
  );
  assert.equal(boundaryEdges.length, segments * 2);
  const hits = new THREE.Raycaster(
    new THREE.Vector3(0.025, -0.5, 0),
    new THREE.Vector3(0, 1, 0),
  ).intersectObject(open);
  assert.equal(
    hits.length,
    0,
    "a center ray passes through the intentionally open tube",
  );
});
