import { test } from "node:test";
import assert from "node:assert/strict";
import { initialState } from "../src/timer.js";
import { addTask, toggleTask, removeTask, selectTask, currentTask } from "../src/tasks.js";

function frozen(obj) {
  for (const v of Object.values(obj)) if (v && typeof v === "object") frozen(v);
  return Object.freeze(obj);
}

function withTasks(...specs) {
  let s = initialState();
  for (const [id, done] of specs) {
    s = addTask(s, `task ${id}`, id);
    if (done) s = toggleTask(s, id);
  }
  return s;
}

test("addTask trims the title and appends an undone task", () => {
  const s = addTask(frozen(initialState()), "  Write report  ", "a");
  assert.deepEqual(s.tasks, [{ id: "a", title: "Write report", done: false }]);
});

test("addTask ignores empty and whitespace-only titles", () => {
  const s = frozen(initialState());
  assert.equal(addTask(s, "", "a"), s);
  assert.equal(addTask(s, "   \n\t", "a"), s);
  assert.equal(addTask(s, undefined, "a"), s);
});

test("first task becomes current; later tasks do not replace it", () => {
  let s = addTask(initialState(), "one", "a");
  assert.equal(s.currentTaskId, "a");
  s = addTask(frozen(s), "two", "b");
  assert.equal(s.currentTaskId, "a");
});

test("addTask sets current when none is selected even if tasks exist", () => {
  let s = withTasks(["a"]);
  s = { ...s, currentTaskId: null };
  assert.equal(addTask(s, "two", "b").currentTaskId, "b");
});

test("toggleTask flips done and leaves other tasks alone", () => {
  const s = frozen(withTasks(["a"], ["b"]));
  const t = toggleTask(s, "a");
  assert.equal(t.tasks[0].done, true);
  assert.equal(t.tasks[1].done, false);
  assert.equal(toggleTask(t, "a").tasks[0].done, false);
});

test("toggleTask with an unknown id is a no-op", () => {
  const s = frozen(withTasks(["a"]));
  assert.equal(toggleTask(s, "zzz"), s);
});

test("removeTask of a non-current task keeps current", () => {
  const s = frozen(withTasks(["a"], ["b"]));
  const r = removeTask(s, "b");
  assert.deepEqual(r.tasks.map((t) => t.id), ["a"]);
  assert.equal(r.currentTaskId, "a");
});

test("removeTask of current picks the next undone task", () => {
  // a (current), b done, c undone -> c
  const s = frozen(withTasks(["a"], ["b", true], ["c"]));
  assert.equal(removeTask(s, "a").currentTaskId, "c");
});

test("removeTask of current wraps to an earlier undone task", () => {
  let s = withTasks(["a"], ["b"], ["c", true]);
  s = frozen(selectTask(s, "b"));
  // after b: only c (done); wrap to a
  assert.equal(removeTask(s, "b").currentTaskId, "a");
});

test("removeTask of current sets null when no undone task remains", () => {
  const s = frozen(withTasks(["a"], ["b", true]));
  assert.equal(removeTask(s, "a").currentTaskId, null);
  assert.equal(removeTask(withTasks(["a"]), "a").currentTaskId, null);
});

test("removeTask with an unknown id is a no-op", () => {
  const s = frozen(withTasks(["a"]));
  assert.equal(removeTask(s, "zzz"), s);
});

test("selectTask switches current; unknown id is a no-op", () => {
  const s = frozen(withTasks(["a"], ["b"]));
  assert.equal(selectTask(s, "b").currentTaskId, "b");
  assert.equal(selectTask(s, "zzz"), s);
});

test("currentTask returns the task or null", () => {
  assert.equal(currentTask(initialState()), null);
  const s = withTasks(["a"], ["b"]);
  assert.deepEqual(currentTask(s), { id: "a", title: "task a", done: false });
  assert.equal(currentTask({ ...s, currentTaskId: "gone" }), null);
});

test("task functions keep timer fields intact", () => {
  const s = { ...initialState(), status: "running", endsAt: 123, completedWork: 2 };
  const r = toggleTask(addTask(s, "x", "a"), "a");
  assert.equal(r.status, "running");
  assert.equal(r.endsAt, 123);
  assert.equal(r.completedWork, 2);
});
