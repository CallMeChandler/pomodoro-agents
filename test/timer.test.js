import { test } from "node:test";
import assert from "node:assert/strict";
import {
  WORK_MS,
  SHORT_BREAK_MS,
  LONG_BREAK_MS,
  LONG_BREAK_EVERY,
  initialState,
  start,
  pause,
  reset,
  remaining,
  tick,
} from "../src/timer.js";

const T0 = 1_000_000;

// Freeze recursively so any mutation inside a transition throws.
function frozen(obj) {
  for (const v of Object.values(obj)) if (v && typeof v === "object") frozen(v);
  return Object.freeze(obj);
}

// Run the current phase to completion and return the next idle phase.
function finish(state, now) {
  const running = start(state, now);
  return tick(running, running.endsAt);
}

test("constants", () => {
  assert.equal(WORK_MS, 25 * 60 * 1000);
  assert.equal(SHORT_BREAK_MS, 5 * 60 * 1000);
  assert.equal(LONG_BREAK_MS, 15 * 60 * 1000);
  assert.equal(LONG_BREAK_EVERY, 4);
});

test("initialState matches the v1 shape", () => {
  assert.deepEqual(initialState(), {
    version: 1,
    mode: "work",
    status: "idle",
    remainingMs: WORK_MS,
    endsAt: null,
    completedWork: 0,
    tasks: [],
    currentTaskId: null,
  });
  assert.notEqual(initialState(), initialState());
  assert.notEqual(initialState().tasks, initialState().tasks);
});

test("start from idle sets running and endsAt", () => {
  const s = start(frozen(initialState()), T0);
  assert.equal(s.status, "running");
  assert.equal(s.endsAt, T0 + WORK_MS);
  assert.equal(s.remainingMs, WORK_MS);
});

test("start while running is a no-op", () => {
  const running = frozen(start(initialState(), T0));
  assert.equal(start(running, T0 + 5000), running);
});

test("pause stores remainingMs and clears endsAt", () => {
  const running = frozen(start(initialState(), T0));
  const paused = pause(running, T0 + 60_000);
  assert.equal(paused.status, "paused");
  assert.equal(paused.endsAt, null);
  assert.equal(paused.remainingMs, WORK_MS - 60_000);
});

test("pause when not running is a no-op", () => {
  const idle = frozen(initialState());
  assert.equal(pause(idle, T0), idle);
});

test("pause exactly at endsAt finishes the phase once", () => {
  const running = frozen(start(initialState(), T0));
  const s = pause(running, running.endsAt);
  assert.equal(s.mode, "shortBreak");
  assert.equal(s.status, "idle");
  assert.equal(s.remainingMs, SHORT_BREAK_MS);
  assert.equal(s.endsAt, null);
  assert.equal(s.completedWork, 1);
  // A later tick must not count the session again.
  assert.equal(tick(s, running.endsAt + 2_000_000), s);
});

test("pause after endsAt finishes the phase once", () => {
  const running = frozen(start(initialState(), 0));
  const s = pause(running, running.endsAt + 1);
  assert.equal(s.mode, "shortBreak");
  assert.equal(s.status, "idle");
  assert.equal(s.completedWork, 1);
  assert.deepEqual(tick(s, 2_000_000), s);
});

test("pause after the 4th work session's endsAt loads the long break", () => {
  let s = initialState();
  for (let i = 0; i < 6; i++) s = finish(s, T0);
  const running = start(s, T0);
  const p = pause(running, running.endsAt + 5000);
  assert.equal(p.mode, "longBreak");
  assert.equal(p.status, "idle");
  assert.equal(p.remainingMs, LONG_BREAK_MS);
  assert.equal(p.completedWork, 4);
});

test("pause 1 ms before endsAt still pauses normally", () => {
  const running = frozen(start(initialState(), T0));
  const p = pause(running, running.endsAt - 1);
  assert.equal(p.mode, "work");
  assert.equal(p.status, "paused");
  assert.equal(p.remainingMs, 1);
  assert.equal(p.completedWork, 0);
});

test("pause/resume preserves remaining time", () => {
  let s = start(initialState(), T0);
  s = pause(s, T0 + 10 * 60_000);
  // A long gap while paused must not consume time.
  s = start(frozen(s), T0 + 60 * 60_000);
  assert.equal(s.status, "running");
  assert.equal(remaining(s, T0 + 60 * 60_000), 15 * 60_000);
  assert.equal(s.endsAt, T0 + 60 * 60_000 + 15 * 60_000);
});

test("reset restores the current mode's full duration and keeps the rest", () => {
  let s = finish(initialState(), T0); // now shortBreak, completedWork 1
  s = { ...s, tasks: [{ id: "a", title: "x", done: false }], currentTaskId: "a" };
  s = pause(start(s, T0), T0 + 1000);
  const r = reset(frozen(s));
  assert.equal(r.status, "idle");
  assert.equal(r.mode, "shortBreak");
  assert.equal(r.remainingMs, SHORT_BREAK_MS);
  assert.equal(r.endsAt, null);
  assert.equal(r.completedWork, 1);
  assert.deepEqual(r.tasks, s.tasks);
  assert.equal(r.currentTaskId, "a");
});

test("remaining derives from endsAt while running", () => {
  const idle = initialState();
  assert.equal(remaining(idle, T0), WORK_MS);
  const running = start(idle, T0);
  assert.equal(remaining(running, T0 + 1500), WORK_MS - 1500);
  assert.equal(remaining(running, running.endsAt + 99), 0);
});

test("tick before endsAt returns the same state", () => {
  const running = frozen(start(initialState(), T0));
  assert.equal(tick(running, running.endsAt - 1), running);
  const idle = frozen(initialState());
  assert.equal(tick(idle, T0 + WORK_MS * 10), idle);
});

test("tick at endsAt moves work -> shortBreak, idle, not auto-started", () => {
  const running = frozen(start(initialState(), T0));
  const next = tick(running, running.endsAt);
  assert.equal(next.mode, "shortBreak");
  assert.equal(next.status, "idle");
  assert.equal(next.remainingMs, SHORT_BREAK_MS);
  assert.equal(next.endsAt, null);
  assert.equal(next.completedWork, 1);
});

test("tick after endsAt (e.g. after reload) still transitions", () => {
  const running = start(initialState(), T0);
  assert.equal(tick(running, running.endsAt + 3_600_000).mode, "shortBreak");
});

test("full 4-work cycle: 3 short breaks, then long break, then reset", () => {
  let s = initialState();
  const modes = [];
  let now = T0;
  for (let i = 0; i < 8; i++) {
    s = finish(frozen(s), now);
    now += 60 * 60_000;
    modes.push([s.mode, s.completedWork]);
  }
  assert.deepEqual(modes, [
    ["shortBreak", 1],
    ["work", 1],
    ["shortBreak", 2],
    ["work", 2],
    ["shortBreak", 3],
    ["work", 3],
    ["longBreak", 4],
    ["work", 0],
  ]);
  assert.equal(s.remainingMs, WORK_MS);
});

test("long break gets the long duration", () => {
  let s = initialState();
  for (let i = 0; i < 7; i++) s = finish(s, T0);
  assert.equal(s.mode, "longBreak");
  assert.equal(s.remainingMs, LONG_BREAK_MS);
});
