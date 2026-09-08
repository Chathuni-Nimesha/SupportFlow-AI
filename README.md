# SupportFlow AI

An AI-powered **customer support workspace** for support agents.

SupportFlow AI helps an agent keep conversations in one inbox, publish a knowledge base, and generate **knowledge-grounded** answers and suggested replies. The agent reviews AI output before anything is sent.

This repository is a production-oriented AI customer-support workspace. There is no public customer chatbot and no billing yet.

---

## What this product includes

| Area | What works |
|---|---|
| Auth | Email/password register and login, JWT-protected workspace, logout |
| Conversations | Create threads, messages, replies, status (Open / Waiting / Closed / AI Resolved) |
| Knowledge | CRUD, Draft/Published, Chroma ingestion, semantic search |
| AI | RAG answers via Gemini, conversation suggested replies, source citations |
| Customers | Workspace-scoped customer directory with search, related conversations, and tickets |
| Tickets | Workspace-scoped tickets with status, priority, customer, and team-member assignment |
| Team | Workspace team directory with OWNER / ADMIN / AGENT roles for assignment and knowledge/team management. Directory members cannot sign in |
| Workspace | Active workspace selection, conversation-derived analytics, account display, light/dark theme |
| Isolation | Data is scoped to the selected workspace (`workspace_id`), resolved server-side |
| Health | `GET /health` reports process and MongoDB ping (`connected` / `disconnected`) |

**Intentionally not included yet:** public chatbot, email invitations, notifications, billing, SSO, Google OAuth, password reset, CSAT, email/Slack ingestion, autonomous sending.

**Available:** workspace-scoped global search across conversations, tickets, customers, and knowledge (`GET /api/v1/search`).

---

## Architecture

```mermaid
flowchart LR
  A["React / Vite frontend"] --> B["FastAPI REST API"]
  B --> C[(MongoDB)]
  B --> D[(ChromaDB)]
  D --> E["Gemini"]
  B --> E
  E --> A
```

| Layer | Role |
|---|---|
| Frontend | Agent UI at `http://localhost:5173` |
| FastAPI | REST API at `http://localhost:8000/api/v1` |
| MongoDB | Users, conversations, messages, knowledge documents, customers, tickets, team members |
| ChromaDB | Embedded knowledge chunks for semantic retrieval |
| Gemini | Grounded answer generation only (not embeddings) |

### RAG flow

```text
Knowledge document (MongoDB)
  → chunking
  → embeddings (Chroma DefaultEmbeddingFunction / MiniLM)
  → ChromaDB upsert
  → workspace-scoped semantic retrieval (Published only)
  → grounded Gemini generation
  → answer + sources
  → frontend
```

If retrieval returns no chunks, Gemini is not called. The API returns a safe “not enough information” answer.

### Conversation AI suggestion flow

```text
Latest customer message in the thread
  → same RAG pipeline (workspace-scoped published knowledge)
  → suggested reply + sources
  → agent reviews, optionally inserts into the composer, then sends
```

Suggestions are not sent automatically and are not stored as messages until the agent sends a reply.

---

## Technology stack

### Frontend

- React 19, TypeScript, Vite 6
- Tailwind CSS, shadcn/ui
- React Router, Axios
- Vitest, React Testing Library, Happy DOM

### Backend

- Python 3.13, FastAPI, Uvicorn
- MongoDB via Motor
- ChromaDB
- Google Gemini (`google-genai`), default model `gemini-3.5-flash-lite`
- JWT (`python-jose`), password hashing (passlib + bcrypt)
- pytest, pytest-asyncio, mongomock-motor, chromadb (tests / local Chroma; see `backend/requirements-dev.txt`)

Embeddings use Chroma’s local MiniLM function, not Gemini.

---

## Project structure

