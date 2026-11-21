## Habitual


A simple Habit Tracker and College schedule manager. Runs entirely in the browser, with no build step or server.

## Run it

1. Unzip the project.
2. Open `index.html` in any modern browser.

## Project structure

- `index.html` - page markup (views, dialog, toast)
- `css/styles.css` - styling, light and dark themes
- `js/app.js` - state, rendering, storage, events

## Features

- **Today view:** week strip with previous/next week and a "Today" button, daily progress bar, category filters
- **Quick add:** add a one-off task for the selected day
- **Recurring tasks:** add or edit classes and habits with start/end times and repeat days
- **Timetable view:** all recurring tasks, filterable by day
- **Habit picker:** choose from preset habits and add them in one tap
- **Streaks:** consecutive completed days shown on recurring habits
- **Undo:** restore a task right after deleting it
- **Dark mode:** follows your system setting

## Data

Everything is saved in your browser's `localStorage`:

| Key | Contents |
| --- | --- |
| `habitual_templates` | Your tasks and recurring habits |
| `habitual_completions` | Which tasks were completed on which dates |

Data stays on your device. Clearing site data in your browser will erase it.

## Notes

- Works offline. The only external resource is the optional Google Font, which falls back to the system font.
- Tasks saved by the older single-file version are migrated automatically.
