// Self-contained snapshots: dropping a stale packet never breaks a delta chain.
// Keep simulation values untouched; quantisation only affects wire/display data.
const fields = [
  "id",
  "name",
  "team",
  "x",
  "y",
  "z",
  "vx",
  "vy",
  "vz",
  "yaw",
  "pitch",
  "crouch",
  "grounded",
  "jumpHeld",
  "hp",
  "armor",
  "weapon",
  "primary",
  "secondary",
  "slots",
  "grenades",
  "ammo",
  "reload",
  "respawn",
  "protected",
  "kills",
  "deaths",
  "headshots",
  "damage",
  "ping",
  "ack",
  "spawnId",
  "fireEpoch",
  "actionState",
  "action",
  "actionTime",
  "bot",
  "difficulty",
  "buyRemaining",
  "previousLoadout",
];
const rounded = new Set([
  "x",
  "y",
  "z",
  "vx",
  "vy",
  "vz",
  "reload",
  "respawn",
  "actionTime",
  "buyRemaining",
]);
export function packSnapshot(state) {
  return {
    ...state,
    v: 1,
    players: state.players.map((player) =>
      fields.map((key) =>
        rounded.has(key) ? Math.round(player[key] * 1000) / 1000 : player[key],
      ),
    ),
  };
}
export function unpackSnapshot(packet) {
  if (packet.v !== 1) return packet; // Allows development client/server rolling restart.
  const { v, ...state } = packet;
  state.players = packet.players.map((values) =>
    Object.fromEntries(fields.map((key, i) => [key, values[i]])),
  );
  return state;
}
