import test from "node:test";
import assert from "node:assert/strict";
import { io as connect } from "socket.io-client";
import { createGameServer } from "../server/index.js";
import { emptyInput } from "../shared/game.js";
import { unpackSnapshot } from "../shared/snapshot.js";

test("real sockets: rooms, ten clients, snapshots, input authority, separate-room isolation, results and disconnect", async () => {
  const server = await createGameServer({
    production: true,
    duration: 1.2,
    countdown: 0.1,
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
        .timeout(2000)
        .emit(event, data, (err, res) => (err ? reject(err) : resolve(res))),
    );
  const wait = (c, event, predicate = () => true) =>
    new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        c.off(event, on);
        reject(Error("Timed out: " + event));
      }, 3000);
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
    const host = await client();
    const created = await emit(host, "create", { name: "Host" });
    assert.equal(created.ok, true);
    const peers = [];
    for (let i = 1; i < 10; i++) {
      const peer = await client();
      peers.push(peer);
      assert.equal(
        (await emit(peer, "join", { name: "Peer " + i, code: created.code }))
          .ok,
        true,
      );
    }
    const extra = await client();
    assert.equal(
      (await emit(extra, "join", { name: "Extra", code: created.code })).ok,
      false,
    );
    const other = await emit(extra, "create", { name: "Other room" });
    assert.equal(other.ok, true);
    let leaked = false;
    extra.on("state", () => (leaked = true));
    assert.equal((await emit(peers[0], "start")).ok, false);
    for (const c of [host, ...peers]) await emit(c, "choose", { ready: true });
    const firstState = wait(host, "state");
    assert.equal((await emit(host, "start")).ok, true);
    const room = server.game.roomOf(host.id);
    assert.equal(room.state, "loading");
    for (const c of [host, ...peers])
      await emit(c, "loaded", { epoch: room.loadEpoch });
    const state = await firstState;
    assert.equal(state.players.length, 10);
    const own = state.players.find((p) => p.id === host.id);
    host.emit("input", {
      ...emptyInput(),
      seq: 1,
      spawnId: own.spawnId,
      x: 999,
      hp: 999,
    });
    const next = await wait(host, "state");
    assert.equal(next.players.find((p) => p.id === host.id).hp, 100);
    assert.notEqual(next.players.find((p) => p.id === host.id).x, 999);
    const results = await wait(host, "room", (r) => r.state === "results");
    assert.equal(results.results.players.length, 10);
    assert.equal(leaked, false);
    assert.equal((await emit(host, "return")).ok, true);
    const transfer = wait(peers[0], "room", (r) => r.host === peers[0].id);
    host.disconnect();
    assert.equal((await transfer).players.length, 9);
    for (const c of clients) c.disconnect();
    await new Promise((r) => setTimeout(r, 80));
    assert.equal(server.game.rooms.size, 0);
  } finally {
    for (const c of clients) c.disconnect();
    await server.close();
  }
});
