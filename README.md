# pomodoro-agents

A small Pomodoro timer with a task list. Plain HTML, CSS and ES modules: no
dependencies and no build step. State is saved in `localStorage` under
`pomodoro.state.v1`, so reloading mid-session keeps the remaining time and the
task list, and a paused timer stays paused.

## Run it

ES modules need to be served over HTTP (opening `index.html` as a `file://`
URL will not load them). From the repository root, either:

```bash
python3 -m http.server 8000
```

or

```bash
npx serve .
```

then open http://localhost:8000 (or the address `serve` prints).

## Test

```bash
npm test
```

Runs the `node:test` suites in `test/` (Node 20+).

## Layout

- `src/timer.js`: pure timer transitions (`start`, `pause`, `reset`, `tick`, ...)
- `src/tasks.js`: pure task-list transitions
- `src/storage.js`: save/load through any `getItem`/`setItem` object
- `src/ui.js`: DOM wiring only
- `index.html`, `src/style.css`: the page
