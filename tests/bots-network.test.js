import test from "node:test";
import assert from "node:assert/strict";
import { io as connect } from "socket.io-client";
import { createGameServer } from "../server/index.js";
import { unpackSnapshot } from "../shared/snapshot.js";

test("real sockets: bot authorization, capacity, solo handshake, replay, host transfer and cleanup", async () => {
  const server = await createGameServer({
    production: true,
    countdown: 0.05,
    duration: 1,
  });
  await new Promise((resolve) => server.http.listen(0, "127.0.0.1", resolve));
  const url = `http://127.0.0.1:${server.http.address().port}`,
    clients = [];
  const client = async () => {
    const c = connect(url, { transports: ["websocket"], forceNew: true });
    clients.push(c);
    await new Promise((resolve, reject) => {
      c.once("connect", resolve);
      c.once("connect_error", reject);
    });
    return c;
  };
  const emit = (c, event, data = {}) =>
    new Promise((resolve, reject) =>
      c
        .timeout(3000)
        .emit(event, data, (err, result) =>
          err ? reject(err) : resolve(result),
        ),
    );
  const wait = (c, event, predicate = () => true) =>
    new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        c.off(event, on);
        reject(Error(`Timed out: ${event}`));
      }, 5000);
      function on(data) {
        if (event === "state") data = unpackSnapshot(data);
        if (predicate(data)) {
          clearTimeout(timeout);
          c.off(event, on);
          resolve(data);
        }
      }
      c.on(event, on);
    });
  try {
    const host = await client(),
      peer = await client();
    const created = await emit(host, "create", {
      name: "Host",
      playerLimit: 2,
    });
    assert.ok(created.ok);
    for (const value of [null, { difficulty: "impossible" }, { team: "bogus" }])
      assert.equal((await emit(host, "addBot", value)).ok, false);
    const added = await emit(host, "addBot", { difficulty: "hard" });
    assert.ok(added.ok);
    const room = server.game.rooms.get(created.code),
      bot = room.players.get(added.id);
    assert.equal(
      (await emit(peer, "join", { name: "Peer", code: created.code })).ok,
      false,
    );
    assert.equal((await emit(host, "addBot")).ok, false);
    assert.equal(
      (
        await emit(peer, "configureBot", {
          botId: bot.id,
          difficulty: "easy",
          host: host.id,
        })
      ).ok,
      false,
    );
    await emit(host, "choose", { ready: true });
    await emit(host, "start");
    assert.equal(room.state, "loading");
    assert.equal(bot.loaded, true);
    const statePromise = wait(host, "state");
    await emit(host, "loaded", { epoch: room.loadEpoch });
    const state = await statePromise;
    assert.equal(state.players.length, 2);
    assert.equal(state.players.find((p) => p.id === bot.id).difficulty, "hard");
    assert.equal(
      server.io.sockets.sockets.size,
      2,
      "bots create no fake network sockets",
    );
    const weapon = bot.weapon;
    peer.emit("action", { id: bot.id, type: "switch", value: "knife" });
    const state2 = await wait(host, "state");
    assert.equal(state2.players.find((p) => p.id === bot.id).weapon, weapon);
    assert.equal(
      (await emit(host, "removeBot", { botId: bot.id })).ok,
      false,
      "cannot remove during match",
    );
    const results = await wait(host, "room", (r) => r.state === "results");
    assert.equal(
      results.results.players.find((p) => p.id === bot.id).bot,
      true,
    );
    assert.equal((await emit(host, "return")).ok, true);
    await emit(host, "configure", { playerLimit: 3 });
    assert.equal(
      (await emit(peer, "join", { name: "Peer", code: created.code })).ok,
      true,
    );
    for (const event of ["addBot", "removeBot", "configureBot"])
      assert.equal(
        (await emit(peer, event, { botId: bot.id, difficulty: "easy" })).ok,
        false,
        event,
      );
    const transfer = wait(peer, "room", (r) => r.host === peer.id);
    host.disconnect();
    await transfer;
    assert.equal(
      (
        await emit(peer, "configureBot", {
          botId: bot.id,
          difficulty: "easy",
          team: "soldiers",
        })
      ).ok,
      true,
    );
    assert.equal(bot.difficulty, "easy");
    assert.equal(bot.primary, "m4a4");
    await emit(peer, "choose", { ready: true });
    await emit(peer, "start");
    const replay = wait(peer, "state");
    await emit(peer, "loaded", { epoch: room.loadEpoch });
    await replay;
    assert.equal(room.code, created.code);
    assert.equal(bot.kills, 0);
    peer.disconnect();
    await new Promise((resolve) => setTimeout(resolve, 100));
    assert.equal(server.game.rooms.size, 0);
    assert.equal(server.game.members.size, 0);
  } finally {
    for (const c of clients) c.disconnect();
    await server.close();
  }
});
