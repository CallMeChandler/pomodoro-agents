// DOM wiring only: every state change goes through the pure functions in
// timer.js / tasks.js, then is saved and rendered.

import { LONG_BREAK_EVERY, start, pause, reset, remaining, tick } from "./timer.js";
import { addTask, toggleTask, removeTask, selectTask, currentTask } from "./tasks.js";
import { load, save } from "./storage.js";

const MODE_LABELS = { work: "Work", shortBreak: "Short break", longBreak: "Long break" };
const TICK_MS = 250;

const $ = (id) => document.getElementById(id);
const els = {
  currentTask: $("current-task"),
  mode: $("mode"),
  countdown: $("countdown"),
  start: $("start"),
  pause: $("pause"),
  reset: $("reset"),
  dots: $("sessions-dots"),
  sessions: $("sessions-label"),
  form: $("add-form"),
  input: $("task-title"),
  list: $("task-list"),
  empty: $("empty-tasks"),
  template: $("task-item"),
};

const storage = (() => {
  try {
    return window.localStorage;
  } catch {
    return null; // storage blocked: run in memory only
  }
})();

let state = storage ? load(storage) : load({ getItem: () => null });

function newId() {
  if (globalThis.crypto?.randomUUID) return crypto.randomUUID();
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

function formatMs(ms) {
  const totalSeconds = Math.ceil(ms / 1000);
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function commit(next) {
  if (next === state) return;
  state = next;
  if (storage) save(storage, state);
  render();
}

function renderClock() {
  const text = formatMs(remaining(state, Date.now()));
  els.countdown.textContent = text;
  document.title =
    state.status === "running" ? `${text} · ${MODE_LABELS[state.mode]}` : "Pomodoro";
}

function render() {
  const task = currentTask(state);
  els.currentTask.textContent = task ? task.title : "No task selected";
  els.currentTask.classList.toggle("has-task", Boolean(task));

  els.mode.textContent = MODE_LABELS[state.mode];
  document.body.dataset.mode = state.mode;

  els.start.disabled = state.status === "running";
  els.pause.disabled = state.status !== "running";
  els.start.textContent = state.status === "paused" ? "Resume" : "Start";

  const done = Math.min(state.completedWork, LONG_BREAK_EVERY);
  els.dots.textContent = "●".repeat(done) + "○".repeat(LONG_BREAK_EVERY - done);
  els.sessions.textContent = `${done} of ${LONG_BREAK_EVERY} sessions this cycle`;

  renderTasks();
  renderClock();
}

function renderTasks() {
  els.list.replaceChildren(
    ...state.tasks.map((t) => {
      const li = els.template.content.firstElementChild.cloneNode(true);
      li.dataset.id = t.id;
      li.classList.toggle("done", t.done);
      li.classList.toggle("current", t.id === state.currentTaskId);
      const box = li.querySelector(".done");
      box.checked = t.done;
      box.setAttribute("aria-label", `Mark "${t.title}" done`);
      li.querySelector(".title").textContent = t.title;
      const select = li.querySelector(".select");
      select.disabled = t.id === state.currentTaskId;
      select.textContent = t.id === state.currentTaskId ? "Current" : "Select";
      return li;
    }),
  );
  els.empty.hidden = state.tasks.length > 0;
}

els.start.addEventListener("click", () => commit(start(state, Date.now())));
els.pause.addEventListener("click", () => commit(pause(state, Date.now())));
els.reset.addEventListener("click", () => commit(reset(state)));

els.form.addEventListener("submit", (event) => {
  event.preventDefault();
  commit(addTask(state, els.input.value, newId()));
  els.input.value = "";
  els.input.focus();
});

els.list.addEventListener("click", (event) => {
  const li = event.target.closest("li");
  if (!li) return;
  const id = li.dataset.id;
  if (event.target.matches(".done")) commit(toggleTask(state, id));
  else if (event.target.matches(".select")) commit(selectTask(state, id));
  else if (event.target.matches(".delete")) commit(removeTask(state, id));
});

// Another tab changed the saved state: adopt it.
window.addEventListener("storage", () => {
  if (!storage) return;
  state = load(storage);
  render();
});

setInterval(() => {
  const next = tick(state, Date.now());
  if (next !== state) commit(next);
  else if (state.status === "running") renderClock();
}, TICK_MS);

// A phase that ended while the page was closed transitions right away.
commit(tick(state, Date.now()));
render();