```text
SupportFlow-AI/
├── backend/                 FastAPI application
│   ├── app/
│   │   ├── api/v1/          Auth, conversations, customers, tickets, team, knowledge, AI routes
│   │   ├── auth/            JWT dependency
│   │   ├── config/          Settings from backend/.env
│   │   ├── core/            Security, logging, rate limiting
│   │   ├── database/        MongoDB + Chroma clients
│   │   ├── models/          Document helpers
│   │   ├── schemas/         Pydantic request/response models
│   │   └── services/        Auth, conversations, KB, RAG, Gemini
│   ├── tests/               pytest unit tests
│   ├── main.py              App entrypoint (`app` for Uvicorn/Vercel)
│   ├── vercel.json          Backend Vercel function config (no SPA rewrite)
│   ├── requirements.txt
│   ├── requirements-dev.txt
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── pages/           Routes including dashboard boards
│   │   ├── components/      UI and feature boards
│   │   ├── services/        Axios API clients
│   │   ├── context/         Auth + theme
│   │   └── routes/          React Router
│   ├── package.json
│   └── .env.example
├── docs/architecture/       Folder-structure notes
└── README.md
```

---

## Prerequisites

| Tool | Source in this repo |
|---|---|
| Python **3.13** | `backend/.python-version` |
| Node.js **20.19.0** | `frontend/.nvmrc` |
| npm | used by `frontend/package.json` |
| MongoDB | local server or Atlas (`MONGODB_URI`) |
| ChromaDB server | HTTP mode on port **8001** (default) |
| Gemini API key | `GOOGLE_API_KEY` (never commit the real value) |

No Docker Compose file is included. MongoDB and Chroma are started as their own processes (or Atlas for MongoDB).

---

## Environment setup

**Do not commit `backend/.env` or `frontend/.env`.** They are gitignored. Copy the examples, then fill in your own values.

### Backend

From the repository root (PowerShell):

```powershell
Copy-Item backend\.env.example backend\.env
```

Edit `backend/.env`. Required for a full demo:

| Variable | Purpose |
|---|---|
| `MONGODB_URI` | MongoDB connection string |
| `MONGODB_DATABASE` | Database name (`supportflow_ai` in the example) |
| `GOOGLE_API_KEY` | Gemini key (placeholder `your_google_gemini_api_key_here` is rejected) |
| `JWT_SECRET` | Signing secret (placeholder is allowed in development only) |

Useful defaults already in `.env.example`:

- API: `HOST=0.0.0.0`, `PORT=8000`, `API_PREFIX=/api/v1`
- CORS: development allows local Vite origins on ports 5173–5175 (and preview 4173). Production origins come from `CORS_ORIGINS` only — never `*` with credentials.
- Vector store: `VECTOR_STORE=chroma` (local Chroma). Vercel uses `VECTOR_STORE=mongo`.
- Chroma HTTP: `CHROMA_MODE=http`, `CHROMA_HOST=localhost`, `CHROMA_PORT=8001`
- Gemini model: `GEMINI_MODEL=gemini-3.5-flash-lite`

`backend/.env.example` shows an Atlas-style URI:

```text
MONGODB_URI=mongodb+srv://USER:PASSWORD@CLUSTER.mongodb.net/?appName=Cluster0
```

For a local MongoDB process, use:

```text
MONGODB_URI=mongodb://localhost:27017
```

Never put a real password, JWT secret, or API key in this README or in git.

### Frontend

```powershell
Copy-Item frontend\.env.example frontend\.env
```

`frontend/.env.example` contains:

```text
VITE_API_BASE_URL=http://localhost:8000/api/v1
```

That must match the running FastAPI prefix. **Development** (`npm run dev`) may use this localhost default. **Production builds** (`npm run build`) fail if `VITE_API_BASE_URL` is missing or set to localhost/loopback. Vite inlines this value at build time. Do not put secrets, MongoDB URIs, JWT secrets, or Gemini keys in frontend env files.

---

## Running MongoDB

The API uses Motor and pings MongoDB on startup (`backend/app/database/mongodb.py`).

- **Development:** if MongoDB is down, the API still starts and data routes return **503** until it is reachable. `GET /health` reports `degraded`.
- **Production (`APP_ENV=production`):** MongoDB connection and index setup must succeed or the process **refuses to start**. Localhost MongoDB URIs are rejected. `GET /health` is unchanged (`ok`/`connected` or `503`/`disconnected`) and never includes the URI.

