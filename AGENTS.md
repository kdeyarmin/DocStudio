# AGENTS.md

Instructions for Codex cloud and other AI coding agents working in this repository.

## Codex cloud environment

- Configure this repository in Codex cloud settings and use the default universal image unless a task needs a pinned runtime.
- Setup script:

  ```bash
  npm ci || npm install
  ```

- The root install runs the repo's postinstall workflow for subprojects. Keep app, runner, and shared dependency changes aligned.
- Store API keys, browser test credentials, service URLs, and other secrets in Codex environment variables or secrets. Do not commit `.env` files.

## Project shape

- This repository contains the main app and a Playwright runner.
- Run root commands from the repository root unless a task explicitly targets a subdirectory.
- Use npm. Do not introduce yarn or pnpm unless the package manager is intentionally changed.

## Commands

| Task | Command |
| --- | --- |
| Install | `npm ci` when a lockfile exists, otherwise `npm install` |
| App dev server | `npm run dev` |
| App build | `npm run build` |
| App lint | `npm run lint` |
| App typecheck | `npm run typecheck` |
| Full typecheck | `npm run typecheck:all` |
| Runner dev | `npm run runner:dev` |
| Runner build | `npm run runner:build` |
| Runner tests | `npm run runner:test` |
| Preview | `npm run preview` |

Before finishing a code change, run the smallest relevant checks first. For app changes, prefer `npm run typecheck`, `npm run lint`, and `npm run build`. For runner changes, include `npm run typecheck:playwright`, `npm run runner:build`, and `npm run runner:test` when the cloud environment has the needed browser dependencies.

## Working rules

- Keep generated app output, Playwright artifacts, traces, videos, and credentials out of git.
- If Playwright browser dependencies are missing, add them to the Codex environment setup rather than asking the user to run them locally.
- If validation cannot run because a required cloud secret or browser dependency is missing, state that clearly in the final response.
