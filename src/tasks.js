// Pure task-list transitions over the shared state (decision pomodoro.timer-state v1).

export function addTask(state, title, id) {
  const trimmed = String(title ?? "").trim();
  if (!trimmed) return state;
  return {
    ...state,
    tasks: [...state.tasks, { id, title: trimmed, done: false }],
    currentTaskId: state.currentTaskId ?? id,
  };
}

export function toggleTask(state, id) {
  if (!state.tasks.some((t) => t.id === id)) return state;
  return {
    ...state,
    tasks: state.tasks.map((t) => (t.id === id ? { ...t, done: !t.done } : t)),
  };
}

export function removeTask(state, id) {
  const index = state.tasks.findIndex((t) => t.id === id);
  if (index === -1) return state;
  const tasks = state.tasks.filter((t) => t.id !== id);
  let currentTaskId = state.currentTaskId;
  if (currentTaskId === id) {
    // Prefer the next undone task after the removed one, then wrap around.
    const ordered = [...tasks.slice(index), ...tasks.slice(0, index)];
    currentTaskId = ordered.find((t) => !t.done)?.id ?? null;
  }
  return { ...state, tasks, currentTaskId };
}

export function selectTask(state, id) {
  if (!state.tasks.some((t) => t.id === id)) return state;
  return { ...state, currentTaskId: id };
}

export function currentTask(state) {
  return state.tasks.find((t) => t.id === state.currentTaskId) ?? null;
}
