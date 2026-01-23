# Copilot instructions for Pegaso Auto Video Viewer

This repository contains a single Userscript `pegaso.js` that automates completion of video lessons on Pegaso LMS pages. The guidance below focuses on discoverable, actionable project-specific patterns so an AI coding agent can be immediately productive.

## Big picture

- Single-file Userscript (IIFE) designed to run in the browser (Tampermonkey/Greasemonkey) on pages matching `https://lms.pegaso.multiversity.click/videolezioni/*`.
- Responsibilities: expand course sections, analyze each lesson row, build a queue of missing items (objectives first, then videos sorted by duration), and drive the video player until a completion threshold.
- No backend or build system—all runtime behavior is DOM-driven in the browser.

## Key files

- `pegaso.js` — the whole application. Read top-to-bottom to understand defaults, DOM selectors, and state management.

## Important runtime concepts & selectors

- Sections open: `.cursor-pointer.relative.align-middle` and containers with `.relative.text-platform-sub-text`.
- Lesson rows: `.pr-3.py-2` — each row is inspected for title, duration, progress and icons.
- Completion detection:
  - green/progress bars: selectors checking `path[fill="#00C49A"]`, `path[fill="#2FA33D"]`, or elements with `style*="width: 100%"` and class `bg-platform-green`.
  - objectives detected by `path[id="bullseye-arrow"]` or `.bg-platform-green\/20` or title `Obiettivi`.
- Video player: `video#video` — playback is controlled via the DOM element (muting, playbackRate, play(), currentTime, duration, `ended` event).

## Core logic patterns

- analyzeLessons(): creates `state.queue` combining objective items first, then videos sorted by `durationSeconds` ascending.
- processQueue(): runs objectives first, triggers a rescan, then runs videos. Videos are skipped on stalls or after a max timeout (3x duration or 180s fallback).
- handleVideo(): monitors progress and resolves when `CONFIG.REQUIRED_PERCENTAGE` is reached (default 92%).

## Configuration & persistence

- Defaults in `DEFAULT_CONFIG` (change in-file or via localStorage key `pegaso_automator_v3_config`). Important keys: `REQUIRED_PERCENTAGE`, `PLAYBACK_SPEED`, `AUTO_START`.
- Runtime logs and state saved to localStorage keys: `pegaso_missing_queue`, `pegaso_completed_log`.

## Developer workflows (how to run & debug)

- Quick manual test:
  1. Install Tampermonkey/Greasemonkey in your browser.
  2. Create a new userscript and paste `pegaso.js`.
  3. Navigate to a matching Pegaso course URL (`/videolezioni/*`).
  4. Open the console — look for `%c[PegasoBot]` logs and the floating control panel at the top-right.
- Debugging tips:
  - Use `console.log` with the existing `log()` helper to match format and color.
  - Inspect `localStorage` keys above to verify queue and completed items.
  - If selectors fail, edit the selector string in `pegaso.js` and re-save the userscript.

## Common edits and examples

- To change playback speed to 1.5x, update `DEFAULT_CONFIG.PLAYBACK_SPEED` or run in console:
  `localStorage.setItem('pegaso_automator_v3_config', JSON.stringify({...JSON.parse(localStorage.getItem('pegaso_automator_v3_config')||'{}'), PLAYBACK_SPEED:1.5})); location.reload();`
- To reduce completion threshold to 85% for faster runs: set `REQUIRED_PERCENTAGE: 85` in config.

## Safety, assumptions, and limitations

- Assumes lesson DOM structure matches current Pegaso LMS markup. If classes change, update selectors in `pegaso.js`.
- No network calls or external services — everything runs client-side on the page.
- Designed for interactive/manual validation; there are timeouts and stall-guards but no automated verification server-side.

## What to ask the maintainer when unsure

- Are there alternate course page templates we should support? (different selectors)
- Do you want persistent config UI or exportable settings (instead of localStorage keys)?

---

If you'd like, I can: (a) add a small `README.md` with Tampermonkey install steps, (b) add a short inline developer comment block in `pegaso.js` explaining selector invariants, or (c) wire a minimal settings editor in the UI. Which do you prefer?