**Option A — MongoDB Atlas**  
Use a `mongodb+srv://…` URI in `backend/.env` (URL-encode special characters in the password). This matches the template in `backend/.env.example`.

**Option B — local MongoDB**  
Run MongoDB Community/local so it accepts `mongodb://localhost:27017`, then set `MONGODB_URI` accordingly. There is no Docker definition in this repository.

---

## Running ChromaDB

Default config is **HTTP mode** (`CHROMA_MODE=http`) on **localhost:8001**.

Keep a Chroma server running for:

- Knowledge Base ingestion
- Semantic search
- AI Assistant
- AI suggested replies

From the **repository root**, using the backend virtualenv (Chroma CLI comes from the `chromadb` package):

```powershell
backend\.venv\Scripts\chroma.exe run --path .\backend\chroma --host localhost --port 8001
```

Equivalent after activating the venv:

```powershell
chroma run --path .\backend\chroma --host localhost --port 8001
```

`--path` is the Chroma **server** persist directory (`backend/chroma/` is gitignored). It is separate from `CHROMA_PERSIST_DIRECTORY=.chroma`, which is only used when `CHROMA_MODE=persistent` (in-process client, no HTTP server).

Leave this process running while you demo AI features.

---

## Production deployment

This is a two-process deploy: FastAPI + a static React SPA. There is no Docker image in this repository. Do not commit real secrets.

### Deploy on Vercel (two Hobby projects, $0)

Use **two** Vercel Hobby projects. Do not put the Vite SPA and the FastAPI API in one project: `frontend/vercel.json` rewrites unknown paths to `index.html`, which would hide `/api/v1` and `/health`.

Vercel Hobby does not require a credit card. Pair it with MongoDB Atlas M0 and Gemini free tier. Do not use Chroma Cloud.

**Backend project**

| Setting | Value |
|---|---|
| Root Directory | `backend` |
| Framework | FastAPI (auto-detected from `app` in `main.py`) |
| Build Command | leave empty |
| `backend/vercel.json` | `main.py` function, `maxDuration` 60s, **no** SPA rewrite |

Environment variables (Project Settings → Environment Variables). Never paste real values into git.

| Variable | Value |
|---|---|
| `APP_ENV` | `production` |
| `MONGODB_URI` | Atlas URI (not localhost) |
| `MONGODB_DATABASE` | e.g. `supportflow_ai` |
| `JWT_SECRET` | Unique non-placeholder secret |
| `GOOGLE_API_KEY` | Gemini key |
| `CORS_ORIGINS` | Exact frontend origin, e.g. `https://<frontend>.vercel.app` (never `*`) |
| `VECTOR_STORE` | `mongo` |

Optional with defaults: `GEMINI_MODEL`, `GEMINI_EMBEDDING_MODEL=gemini-embedding-001`, `GEMINI_EMBEDDING_DIMENSIONS=768`, `MONGO_VECTOR_COLLECTION=knowledge_vectors`, `MONGO_VECTOR_INDEX=knowledge_vectors_index`.

After the first backend deploy, note the URL (`https://<backend>.vercel.app`). Confirm `GET /health`.

**Frontend project**

| Setting | Value |
|---|---|
| Root Directory | `frontend` |
| Framework | Vite |
| Build Command | `npm run build` |
| Output | `dist` |
| `frontend/vercel.json` | SPA rewrite to `index.html` (this project only) |

Build-time environment variable:

| Variable | Value |
|---|---|
| `VITE_API_BASE_URL` | `https://<backend>.vercel.app/api/v1` |

Do not put `MONGODB_URI`, `JWT_SECRET`, or `GOOGLE_API_KEY` in the frontend project.

**Atlas (before a knowledge/AI demo)**

1. Allow Vercel egress in Atlas Network Access (M0 typically `0.0.0.0/0`).
2. Create the Vector Search index `knowledge_vectors_index` on collection `knowledge_vectors` (Atlas UI; JSON is in **Backend environment** below). Wait until the index is Active.
3. Publish or `POST /api/v1/knowledge-documents/{id}/ingest` for knowledge documents. Chroma vectors are not migrated.

