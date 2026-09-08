import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, unlink, rmdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createGameServer } from "../server/index.js";
test("one append-only summary is saved per match, without recording live movement", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "crossline-stats-")),
    server = await createGameServer({
      production: true,
      loadHandshake: false,
      statsDirectory: dir,
    });
  const room = server.game.enter("a", "Alpha");
  server.game.enter("b", "Bravo", room.code);
  server.game.choose("a", { ready: true });
  server.game.choose("b", { ready: true });
  server.game.start("a");
  server.game.finish(room);
  server.game.finish(room);
  await server.close();
  const file = path.join(dir, "matches.jsonl"),
    lines = (await readFile(file, "utf8")).trim().split("\n");
  assert.equal(lines.length, 1);
  const result = JSON.parse(lines[0]);
  assert.equal(result.players.length, 2);
  assert.equal(result.players[0].x, undefined);
  assert.equal(result.players[0].damage, 0);
  await unlink(file);
  await rmdir(dir);
});
