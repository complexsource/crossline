import { COASTLINE, groundAt } from "../shared/maps.js";
import { overlaps, collisionCandidates } from "../shared/game.js";

// Authored tactical destinations; traversal waypoints between them are derived
// once from the exact static collision map, including multilevel/crouch routes.
export const PATROL_POINTS = [
  { x: 0, y: 0.24, z: 17 },
  { x: 0, y: 0.24, z: -2 },
  { x: 0, y: 0.24, z: -20 },
  { x: -24, y: 0, z: -17 },
  { x: 25, y: 0, z: -19 },
  { x: -10, y: 0, z: -12 },
  { x: 10, y: 0, z: -12 },
  { x: -18, y: 0, z: 20 },
  { x: 18, y: 0, z: 20 },
  { x: -36, y: 4.56, z: -5 },
  { x: 36, y: 4.56, z: -5 },
  { x: 0, y: 5.3, z: -32 },
  { x: 0, y: -1.3, z: 8 },
];
const walkable = new Set([
  "land",
  "canalFloor",
  "bridge",
  "waterstep",
  "stairs",
  "stairsLanding",
  "roof",
  "towerDeck",
  "dock",
]);
const horizontal = (x, z, b) =>
  Math.abs(x - b.x) < b.w / 2 + 0.319 && Math.abs(z - b.z) < b.d / 2 + 0.319;
