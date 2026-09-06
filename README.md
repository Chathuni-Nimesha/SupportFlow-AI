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

**Intentionally not included yet:** public chatbot, email invitations, notifications, global search, billing, SSO, Google OAuth, password reset, CSAT, email/Slack ingestion, autonomous sending.

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
- pytest, pytest-asyncio, mongomock-motor (tests)

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
│   ├── main.py              App entrypoint (`app` for Uvicorn)
│   ├── requirements.txt
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

That must match the running FastAPI prefix.

---

## Running MongoDB

The API uses Motor and pings MongoDB on startup (`backend/app/database/mongodb.py`). If MongoDB is down, the API still starts and data routes return **503** until it is reachable.

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

## Running the backend

The app object is `app` in `backend/main.py`. Imports are `from app.…`, so the working directory must be **`backend/`**. Do not run `uvicorn backend.main:app` from the repo root — that raises `ModuleNotFoundError: No module named 'app'` (or `backend`).

First-time setup:

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

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
.\.venv\Scripts\pytest.exe -q
```

Backend tests use mongomock and ephemeral Chroma (`CHROMA_MODE=ephemeral` in `tests/conftest.py`). They do **not** require a live MongoDB, Chroma server, or Gemini key.

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
| Global search | Unavailable (MVP scope) |
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
- Production (`APP_ENV=production`): refuses placeholder `JWT_SECRET`, disables debug/docs, rejects public unauthenticated Chroma HTTP hosts
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
- No production deploy config is shipped beyond environment flags.
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

## License and demo accounts

Register your own local account. This project does not ship a shared demo user.

Do not commit or paste:

- real `MONGODB_URI` credentials
- real `JWT_SECRET`
- real `GOOGLE_API_KEY`
- account passwords
