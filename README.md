# Synapse

AI-powered research and synthesis platform. Three collaborative agents — **Scout** (research), **Scribe** (synthesis), **Critic** (fact-checking) — turn a topic into a verified, cited report.

## Stack

- **Frontend:** React 19 + TypeScript + Tailwind 4 + Vite, with TanStack Router + Query, react-markdown, react-hook-form + zod, lucide-react.
- **Backend:** Python 3.14 + FastAPI (managed with [uv](https://docs.astral.sh/uv/)). Auth via fastapi-users + JWT. Background jobs via taskiq (Redis broker). Logging via structlog. PDF export via WeasyPrint.
- **Agents:** LangChain / LangGraph.
- **Models:** OpenRouter (per-agent model selection at request time).
- **Search:** Exa API (+ trafilatura for fallback article extraction).
- **Storage:** PostgreSQL 18 (reports, users) + Redis 8 (cache, queue, pubsub).

## Architecture

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the full set of Mermaid diagrams: component
architecture, the Scout → Scribe → Critic pipeline sequence (with event types), the LangGraph data
flow, and the database ERD.

```mermaid
flowchart LR
    FE["React frontend"] -->|"REST"| API["FastAPI"]
    FE <-->|"live events"| API
    API -->|"enqueue"| REDIS[("Redis")]
    REDIS --> W["taskiq worker"]
    W --> AG["Scout → Scribe → Critic<br/>(LangGraph)"]
    AG --> OR["OpenRouter"]
    AG --> EXA["Exa search"]
    AG --> PG[("PostgreSQL")]
```

## Documentation

- [User stories](docs/USER_STORIES.md) — product requirements and acceptance criteria (US-###).
- [Architecture](docs/ARCHITECTURE.md) — Mermaid diagrams (components, agent pipeline, data flow, ERD).
- [AI tools report](docs/AI_TOOLS.md) — how AI tools were used across each development phase.

## Repository layout

```
synapse/
├── backend/
│   ├── app/
│   │   ├── main.py                  # FastAPI app factory, CORS, lifespan, /health
│   │   ├── config.py                # pydantic-settings env loader
│   │   ├── agents/                  # scout, scribe, critic, orchestrator (stubs)
│   │   ├── api/                     # HTTP route handlers
│   │   ├── models/                  # Pydantic domain models
│   │   ├── services/                # business logic (job manager, source store)
│   │   ├── db/                      # SQLAlchemy models + Alembic migrations
│   │   └── scripts/
│   │       └── dump_openapi.py      # writes openapi.json for frontend codegen
│   ├── tests/
│   │   ├── conftest.py              # shared pytest fixtures (httpx ASGI client)
│   │   ├── unit/                    # fast deterministic tests
│   │   ├── integration/             # cross-component tests
│   │   └── evals/                   # LLM-as-judge agent evals (manual trigger)
│   ├── pyproject.toml
│   ├── uv.lock
│   ├── openapi.json               # generated contract for frontend codegen
│   ├── .python-version
│   ├── .dockerignore
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── main.tsx
│   │   ├── App.tsx
│   │   ├── index.css                # Tailwind 4 entry (@import "tailwindcss")
│   │   ├── components/              # presentational components
│   │   ├── pages/                   # route-level views
│   │   ├── hooks/                   # React hooks
│   │   ├── services/                # API client (REST + WebSocket)
│   │   ├── types/                   # shared TS types (api/ is codegen output)
│   │   └── test/                    # Vitest setup
│   ├── public/
│   ├── index.html
│   ├── openapi-ts.config.ts         # codegen config (reads ../backend/openapi.json)
│   ├── package.json
│   ├── tsconfig*.json
│   ├── vite.config.ts
│   ├── eslint.config.js
│   ├── .prettierrc.json
│   ├── .prettierignore
│   ├── .dockerignore
│   └── Dockerfile
├── docs/
│   ├── ARCHITECTURE.md             # Mermaid diagrams (components, pipeline, data flow, ERD)
│   ├── AI_TOOLS.md                 # AI tool usage across dev phases (deliverable)
│   └── USER_STORIES.md
├── .github/
│   ├── CODEOWNERS
│   └── workflows/
│       ├── ci.yml                   # lint, tests, build on every push/PR
│       └── evals.yml                # manual agent evals (workflow_dispatch)
├── docker-compose.yml               # postgres + redis + backend + frontend
├── lefthook.yml                     # pre-commit & pre-push hooks
├── .env.example
├── .gitignore
└── README.md
```

## Quickstart

```bash
cp .env.example .env       # fill in OPENROUTER_API_KEY, EXA_API_KEY
docker compose up --build
```

On first run, apply DB migrations after containers are up:

```bash
docker compose exec backend uv run alembic upgrade head
```

- Backend: <http://localhost:8000> (OpenAPI at `/docs`)
- Frontend: <http://localhost:5173>

### Local dev (without Docker)

`postgres` and `redis` are required for local backend + worker development.

Start infra services:

```bash
docker compose up -d postgres redis
```

Then point your local `.env` at localhost (the defaults are Docker service hostnames):

```bash
POSTGRES_HOST=localhost
DATABASE_URL=postgresql+asyncpg://synapse:synapse@localhost:5432/synapse
REDIS_URL=redis://localhost:6379/0
```

Apply database migrations before starting the API:

```bash
cd backend
uv run alembic upgrade head
```

**Backend:**

```bash
cd backend
uv sync
uv run uvicorn app.main:app --reload
```

Run the task worker in a second terminal (uses Redis as the broker):

```bash
cd backend
uv run taskiq worker app.tasks:broker
```

**Frontend:**

```bash
cd frontend
npm install
npm run dev
```

### Pre-commit hooks (one-time)

```bash
# install lefthook (pick one)
npm install -g lefthook       # or: mise use -g lefthook  / brew install lefthook

# wire it into the repo
lefthook install
```

Hooks auto-format and lint staged files; pre-push runs the test suites.

## Tests

```bash
# backend
cd backend && uv run pytest

# frontend
cd frontend && npm test
```

### Type-safe frontend client (codegen)

Codegen is automatic during frontend typecheck/build (`npm run build`) and CI
enforces that generated files are committed.

Manual sync (if you need it):

```bash
cd frontend && npm run api:sync
```

Generated types end up in `frontend/src/types/api/`. Do not edit by hand.
