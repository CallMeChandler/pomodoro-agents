import { test } from "node:test";
import assert from "node:assert/strict";
import { initialState, start, pause, tick } from "../src/timer.js";
import { addTask, toggleTask } from "../src/tasks.js";
import { STORAGE_KEY, serialize, deserialize, load, save } from "../src/storage.js";

function memoryStorage(initial = {}) {
  const data = { ...initial };
  return {
    data,
    getItem: (k) => (k in data ? data[k] : null),
    setItem: (k, v) => {
      data[k] = String(v);
    },
  };
}

test("STORAGE_KEY", () => {
  assert.equal(STORAGE_KEY, "pomodoro.state.v1");
});

test("serialize/deserialize round trip", () => {
  const s = toggleTask(addTask(initialState(), "a", "1"), "1");
  assert.deepEqual(deserialize(serialize(s)), s);
});

test("deserialize falls back to initialState for missing data", () => {
  assert.deepEqual(deserialize(null), initialState());
  assert.deepEqual(deserialize(undefined), initialState());
  assert.deepEqual(deserialize(""), initialState());
});

test("deserialize falls back for invalid JSON", () => {
  assert.deepEqual(deserialize("{not json"), initialState());
  assert.deepEqual(deserialize("null"), initialState());
  assert.deepEqual(deserialize("42"), initialState());
});

test("deserialize falls back for version != 1", () => {
  const v2 = { ...initialState(), version: 2, completedWork: 3 };
  assert.deepEqual(deserialize(JSON.stringify(v2)), initialState());
  const noVersion = { ...initialState() };
  delete noVersion.version;
  assert.deepEqual(deserialize(JSON.stringify(noVersion)), initialState());
});

test("deserialize falls back for a malformed v1 shape", () => {
  const bad = [
    { ...initialState(), mode: "nap" },
    { ...initialState(), status: "running", endsAt: null },
    { ...initialState(), tasks: "nope" },
    { ...initialState(), tasks: [{ id: 1, title: "x", done: false }] },
    { ...initialState(), remainingMs: "25" },
  ];
  for (const s of bad) assert.deepEqual(deserialize(JSON.stringify(s)), initialState());
});

test("load returns initialState when nothing is stored", () => {
  assert.deepEqual(load(memoryStorage()), initialState());
});

test("load returns initialState when storage throws", () => {
  const broken = {
    getItem() {
      throw new Error("blocked");
    },
  };
  assert.deepEqual(load(broken), initialState());
});

test("save writes JSON under STORAGE_KEY", () => {
  const storage = memoryStorage();
  save(storage, initialState());
  assert.deepEqual(JSON.parse(storage.data[STORAGE_KEY]), initialState());
});

test("save swallows storage errors", () => {
  const full = {
    setItem() {
      throw new Error("QuotaExceededError");
    },
  };
  assert.doesNotThrow(() => save(full, initialState()));
});

test("save -> load round trip keeps a running timer's endsAt", () => {
  const storage = memoryStorage();
  const running = start(addTask(initialState(), "focus", "t1"), 1_000_000);
  save(storage, running);
  const loaded = load(storage);
  assert.deepEqual(loaded, running);
  assert.equal(loaded.endsAt, 1_000_000 + 25 * 60 * 1000);
});

test("save -> load round trip keeps a paused timer paused", () => {
  const storage = memoryStorage();
  const paused = pause(start(initialState(), 0), 60_000);
  save(storage, paused);
  assert.deepEqual(load(storage), paused);
});

test("save -> load round trip after a phase transition", () => {
  const storage = memoryStorage();
  const running = start(initialState(), 0);
  const next = tick(running, running.endsAt);
  save(storage, next);
  assert.deepEqual(load(storage), next);
});