**Order:** deploy backend → set frontend `VITE_API_BASE_URL` → deploy frontend → ingest published knowledge.

### New empty MongoDB vs existing database

| Database | What to run |
|---|---|
| **New empty MongoDB** | Nothing extra. Registering a user creates a personal workspace and stamps `workspace_id`. Indexes are created on API startup. |
| **Existing database from earlier phases** | Dry-run, then run, from `backend/`: `python -m scripts.backfill_workspaces`, then `python -m scripts.reindex_knowledge_chroma`, then `python -m scripts.cleanup_owner_id`. Do **not** run these on startup. Skip them on a greenfield database. |

### Backend environment

Set these on the API host (`backend/.env` or the platform env). Never paste real values into git.

| Variable | Production requirement |
|---|---|
| `APP_ENV` | `production` |
| `JWT_SECRET` | Unique non-placeholder secret. Placeholder values refuse to start. |
| `MONGODB_URI` | Real Atlas or remote URI. Localhost / `127.0.0.1` is rejected. |
| `MONGODB_DATABASE` | Database name (example: `supportflow_ai`) |
| `CORS_ORIGINS` | Exact HTTPS frontend origin(s), comma-separated. Never `*`. |
| `GOOGLE_API_KEY` | Real Gemini key for AI answers/suggestions and (when `VECTOR_STORE=mongo`) embeddings. Not required to start the process. |
| `VECTOR_STORE` | `chroma` for local Chroma. `mongo` on Vercel (MongoDB Atlas Vector Search). |
| Chroma | Local only: `VECTOR_STORE=chroma` with `CHROMA_MODE=http` on loopback, or persistent/ephemeral. Vercel rejects Chroma and does not use Chroma Cloud. |

On Vercel, create one Atlas Vector Search index named `knowledge_vectors_index` on collection `knowledge_vectors` (Atlas UI; M0 cannot create this index from the app). JSON:

```json
{
  "fields": [
    {
      "type": "vector",
      "path": "embedding",
      "numDimensions": 768,
      "similarity": "cosine"
    },
    { "type": "filter", "path": "workspace_id" },
    { "type": "filter", "path": "status" }
  ]
}
```

Published knowledge must be ingested after switching to `VECTOR_STORE=mongo` (create/publish or `POST /api/v1/knowledge-documents/{id}/ingest`). Chroma vectors are not migrated.

Start **one** Uvicorn worker. Auth and AI/search rate limits are in-memory and **not** shared across workers.

```powershell
cd backend
.\.venv\Scripts\Activate.ps1
uvicorn main:app --host 0.0.0.0 --port 8000 --workers 1
```

Gate traffic on `GET /health`. `200` + `"database": "connected"` means MongoDB answered ping. The response does not include connection strings.

Put TLS in front of the API (platform proxy or reverse proxy). Do not mix an HTTPS frontend with an HTTP API in the browser.

### Frontend build

```powershell
cd frontend
$env:VITE_API_BASE_URL="https://api.example.com/api/v1"
npm run build
```

Serve `frontend/dist`. `VITE_API_BASE_URL` must be the public API origin including `/api/v1`. Localhost values fail the production build.

### SPA fallback (deep links)

React Router owns client routes such as `/dashboard`, `/dashboard/conversations`, `/dashboard/tickets`, `/dashboard/customers`, `/dashboard/knowledge-base`, plus query deep links `?ticket=`, `?customer=`, and `?conversation=`. The static host must serve `index.html` for those paths.

Shipped config (host-agnostic; does not change app behavior):

| File | Host |
|---|---|
| `frontend/vercel.json` | Vercel rewrite `/(.*) → /index.html` (existing files such as `/assets/*` are still served) |
| `backend/vercel.json` | FastAPI `app` in `main.py`, `maxDuration` 60s; no SPA rewrite |
| `frontend/public/_redirects` | Netlify `/* /index.html 200` (copied into `dist/` on build) |

Nginx equivalent:

```nginx
location / {
  try_files $uri $uri/ /index.html;
}
```

