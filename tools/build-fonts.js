// Vendor the existing OFL fonts so deployment never depends on Google at runtime.
import { mkdir, writeFile } from "node:fs/promises";
const url =
  "https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@500;600;700;800&family=Barlow:wght@400;500;600;700;800&display=swap";
const response = await fetch(url, {
  headers: {
    "User-Agent":
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36",
  },
});
if (!response.ok) throw Error(`Font stylesheet: ${response.status}`);
const css = await response.text(),
  blocks = [...css.matchAll(/\/\* latin \*\/\s*(@font-face\s*\{[^}]+\})/g)];
if (blocks.length !== 9) throw Error("Expected nine Latin font faces");
await mkdir("public/fonts", { recursive: true });
const local = [];
for (const [, block] of blocks) {
  const family = block.match(/font-family: '([^']+)'/)[1],
    weight = block.match(/font-weight: (\d+)/)[1];
  const remote = block.match(/url\(([^)]+)\)/)[1],
    name = `${family.toLowerCase().replaceAll(" ", "-")}-${weight}.woff2`;
  const r = await fetch(remote);
  if (!r.ok) throw Error(remote);
  await writeFile(`public/fonts/${name}`, Buffer.from(await r.arrayBuffer()));
  local.push(
    block
      .replace(remote, `/fonts/${name}`)
      .replace("display: swap", "display: optional"),
  );
}
await writeFile(
  "public/fonts/fonts.css",
  `/* Barlow / Barlow Condensed, SIL OFL 1.1. See OFL.txt. */\n${local.join("\n")}`,
);
const license = await fetch(
  "https://raw.githubusercontent.com/google/fonts/main/ofl/barlow/OFL.txt",
);
if (!license.ok) throw Error("Font license download failed");
await writeFile("public/fonts/OFL.txt", await license.text());
console.log("Vendored nine WOFF2 faces and OFL license.");
