# Focus Flow

A simple Pomodoro-style focus timer with task tracking, built with vanilla HTML, CSS, and JavaScript — no build step, no dependencies.

## Features

- Focus / short break / long break timer modes with a progress ring
- Task list — add tasks, select one to focus on, mark done, delete
- Tracks completed pomodoros per task
- Daily streak counter
- State persisted locally in the browser (`localStorage`)

## Running locally

This is a static site, so any local web server works. A ready-made one is included for Windows:

```powershell
./serve.ps1
```

Then open [http://localhost:8934](http://localhost:8934) in your browser.

Alternatively, just open `index.html` directly in a browser, or serve the folder with any static file server of your choice.