Without this fallback, refreshing `/dashboard/tickets?ticket=<id>` returns 404.

### Production checklist

1. `APP_ENV=production`, unique `JWT_SECRET`, non-localhost `MONGODB_URI`, `MONGODB_DATABASE`
2. `CORS_ORIGINS` = the HTTPS SPA origin
3. Build the SPA with a non-localhost `VITE_API_BASE_URL`
4. SPA fallback for dashboard routes and query deep links
5. One Uvicorn worker; `/health` returns 200
6. Chroma running before a knowledge/AI demo; `GOOGLE_API_KEY` set for Gemini
7. Migrations only when reusing an existing (pre-workspace) database

---

## Running the backend

The app object is `app` in `backend/main.py`. Imports are `from app.…`, so the working directory must be **`backend/`**. Do not run `uvicorn backend.main:app` from the repo root — that raises `ModuleNotFoundError: No module named 'app'` (or `backend`).

First-time setup:

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements-dev.txt
```

`requirements.txt` is the Vercel/runtime install (no Chroma). Local Chroma and pytest need `requirements-dev.txt`.

Start the API (port **8000**, matching settings / frontend base URL):

```powershell
cd backend
.\.venv\Scripts\Activate.ps1
uvicorn main:app --reload --port 8000
```

With `APP_DEBUG=true` in development, OpenAPI is at `http://localhost:8000/docs`. Production (`APP_ENV=production`) disables debug and docs regardless of `APP_DEBUG`.

---

## Running the frontend

```powershell
cd frontend
npm install
npm run dev
```

Vite is configured for **port 5173** (`frontend/vite.config.ts`) and opens the browser. The UI expects the API at `VITE_API_BASE_URL`.

Other scripts from `frontend/package.json`: `npm run build`, `npm run preview`, `npm test`.

---

## Complete startup order

Use four terminals. All four are required for the full AI demo.

**Terminal 1 — MongoDB**  
Atlas cluster running, or a local `mongod` accepting the URI in `backend/.env`.

**Terminal 2 — ChromaDB** (repo root)

```powershell
backend\.venv\Scripts\chroma.exe run --path .\backend\chroma --host localhost --port 8001
```

**Terminal 3 — Backend**

```powershell
cd backend
.\.venv\Scripts\Activate.ps1
uvicorn main:app --reload --port 8000
```

**Terminal 4 — Frontend**

```powershell
cd frontend
npm run dev
```

Open `http://localhost:5173`. Register a new account (do not use a shared hardcoded demo user).

---

## Recommended demonstration flow

This is the MVP path reviewers should follow.

1. Open the frontend (`http://localhost:5173`).
2. **Register** a new account (email + password). You will be signed in.
3. Confirm you land in the protected **dashboard**.
4. Open **Knowledge Base**.
5. **Create** a document with realistic support text (for example a 14-day refund policy). Do not rely on sample data shipped in the app — there is none for this flow.
6. Set status to **Published** and save so the document is **ingested** into Chroma (chunked and embedded). Confirm ingestion succeeded (indexed / chunk count).
7. Use **Semantic knowledge search** with a query that matches the document.
8. Open **Conversations**.
9. **Create** a conversation with an initial customer message that the knowledge can answer (for example “What is your refund window?”).
10. Assign an agent, optionally **create a ticket** from the thread, and open the linked ticket from the conversation.
11. Open the **AI suggestions** panel and generate a suggestion.
12. **Review** the draft and cited sources. The AI does not send it for you.
13. **Use suggestion** (or edit), then **send** as the agent.
14. Open **AI Assistant**.
15. Ask a question that the published document can answer.
16. Show the **answer and sources**. If Chroma is empty or the doc is still Draft, you should see the insufficient-knowledge message instead of invented policy.
17. Open **Analytics** and show **conversation counts** derived from the real inbox (not tickets or CSAT).

---

## Testing

Commands below match this repository. Run them from the directories shown. Do not treat unit-test counts as a live scoreboard; re-run after you change code.

**Frontend typecheck** (from `frontend/`):

```powershell
npx tsc -p tsconfig.app.json --noEmit
```

