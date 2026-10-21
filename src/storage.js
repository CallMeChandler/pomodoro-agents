// Persistence for the v1 state through any Storage-like object (getItem/setItem),
// so it works with window.localStorage and with a plain test double.

import { initialState } from "./timer.js";

export const STORAGE_KEY = "pomodoro.state.v1";

const MODES = ["work", "shortBreak", "longBreak"];
const STATUSES = ["idle", "running", "paused"];

function isValid(s) {
  return (
    s !== null &&
    typeof s === "object" &&
    s.version === 1 &&
    MODES.includes(s.mode) &&
    STATUSES.includes(s.status) &&
    Number.isFinite(s.remainingMs) &&
    (s.status === "running" ? Number.isFinite(s.endsAt) : s.endsAt === null) &&
    Number.isInteger(s.completedWork) &&
    Array.isArray(s.tasks) &&
    s.tasks.every(
      (t) => t && typeof t.id === "string" && typeof t.title === "string" && typeof t.done === "boolean",
    ) &&
    (s.currentTaskId === null || typeof s.currentTaskId === "string")
  );
}

export function serialize(state) {
  return JSON.stringify(state);
}

export function deserialize(text) {
  if (typeof text !== "string") return initialState();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    return initialState();
  }
  return isValid(data) ? data : initialState();
}

export function load(storage) {
  try {
    return deserialize(storage.getItem(STORAGE_KEY));
  } catch {
    return initialState();
  }
}

export function save(storage, state) {
  try {
    storage.setItem(STORAGE_KEY, serialize(state));
  } catch {
    // Storage full or blocked (e.g. private mode): keep running in memory.
  }
}
