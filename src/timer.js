// Pure timer state transitions (decision pomodoro.timer-state v1).
// Every function takes the current state (and `now` in epoch ms where needed)
// and returns a new state. Nothing here reads the clock or mutates its input.

export const WORK_MS = 25 * 60 * 1000;
export const SHORT_BREAK_MS = 5 * 60 * 1000;
export const LONG_BREAK_MS = 15 * 60 * 1000;
export const LONG_BREAK_EVERY = 4;

const DURATIONS = {
  work: WORK_MS,
  shortBreak: SHORT_BREAK_MS,
  longBreak: LONG_BREAK_MS,
};

export function duration(mode) {
  return DURATIONS[mode];
}

export function initialState() {
  return {
    version: 1,
    mode: "work",
    status: "idle",
    remainingMs: WORK_MS,
    endsAt: null,
    completedWork: 0,
    tasks: [],
    currentTaskId: null,
  };
}

export function start(state, now) {
  if (state.status === "running") return state;
  return { ...state, status: "running", endsAt: now + state.remainingMs };
}

export function pause(state, now) {
  if (state.status !== "running") return state;
  // At or after endsAt the phase is already over: finish it instead of
  // freezing a 0 ms paused phase that tick would never complete.
  if (now >= state.endsAt) return tick(state, now);
  return {
    ...state,
    status: "paused",
    remainingMs: Math.max(0, state.endsAt - now),
    endsAt: null,
  };
}

export function reset(state) {
  return {
    ...state,
    status: "idle",
    remainingMs: duration(state.mode),
    endsAt: null,
  };
}

export function remaining(state, now) {
  if (state.status === "running") return Math.max(0, state.endsAt - now);
  return state.remainingMs;
}

export function tick(state, now) {
  if (state.status !== "running" || now < state.endsAt) return state;
  let mode;
  let completedWork = state.completedWork;
  if (state.mode === "work") {
    completedWork += 1;
    mode = completedWork >= LONG_BREAK_EVERY ? "longBreak" : "shortBreak";
  } else {
    if (state.mode === "longBreak") completedWork = 0;
    mode = "work";
  }
  return {
    ...state,
    mode,
    status: "idle",
    remainingMs: duration(mode),
    endsAt: null,
    completedWork,
  };
}
