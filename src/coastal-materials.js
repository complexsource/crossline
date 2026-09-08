import * as THREE from "three";
const cache = new Map();
export function coastalMaterial(kind) {
  if (cache.has(kind)) return cache.get(kind);
  const c = document.createElement("canvas");
  c.width = c.height = 512;
  const x = c.getContext("2d"),
    rand = (n) => {
      const a = Math.sin(n * 127.1) * 43758.5453;
      return a - Math.floor(a);
    };
  if (kind === "paving") {
    x.fillStyle = "#9e9b88";
    x.fillRect(0, 0, 512, 512);
    for (let row = 0; row < 8; row++)
      for (let col = -1; col < 8; col++) {
        const value = rand(row * 21 + col),
          px = col * 80 + (row % 2) * 40,
          py = row * 64;
        x.fillStyle = `hsl(${39 + value * 5},${14 + value * 6}%,${67 + value * 9}%)`;
        x.beginPath();
        x.roundRect(px + 1, py + 1, 78, 62, 3);
        x.fill();
        x.strokeStyle = "#ece3ca44";
        x.lineWidth = 1;
        x.stroke();
      }
  } else if (kind === "wood") {
    x.fillStyle = "#a58055";
    x.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 128; i++) {
      x.strokeStyle = `rgba(71,60,39,${0.04 + rand(i) * 0.12})`;
      x.lineWidth = 0.5 + rand(i + 1) * 2;
      x.beginPath();
      for (let t = 0; t < 9; t++) {
        const yy = t * 64,
          xx = i * 4 + Math.sin(t * 0.7 + i) * 2;
        t ? x.lineTo(xx, yy) : x.moveTo(xx, yy);
      }
      x.stroke();
    }
  } else {
    x.fillStyle = "#ded5bf";
    x.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 9000; i++) {
      x.fillStyle = i % 2 ? "#a5998320" : "#fff3db35";
      x.fillRect(rand(i) * 512, rand(i + 91) * 512, 1 + rand(i + 32) * 3, 1);
    }
  }
  const map = new THREE.CanvasTexture(c);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.repeat.setScalar(kind === "paving" ? 8 : kind === "wood" ? 1 : 2);
  map.anisotropy = 4;
  const material = new THREE.MeshStandardMaterial({
    map,
    color: 0xffffff,
    roughness: kind === "wood" ? 0.65 : 0.86,
    bumpMap: map,
    bumpScale: kind === "paving" ? 0.028 : 0.008,
  });
  cache.set(kind, material);
  return material;
}
