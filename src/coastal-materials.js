import * as THREE from "three";

// Deterministic shared tiles: small memory cost, no fetched art or per-prop maps.
const cache = new Map();
const random = (n) => {
  const v = Math.sin(n * 127.1 + 17.7) * 43758.5453;
  return v - Math.floor(v);
};
export function coastalMaterial(kind) {
  if (cache.has(kind)) return cache.get(kind);
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 512;
  const ctx = canvas.getContext("2d");
  const colors = {
    plaster: "#d9cfb3",
    warm: "#ddba8e",
    coral: "#bd755d",
    blue: "#83aebb",
    sage: "#a6b69a",
    ivory: "#e2d8be",
    wood: "#9c6c3f",
    stone: "#b4a282",
    paving: "#a69d86",
    tiles: "#b9653d",
    slate: "#547d90",
    sand: "#d5b77e",
    fabric: "#dbcba5",
    rock: "#a3987c",
  };
  ctx.fillStyle = colors[kind] || colors.plaster;
  ctx.fillRect(0, 0, 512, 512);
  if (["paving", "stone"].includes(kind)) {
    const rows = kind === "stone" ? 5 : 8,
      height = 512 / rows,
      width = kind === "stone" ? 122 : 82;
    for (let row = 0; row < rows; row++)
      for (let col = -1; col < 8; col++) {
        const v = random(row * 31 + col),
          px = col * width + (row % 2) * width * 0.5,
          py = row * height;
        ctx.fillStyle = `hsl(${36 + v * 7},${19 + v * 8}%,${kind === "stone" ? 58 + v * 12 : 63 + v * 12}%)`;
        ctx.beginPath();
        ctx.roundRect(px + 1.5, py + 1.5, width - 3, height - 3, 4);
        ctx.fill();
        ctx.strokeStyle = "#f0e3bc66";
        ctx.lineWidth = 1.2;
        ctx.stroke();
        ctx.fillStyle = "#4438240a";
        ctx.fillRect(px + 3, py + height - 7, width - 6, 4);
      }
  } else if (kind === "wood") {
    for (let i = 0; i < 84; i++) {
      ctx.strokeStyle = `rgba(47,31,17,${0.05 + random(i) * 0.13})`;
      ctx.lineWidth = 0.6 + random(i + 1) * 2.3;
      ctx.beginPath();
      for (let t = 0; t <= 16; t++) {
        const yy = t * 32,
          xx = i * 6.2 + Math.sin(t * 0.7 + i) * (1.4 + random(i) * 2);
        t ? ctx.lineTo(xx, yy) : ctx.moveTo(xx, yy);
      }
      ctx.stroke();
    }
    for (let i = 0; i < 7; i++) {
      ctx.fillStyle = "#4e321967";
      ctx.fillRect(i * 73, 0, 2, 512);
      ctx.fillStyle = "#e7bd7633";
      ctx.fillRect(i * 73 + 2, 0, 2, 512);
    }
  } else if (kind === "tiles" || kind === "slate") {
    for (let row = -1; row < 8; row++)
      for (let col = -1; col < 8; col++) {
        const px = col * 74 + (row % 2) * 37,
          py = row * 78,
          v = random(row * 37 + col);
        const g = ctx.createLinearGradient(px, py, px + 68, py);
        g.addColorStop(0, kind === "tiles" ? "#7e3b24" : "#355769");
        g.addColorStop(
          0.3,
          kind === "tiles" ? `hsl(20,51%,${49 + v * 9}%)` : "#628c9c",
        );
        g.addColorStop(0.73, kind === "tiles" ? "#c27b4e" : "#7799a7");
        g.addColorStop(1, kind === "tiles" ? "#8b442c" : "#3c6174");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.roundRect(px, py, 72, 76, [0, 0, 12, 12]);
        ctx.fill();
        ctx.strokeStyle = "#40251799";
        ctx.lineWidth = 2;
        ctx.stroke();
      }
  } else if (kind === "fabric") {
    for (let i = 0; i < 256; i++) {
      ctx.fillStyle = i % 2 ? "#fff2c82a" : "#7a715723";
      ctx.fillRect(i * 2, 0, 1, 512);
      ctx.fillRect(0, i * 2, 512, 1);
    }
  } else {
    for (let i = 0; i < 45; i++) {
      const px = random(i + 41) * 512,
        py = random(i + 82) * 512;
      const g = ctx.createRadialGradient(
        px,
        py,
        0,
        px,
        py,
        20 + random(i) * 90,
      );
      g.addColorStop(0, i % 2 ? "#725b3920" : "#fff0ce23");
      g.addColorStop(1, "#ffffff00");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 512, 512);
    }
  }
  for (let i = 0; i < 6500; i++) {
    ctx.fillStyle = i % 2 ? "#453b2512" : "#fff5dc18";
    ctx.fillRect(
      random(i + 37) * 512,
      random(i + 912) * 512,
      1 + random(i) * 2,
      1,
    );
  }
  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.repeat.setScalar(
    kind === "paving"
      ? 8
      : kind === "tiles" || kind === "slate"
        ? 2
        : kind === "stone"
          ? 2
          : 1,
  );
  map.anisotropy = 4;
  const mat = new THREE.MeshStandardMaterial({
    map,
    color: 0xffffff,
    roughness: kind === "wood" ? 0.75 : 0.88,
    bumpMap: map,
    bumpScale: ["tiles", "stone", "slate"].includes(kind)
      ? 0.045
      : kind === "paving"
        ? 0.026
        : 0.008,
  });
  cache.set(kind, mat);
  return mat;
}