const distance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z, a.y - b.y);
function surfaces(x, z) {
  const boxes = collisionCandidates(x, z),
    heights = [groundAt(x, z)];
  for (const b of boxes)
    if (walkable.has(b.type) && horizontal(x, z, b))
      heights.push(b.y + b.h / 2);
  return {
    boxes,
    heights: [...new Set(heights.map((y) => Math.round(y * 10000) / 10000))],
  };
}
function posture(x, y, z, boxes) {
  const p = { x, y, z };
  if (!boxes.some((b) => overlaps(p, b, 1.85))) return false;
  if (!boxes.some((b) => overlaps(p, b, 1.25))) return true;
  return null;
}
// Match the movement controller's 0.3 m step-up. Small samples prevent paths
// cutting diagonally through walls or jumping between stacked floor levels.
export function walkSegment(a, b) {
  const steps = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / 0.16));
  let y = a.y,
    crouch = !!a.crouch;
  for (let i = 1; i <= steps; i++) {
    const x = a.x + ((b.x - a.x) * i) / steps,
      z = a.z + ((b.z - a.z) * i) / steps;
    const { boxes, heights } = surfaces(x, z);
    const next = Math.max(...heights.filter((h) => h <= y + 0.301));
    if (!Number.isFinite(next) || y - next > 0.65) return null;
    const low = posture(x, next, z, boxes);
    if (low === null) return null;
    crouch ||= low;
    y = next;
  }
  return Math.abs(y - b.y) < 0.04 ? { crouch } : null;
}
class Heap {
  items = [];
  push(id, cost) {
    const value = { id, cost },
      a = this.items;
    let i = a.length;
    a.push(value);
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (a[p].cost <= cost) break;
      a[i] = a[p];
      i = p;
    }
    a[i] = value;
  }
  pop() {
    const a = this.items,
      first = a[0],
      last = a.pop();
    if (a.length) {
      let i = 0;
      while (i * 2 + 1 < a.length) {
        let c = i * 2 + 1;
        if (c + 1 < a.length && a[c + 1].cost < a[c].cost) c++;
        if (a[c].cost >= last.cost) break;
        a[i] = a[c];
        i = c;
      }
      a[i] = last;
    }
    return first;
  }
}
class Navigation {
  constructor() {
    this.nodes = [];
    this.cells = new Map();
    this.searches = 0;
    this.expansions = 0;
    const maxX = Math.floor(COASTLINE.bounds.x),
      maxZ = Math.floor(COASTLINE.bounds.z);
    for (let x = -maxX; x <= maxX; x++)
      for (let z = -maxZ; z <= maxZ; z++) {
        const { boxes, heights } = surfaces(x, z),
          nodes = [];
        for (const y of heights) {
          const crouch = posture(x, y, z, boxes);
          if (crouch === null) continue;
          const node = { id: this.nodes.length, x, y, z, crouch, edges: [] };
          nodes.push(node);
          this.nodes.push(node);
        }
        if (nodes.length) this.cells.set(`${x}/${z}`, nodes);
      }
    for (const a of this.nodes)
      for (const [dx, dz] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
        [1, 1],
        [1, -1],
        [-1, 1],
        [-1, -1],
      ])
        for (const b of this.cells.get(`${a.x + dx}/${a.z + dz}`) || []) {
          if (Math.abs(a.y - b.y) > 1) continue;
          const edge = walkSegment(a, b);
          if (edge)
            a.edges.push({
              id: b.id,
              crouch: edge.crouch,
              cost: distance(a, b) * (edge.crouch ? 1.5 : 1),
            });
        }
    this.patrol = PATROL_POINTS.map((p) => this.nearest(p)).filter(Boolean);
  }
  nearest(point) {
    let best = null,
      score = Infinity;
    for (let dx = -4; dx <= 4; dx++)
      for (let dz = -4; dz <= 4; dz++)
        for (const n of this.cells.get(
          `${Math.round(point.x) + dx}/${Math.round(point.z) + dz}`,
        ) || []) {
          const d = distance(n, point);
          if (d < score) {
            score = d;
            best = n;
          }
        }
    return best;
  }
  path(from, to) {
    const start = this.nearest(from),
      end = this.nearest(to);
    if (!start || !end) return [];
    if (start === end)
      return [{ x: end.x, y: end.y, z: end.z, crouch: end.crouch }];
    this.searches++;
    const heap = new Heap(),
      costs = new Map([[start.id, 0]]),
      parents = new Map(),
      visited = new Set();
    heap.push(start.id, distance(start, end));
    while (heap.items.length && visited.size < 5000) {
      const { id } = heap.pop();
      if (visited.has(id)) continue;
      visited.add(id);
      if (id === end.id) {
        this.expansions += visited.size;
        const path = [];
        let cursor = id;
        while (cursor !== start.id) {
          const parent = parents.get(cursor),
            n = this.nodes[cursor];
          path.push({ x: n.x, y: n.y, z: n.z, crouch: parent.crouch });
          cursor = parent.id;
        }
        path.push({ x: start.x, y: start.y, z: start.z, crouch: start.crouch });
        return path.reverse();
      }
      for (const edge of this.nodes[id].edges) {
        const cost = costs.get(id) + edge.cost;
        if (cost >= (costs.get(edge.id) ?? Infinity)) continue;
        costs.set(edge.id, cost);
        parents.set(edge.id, { id, crouch: edge.crouch });
        heap.push(edge.id, cost + distance(this.nodes[edge.id], end));
      }
    }
    this.expansions += visited.size;
    return [];
  }
  cover(from, threat, visible) {
    let best = null,
      score = Infinity;
    // Bounded sampling, not a per-frame search over the complete map.
    for (const radius of [2, 4, 6])
      for (let i = 0; i < 8; i++) {
        const angle = (i * Math.PI) / 4;
        const node = this.nearest({
          x: from.x + Math.cos(angle) * radius,
          z: from.z + Math.sin(angle) * radius,
          y: from.y,
        });
        if (
          !node ||
          Math.abs(node.y - from.y) > 1 ||
          visible(threat, { ...node, y: node.y + 1.03 })
        )
          continue;
        const d = distance(from, node);
        if (d < score && d > 0.7) {
          score = d;
          best = node;
        }
      }
    return best;
  }
}
let navigation;
export function getBotNavigation() {
  return (navigation ||= new Navigation());
}
