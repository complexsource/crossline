import { WEAPONS, isFirearm } from "./weapons.js";

export const OPENING_BUY_SECONDS = 20;
export const RESPAWN_BUY_SECONDS = 10;
export const BUY_CATEGORIES = [
  {
    id: "RIFLE",
    name: "Rifles",
    description: "Versatile firepower. Own the middle distance.",
  },
  {
    id: "SMG",
    name: "SMGs",
    description: "Fast handling for close-quarter pressure.",
  },
  {
    id: "SHOTGUN",
    name: "Shotguns",
    description: "Make every close encounter count.",
  },
  {
    id: "SNIPER",
    name: "Snipers",
    description: "Precision for COASTLINE’s longer sightlines.",
  },
  {
    id: "HEAVY",
    name: "Heavy",
    description: "High-capacity firepower. Hold your angle.",
  },
  {
    id: "PISTOL",
    name: "Sidearms",
    description: "A dependable second option.",
  },
  {
    id: "GRENADE",
    name: "Grenades",
    description:
      "One of each per life. Selecting never refills spent equipment.",
  },
  {
    id: "EQUIPMENT",
    name: "Equipment",
    description: "Standard equipment and mode-specific devices.",
  },
];
export const BUY_ITEMS = Object.values(WEAPONS).map((w) => ({
  id: w.id,
  name: w.name,
  category: ["MELEE", "OBJECTIVE"].includes(w.type) ? "EQUIPMENT" : w.type,
  image: `/previews/weapons/${w.id}.webp`,
  available: w.id !== "bomb",
}));
export function itemStats(id) {
  const w = WEAPONS[id];
  if (isFirearm(id))
    return [
      [
        "DAMAGE",
        w.pellets > 1 ? `${w.damage} × ${w.pellets}` : String(w.damage),
      ],
      ["RPM", String(Math.round(60 / w.interval))],
      ["MAG", String(w.mag)],
      [
        "ACCURACY",
        `${Math.max(1, Math.round(100 * (1 - Math.min(1, w.spread / 0.12))))}/100`,
      ],
    ];
  return (
    {
      he: [
        ["EFFECT", "Blast"],
        ["FUSE", "2 s"],
      ],
      flash: [
        ["EFFECT", "Blind"],
        ["FUSE", "1.7 s"],
      ],
      smoke: [
        ["EFFECT", "Conceal"],
        ["DURATION", "15 s"],
      ],
      knife: [
        ["DAMAGE", "55"],
        ["RANGE", "2.5 m"],
      ],
      bomb: [
        ["MODE", "Bomb / Defuse"],
        ["STATUS", "Unavailable"],
      ],
    }[id] || []
  );
}