**Frontend unit tests** (from `frontend/`):

```powershell
npm test -- --run
```

(`package.json` maps `npm test` to `vitest run`.)

**Backend unit tests** (from `backend/`, with the venv):

```powershell
pip install -r requirements-dev.txt
.\.venv\Scripts\pytest.exe -q
```

Backend tests use mongomock, `VECTOR_STORE=chroma`, and ephemeral Chroma (`CHROMA_MODE=ephemeral` in `tests/conftest.py`). They do **not** require a live MongoDB, Chroma server, or Gemini key. Mongo vector-store tests mock Gemini embeddings.

GitHub Actions (`.github/workflows/ci.yml`) runs backend pytest and frontend TypeScript, Vitest, and ESLint. CI does not start MongoDB.

---

## Implemented vs unavailable

| Feature | Status |
|---|---|
| Email/password authentication | Working |
| Protected agent workspace | Working |
| Conversations + messages + status | Working |
| Knowledge Base CRUD + publish | Working |
| Chroma ingestion + semantic search | Working |
| AI Assistant (RAG) | Working |
| Gemini grounded generation | Working |
| AI suggested replies | Working |
| Conversation-derived analytics | Working |
| Account display + theme | Working |
| `owner_id` compatibility field | Retained as metadata; tenancy is `workspace_id` |
| Login/register rate limiting | Working |
| AI / knowledge-search rate limiting | Working — per user and per workspace, in-memory, configurable |
| List pagination | Working — `page` + `page_size` envelope on conversations, customers, tickets, team, knowledge documents. The conversation inbox UI still loads the first 100 threads |
| Health check | Working — `GET /health` |
| Conversation assignment | Working — `assigned_agent_id` must be an ACTIVE team member in the current workspace |
| Ticket and customer deep-links | Working — `/dashboard/tickets?ticket=` and `/dashboard/customers?customer=` |
| Tickets | Working — workspace-scoped CRUD, status/priority, assignment to team members |
| Customers (CRM) | Working — workspace-scoped directory, search, related conversations/tickets |
| Customer deletion | Working — blocked while tickets remain; conversations unlink and keep name/email snapshots |
| Team management | Working — workspace team directory (OWNER/ADMIN/AGENT). Directory members cannot sign in; email invitations are not sent |
| Notifications | Unavailable |
| Global search | Workspace-scoped search across conversations, tickets, customers, and knowledge (`GET /api/v1/search`) |
| Billing | Unavailable (MVP scope) |
| SSO | Unavailable (MVP scope) |
| Google OAuth | Unavailable (MVP scope) |
| Password reset | Unavailable (MVP scope) |
| Public customer chatbot | Unavailable (MVP scope) |

Sidebar pages for tickets, customers, and team are connected to live workspace-scoped APIs. Team is a workspace directory used for assignment and OWNER/ADMIN/AGENT authorization. Directory members cannot authenticate or sign in. Email invitations are not sent.

---

## Security (what is actually implemented)

- Passwords hashed with bcrypt (passlib)
- JWT access tokens (`HS256`, `JWT_EXPIRE_MINUTES`, default 60). Claims are `sub` (user id), `exp`, and `type=access` — no workspace or role
- Active workspace is `users.default_workspace_id`, selected via `POST /api/v1/workspaces/{workspace_id}/select` and resolved by `get_current_workspace`
- Mongo queries for customers, tickets, conversations, knowledge, and team members are filtered by `workspace_id`
- Chroma retrieval filtered by `workspace_id` and `status=Published`
- In-memory rate limits on login/register (process-local; defaults 30 and 20 requests / 60s)
- In-memory rate limits on AI answer/suggest (default 60 / 60s per user and 180 / 60s per workspace) and knowledge search (default 120 / 60s per user and 360 / 60s per workspace)
- CORS allow-list with credentials; development Vite ports 5173–5175; production origins from `CORS_ORIGINS` (wildcard rejected)
- `GET /health` reports MongoDB connectivity without exposing connection details
- Production (`APP_ENV=production`): refuses placeholder `JWT_SECRET`, refuses localhost `MONGODB_URI`, fails startup if MongoDB/indexes cannot initialize, disables debug/docs, rejects public unauthenticated Chroma HTTP hosts
- Passwords longer than 72 bytes are rejected (bcrypt limit)
- Secrets loaded from environment / `backend/.env` (not committed)

