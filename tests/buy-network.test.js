import test from "node:test";
import assert from "node:assert/strict";
import { io } from "socket.io-client";
import { createGameServer } from "../server/index.js";
import { unpackSnapshot } from "../shared/snapshot.js";

test("real sockets: buy authorization, shared opening, hostile fields, late/stale requests and cleanup", async () => {
  let time = 100;
  const server = await createGameServer({
    production: true,
    loadHandshake: false,
    now: () => time,
  });
  await new Promise((resolve) => server.http.listen(0, "127.0.0.1", resolve));
  const clients = [],
    url = `http://127.0.0.1:${server.http.address().port}`;
  const connect = async () => {
    const c = io(url, { transports: ["websocket"], forceNew: true });
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
  try {
    const a = await connect(),
      b = await connect(),
      outsider = await connect();
    const { code } = await emit(a, "create", { name: "Host" });
    await emit(b, "join", { code, name: "Peer" });
    await emit(a, "choose", { ready: true });
    await emit(b, "choose", { ready: true });
    await emit(a, "start");
    const room = server.game.rooms.get(code),
      pa = room.players.get(a.id),
      pb = room.players.get(b.id);
    const request = (itemId) => ({
      itemId,
      spawnId: pa.spawnId,
      epoch: room.loadEpoch,
    });
    assert.equal(pa.buyUntil, 120);
    assert.equal(pb.buyUntil, 120);
    assert.equal(room.endsAt, 720);
    assert.equal(
      (await emit(outsider, "buy", { ...request("awp"), id: a.id })).ok,
      false,
    );
    for (const payload of [
      null,
      {},
      [],
      "awp",
      { ...request("awp"), epoch: "old" },
      { ...request("awp"), spawnId: 0 },
    ])
      assert.equal((await emit(a, "buy", payload)).ok, false);
    const peerWeapon = pb.weapon;
    assert.equal(
      (
        await emit(a, "buy", {
          ...request("awp"),
          id: b.id,
          hp: 999,
          ammo: { mag: 9999 },
        })
      ).ok,
      true,
    );
    assert.equal(pa.weapon, "awp");
    assert.equal(pa.ammo.awp.mag, 5);
    assert.equal(pa.hp, 100);
    assert.equal(pb.weapon, peerWeapon);
    assert.equal(
      (await emit(a, "buy", request("negev"))).ok,
      false,
      "server throttles repeat calls",
    );
    time += 0.2;
    const snapshot = new Promise((resolve) =>
      a.once("state", (data) => resolve(unpackSnapshot(data))),
    );
    assert.equal((await emit(a, "buy", request("deagle"))).ok, true);
    const state = await snapshot;
    assert.equal(state.remaining, 600);
    assert.ok(state.openingRemaining > 19);
    assert.equal(state.players.find((p) => p.id === a.id).buyAmmo, undefined);
    time = 120;
    assert.equal((await emit(a, "buy", request("negev"))).ok, false);
    server.game.spawn(room, pa);
    const old = request("awp");
    server.game.spawn(room, pa);
    assert.equal((await emit(a, "buy", old)).ok, false);
    assert.equal((await emit(a, "buy", request("previous"))).ok, true);
    time = pa.buyUntil;
    assert.equal((await emit(a, "buy", request("awp"))).ok, false);
    server.game.finish(room);
    assert.equal((await emit(a, "buy", request("awp"))).ok, false);
    await emit(a, "leave");
    await emit(b, "leave");
    assert.equal(server.game.rooms.size, 0);
  } finally {
    for (const c of clients) c.disconnect();
    await server.close();
  }
});
