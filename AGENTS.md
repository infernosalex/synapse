# AGENTS.md

Operating manual for AI agents in this repo. Rules are imperative.

## Project

Monorepo.
`backend/` is Python 3.14 + FastAPI (managed by `uv`, async, Postgres + Redis + taskiq, agents on LangChain/LangGraph).
`frontend/` is React 19 + TS + Vite + Tailwind 4 (TanStack Router/Query, react-hook-form + zod).
User stories: `docs/USER_STORIES.md`. Project board: `scripts/project.sh`.
See `README.md` for the file tree and `package.json` / `pyproject.toml` for the canonical command list — don't invent commands.

## Code style

- Defer to ruff (Python) and prettier + eslint (TS). Never hand-format.
- Python: type-annotate everything, mypy is strict, no implicit `Any`. Async in `app/api/`, `app/services/`, `app/agents/` — no blocking I/O in handlers; offload to taskiq. Pydantic at boundaries, plain types inside. SQLAlchemy 2.0 only, never raw SQL with user input. Use `structlog` with key/value pairs, no f-strings in log messages, no `print`. Raise specific exceptions; never bare `except`.
- TS: no `any` (use `unknown` + narrowing). Named exports. Function components, hooks at top. Validate external data with `zod` at the boundary. Server state via TanStack Query; no global state library. Tailwind utilities inline; extract a component before extracting a class. Files: components `PascalCase.tsx`, hooks `useThing.ts`, else `kebab-case.ts`.

## Comments — write like a senior engineer

Most agent comments are noise. Only write a comment if it would survive senior code review.

**Do:**

- Explain *why* a non-obvious decision was made (constraints, trade-offs, perf, security).
- Document invariants on public APIs.
- Link to issues/RFCs/vendor docs when behavior is dictated by them.
- Wrap comment text at natural sentence/clause boundaries, not at a fixed column width. A long line is fine; a mid-sentence line break is not.

**Don't:**

- Don't restate the code (`# increment i`, `// set the user`).
- Don't write changelog/diary comments (`# updated to use async`, `// refactored from previous version`, `# AI: changed per request`).
- Don't use decorative banners (`# ===== HELPERS =====`). Use real structure.
- Don't leave `TODO`/`FIXME` without an issue link or owner.
- Don't comment-out dead code "just in case." Delete it; git remembers.
- Don't write docstrings that repeat the function name (`"""Get the user."""`).
- Don't narrate obvious control flow (`# loop through users`).

## Repository layout

Match existing structure; do not invent top-level folders.

- Backend: routes `app/api/`, models `app/models/`, persistence `app/db/`, logic `app/services/`, agents `app/agents/`, tests `tests/{unit,integration,evals}/`.
- Frontend: routes `src/pages/`, UI `src/components/`, hooks `src/hooks/`, clients `src/services/`.

## Codegen — do not edit by hand

`frontend/src/types/api/` is generated from `backend/openapi.json`. After backend model changes, run `npm run api:sync` from `frontend/` and commit the diff. CI's `npm run api:check` fails on drift.

## Testing

New behavior gets tests; bug fixes get a regression test. Backend uses `pytest` (`asyncio_mode = "auto"`); split tests into `unit/`, `integration/`, or `evals/` (the last marked `agent_eval`, excluded by default). Frontend uses `vitest` + `@testing-library/react` — test behavior, not implementation. Mock external services (`respx` backend, fetch mocks frontend); never hit real APIs in CI.

## Tooling discipline

- `uv` only (not pip/poetry/pipx). `npm` only (not yarn/pnpm/bun).
- Don't introduce alternative tools (black, isort, biome, etc.).
- Don't add or bump dependencies without a stated reason.

## Hooks (lefthook)

Pre-commit runs ruff/prettier/eslint and re-stages; pre-push runs tests. Don't bypass with `--no-verify` unless asked. If a hook fails, fix the cause, not the hook.

## Git & commits

Conventional Commits: lowercase, imperative, no trailing period. Allowed types: `feat`, `fix`, `chore`, `ci`, `docs`, `test`, `refactor`, `perf`, `build`, `style`. Optional scope: `backend`, `frontend`, or a module name. See `git log` for tone.

- Only commit when explicitly asked. Stage the files you changed; never `git add -A` blindly.
- Never commit `.env`, secrets, dumps, or build artifacts.
- Never `--force` push to `main`. Don't amend commits you didn't author this session.

## Working rules

- **Plan first** for non-trivial changes: state goal, list files to touch, flag risks (migrations, codegen drift, breaking API). Use the todo tool for multi-step work and update it as you go.
- **Stay in scope.** Do exactly what was asked. No drive-by refactors, formatting passes on untouched files, or "while I'm here" cleanups. Mention unrelated issues; don't fix them silently.
- **Search before writing.** Reuse existing utilities — API client in `frontend/src/services/`, config via `backend/app/config.py`, logging via the configured `structlog`, auth via `fastapi-users`.
- **Prefer editing over creating.** Don't create README/NOTES/EXAMPLE files unless asked. Use `/tmp` for scratch work.
- **Verify before "done."** Backend: `ruff check`, `mypy app`, `pytest`. Frontend: `lint`, `typecheck`, `test`. API model changes: `api:sync`. Quote the output. Don't claim success on a red build.
- **Ask, don't guess** for: schema/migration changes, breaking API shape changes, new dependencies, auth/secrets/rate-limit (`slowapi`) changes, CI/Docker/deploy changes, anything affecting cost (model choice, search quotas).

## Project board

Managed via `scripts/project.sh` (run with no args for usage). Reference user-story IDs (`US-###`) from `docs/USER_STORIES.md`, or `"N/A (infrastructure)"` / `"N/A (documentation)"`. Statuses: exactly `Todo`, `In Progress`, `Done`. Move cards as work progresses.

## Security defaults

- Never log secrets, tokens, or raw user input. Redact at the logger.
- No `eval`, `exec`, or `subprocess(shell=True)`.
- SQL only via SQLAlchemy with bound parameters.
- Validate external input at the boundary (pydantic / zod); trust types within.
- Secrets come from env via `pydantic-settings` (`backend/app/config.py`). Don't read `os.environ` elsewhere or hardcode keys.
