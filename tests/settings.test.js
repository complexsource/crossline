import test from "node:test";
import assert from "node:assert/strict";
import { readSettings, rebind, BINDINGS } from "../src/settings.js";
test("settings survive storage, malformed settings fall back, duplicate bindings are rejected", () => {
  const s = readSettings({ getItem: () => "{invalid" });
  assert.deepEqual(s.bindings, BINDINGS);
  assert.match(rebind(s, "reload", "KeyW"), /assigned/);
  assert.equal(s.bindings.reload, "KeyR");
  assert.equal(rebind(s, "reload", "KeyF"), null);
  assert.equal(s.bindings.reload, "KeyF");
  assert.match(rebind(s, "use", "Escape"), /reserved/);
  const saved = readSettings({
    getItem: () => JSON.stringify({ ...s, master: 0.2, crossSize: 10 }),
  });
  assert.equal(saved.master, 0.2);
  assert.equal(saved.crossSize, 10);
  assert.equal(saved.bindings.reload, "KeyF");
});