Not claimed: httpOnly cookie sessions, CSRF tokens, CSP, SSO, distributed rate limiting, or a hardened public Chroma ACL.

---

## Current limitations

- Conversations are **created by the signed-in agent**; there is no public customer intake channel.
- AI **assists**; it does not send replies or issue refunds on its own.
- Team invitations are not emailed. `INVITED` is a status flag only.
- Authorization uses the ACTIVE `team_members` role in the selected workspace. JWT does not carry `workspace_id` or `role`.
- `owner_id` is still stored for compatibility and is not the tenant boundary for migrated resources. Unique `(owner_id, email)` indexes are obsolete; drop leftovers with `python -m scripts.cleanup_owner_id` (not on startup).
- JWT is stored in the browser (`localStorage`).
- Auth and AI/search rate limiting is **per Uvicorn process**, not shared across workers.
- Conversation **messages** are not paginated (a thread is loaded as a unit; lists of conversations/customers/tickets/team/knowledge documents are).
- The conversation **inbox UI** loads the first 100 threads. Extra pages exist on the API but are not shown there.
- Customers with tickets cannot be deleted until those tickets are reassigned or removed. Conversations are unlinked, not deleted.
- Production SPA hosting needs `index.html` fallback (see `frontend/vercel.json` and `frontend/public/_redirects`).
- Automated tests are unit-level (mocked DB / ephemeral Chroma). There is no E2E suite against real MongoDB + Chroma + Gemini.

These are scope choices, not silent failures of the connected modules.

---

## Troubleshooting

### `ModuleNotFoundError: No module named 'app'`

Start Uvicorn from **`backend/`**: `uvicorn main:app --reload --port 8000`.  
Do not use `uvicorn backend.main:app` from the repository root.

### Network error on login / register

- Backend listening on port **8000**
- `VITE_API_BASE_URL=http://localhost:8000/api/v1`
- MongoDB reachable (`MONGODB_URI`)
- Frontend origin allowed in `CORS_ORIGINS`. Development also allows Vite on 5173–5175. If the UI is on another origin, add it to `CORS_ORIGINS`.

### AI returns no useful knowledge

- Chroma process running on **8001**
- Document **Published** and ingestion status **indexed**
- Query actually matches the published text
- `GOOGLE_API_KEY` set to a real key (not the example placeholder)

### Chroma connection errors

- `CHROMA_MODE=http`, `CHROMA_HOST=localhost`, `CHROMA_PORT=8001`
- `chroma run` still running with `--host localhost --port 8001`

### MongoDB errors / 503 on auth and lists

- `MONGODB_URI` and `MONGODB_DATABASE`
- Atlas IP allowlist, or local `mongod` running
- Special characters in Atlas passwords URL-encoded

---

## Local portfolio demo data (optional)

For realistic local screenshots, seed one development workspace with customers, conversations, tickets, team members, and published knowledge documents.

**Safety:** the seed refuses `APP_ENV=production` and Vercel. By default it also refuses a non-localhost `MONGODB_URI` unless you pass `--allow-non-localhost` (personal Atlas *dev* cluster only — never production).

Prerequisites: MongoDB reachable via `backend/.env`, and for RAG indexing Chroma running locally (`VECTOR_STORE=chroma`, default HTTP on port 8001) unless you use ephemeral/hash mode in tests.

Populate your **current** logged-in development workspace:

```powershell
cd backend
python -m scripts.seed_demo_data --owner-email you@example.com --allow-non-localhost
```

`--create-owner-if-missing` is off by default so the seed does not invent a new account.

---

## License and demo accounts

You can register your own local account, or use the optional local portfolio seed above for screenshots. The seed is development-only and must not be used against production.

Do not commit or paste:

- real `MONGODB_URI` credentials
- real `JWT_SECRET`
- real `GOOGLE_API_KEY`
- account passwords
