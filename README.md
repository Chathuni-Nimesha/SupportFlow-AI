# SupportFlow AI

Workspace-scoped customer support platform with knowledge-grounded AI assistance for support agents.

## Overview

SupportFlow AI is a full-stack support console where agents manage conversations, tickets, and customers, maintain a publishable knowledge base, and draft replies with Gemini using retrieval-augmented generation (RAG).

Everything runs inside an authenticated, multi-tenant workspace. AI answers and suggested replies are grounded in published knowledge and reviewed by an agent before anything is sent—the system does not message customers on its own.

## Key Features

- **Auth & workspaces** — email/password register and login, JWT sessions, personal workspace on signup, active workspace selection
- **Conversations** — threads and messages with Open / Waiting / Closed / AI Resolved statuses and agent assignment
- **AI Assistant** — knowledge-grounded Q&A with source citations
- **Suggested replies** — drafts from the latest customer message; agent reviews, edits, and sends
- **Knowledge base** — draft/publish documents, ingest into the vector store, semantic search
- **Customers & tickets** — CRM directory plus status, priority, and assignment workflows
- **Team directory** — OWNER / ADMIN / AGENT roles for assignment and management (directory-only members do not sign in)
- **Global search** — workspace-scoped search across conversations, tickets, customers, and knowledge
- **Analytics** — conversation counts derived from the live inbox


## Technology Stack

| Layer | Stack |
|---|---|
| Frontend | React 19, TypeScript, Vite 6, Tailwind CSS, shadcn/ui, React Router, TanStack Query |
| Backend | Python 3.13, FastAPI, Uvicorn, Pydantic, Motor |
| Database | MongoDB (local or Atlas) |
| AI / RAG | Google Gemini; ChromaDB locally; MongoDB Atlas Vector Search in production |
| Auth | JWT (HS256), bcrypt, CORS allow-list, in-process rate limiting |
| Quality | pytest, Vitest, ESLint, GitHub Actions CI |
| Deploy | Separate Vercel frontend and backend projects |

| Environment | Vector store | Embeddings | Generation |
|---|---|---|---|
| Local (`VECTOR_STORE=chroma`) | ChromaDB | MiniLM (Chroma default) | Gemini |
| Production (`VECTOR_STORE=mongo`) | Atlas Vector Search | Gemini `gemini-embedding-001` (768-d) | Gemini |

Default chat model: `gemini-3.5-flash-lite` (overridable via `GEMINI_MODEL`).

## AI / RAG

```text
Knowledge → chunking → embeddings → vector retrieval → grounded Gemini response → sources
```

- Only **Published** documents are retrieved
- Retrieval is filtered by **`workspace_id`**
- Grounded answers include **source citations**
- Empty retrieval returns a safe no-answer response instead of inventing policy
- Suggested replies use the same path; agents review before sending

## Key Engineering Highlights

- Full-stack React + FastAPI application with a versioned REST API (`/api/v1`)
- MongoDB modeling, indexes, and service-layer business logic
- Multi-tenant isolation via server-resolved workspace (`default_workspace_id` + ACTIVE membership)—not JWT or client-supplied tenant IDs
- JWT authentication and OWNER / ADMIN / AGENT RBAC
- Dual RAG backends: Chroma for local development, Atlas Vector Search + Gemini embeddings in production
- Human-reviewed AI drafting for support workflows
- Automated tests and CI, plus a two-project Vercel deployment model

## Security

Implemented protections:

- bcrypt password hashing
- JWT Bearer auth (`localStorage` on the client)
- Server-side workspace resolution and `workspace_id` filtering on data and vectors
- Role checks for knowledge and team management
- CORS origin allow-list with credentials
- In-process rate limits on auth, AI, and search
- Production checks for non-placeholder JWT secrets and non-localhost Mongo URIs

## Project Structure

```text
SupportFlow-AI/
├── backend/              FastAPI (`main.py`), services, RAG, tests, vercel.json
├── frontend/             React + Vite SPA, vercel.json (SPA rewrite)
├── docs/
│   ├── deployment.md     Vercel / Atlas setup
│ 
└── README.md
```

## Local Setup

**Prerequisites:** Python 3.13, Node.js 20.19.0, MongoDB, ChromaDB on port 8001, Gemini API key.

```powershell
Copy-Item backend\.env.example backend\.env
Copy-Item frontend\.env.example frontend\.env
```

Set `MONGODB_URI`, `MONGODB_DATABASE`, `JWT_SECRET`, and `GOOGLE_API_KEY` in `backend/.env`. Keep `VECTOR_STORE=chroma` locally. Frontend default: `VITE_API_BASE_URL=http://localhost:8000/api/v1`.

**Chroma** (repo root):
backend\.venv\Scripts\chroma.exe run `
  --path .\backend\chroma `
  --host localhost `
  --port 8001

**Backend** (from `backend/`):

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements-dev.txt
uvicorn main:app --reload --port 8000
```

**Frontend** (from `frontend/`):

```powershell
npm install
npm run dev
```

Open `http://localhost:5173` and register an account.

Optional development seed (blocked in production/Vercel):

```powershell
cd backend
python -m scripts.seed_demo_data --owner-email you@example.com --allow-non-localhost
```

See `backend/scripts/SEED_DEMO.md`.

## Testing

```powershell
# Backend (backend/, venv active)
pytest

# Frontend (frontend/)
npx tsc -p tsconfig.app.json --noEmit
npm test
npm run lint
```

Backend tests use mongomock and ephemeral Chroma—no live Mongo, Chroma, or Gemini required. CI runs backend pytest and frontend typecheck, Vitest, ESLint, and a production build.

## Production Deployment

Production runs as **two Vercel projects** (frontend SPA + FastAPI backend), backed by **MongoDB Atlas**, **Atlas Vector Search**, and **Gemini**. Set `VECTOR_STORE=mongo` on the backend; do not use Chroma on Vercel.

Full setup (env vars, vector index, SPA rewrite notes): **[docs/deployment.md](docs/deployment.md)**.

## Current Scope

**In scope today:** authenticated agent workspace, conversations, tickets, customers, knowledge base with RAG, AI assistant and suggested replies (human review), global search, analytics, JWT + RBAC, and dual-environment vector search.

**Outside current scope:** public customer chatbot, billing, SSO/OAuth, password reset, email invites/notifications, CSAT, and email/Slack channel ingestion. The MVP focuses on the internal support-agent workflow.

## Author

**Chathuni Nimesha**  
Software Engineer | Full Stack Developer

- Portfolio: [https://chathuni-nimesha.github.io/](https://chathuni-nimesha.github.io/)
