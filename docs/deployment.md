# Production deployment notes

Companion to the root [README](../README.md). Secrets must never be committed.

## Vercel (two projects)

Use **two** Hobby projects. Do not combine the Vite SPA and FastAPI API: `frontend/vercel.json` rewrites unknown paths to `index.html`, which would hide `/api/v1` and `/health`.

### Backend

| Setting | Value |
|---|---|
| Root Directory | `backend` |
| Framework | FastAPI (`app` in `main.py`) |
| Build Command | leave empty |
| `backend/vercel.json` | `main.py`, `maxDuration` 60s, **no** SPA rewrite |

| Variable | Value |
|---|---|
| `APP_ENV` | `production` |
| `MONGODB_URI` | Atlas URI (not localhost) |
| `MONGODB_DATABASE` | e.g. `supportflow_ai` |
| `JWT_SECRET` | Unique non-placeholder secret |
| `GOOGLE_API_KEY` | Gemini key |
| `CORS_ORIGINS` | Exact frontend origin (never `*`) |
| `VECTOR_STORE` | `mongo` |

Optional defaults: `GEMINI_MODEL`, `GEMINI_EMBEDDING_MODEL=gemini-embedding-001`, `GEMINI_EMBEDDING_DIMENSIONS=768`, `MONGO_VECTOR_COLLECTION=knowledge_vectors`, `MONGO_VECTOR_INDEX=knowledge_vectors_index`.

Confirm `GET /health` after deploy.

### Frontend

| Setting | Value |
|---|---|
| Root Directory | `frontend` |
| Build | `npm run build` → `dist` |
| `frontend/vercel.json` | SPA rewrite to `index.html` |
| `VITE_API_BASE_URL` | `https://<backend>.vercel.app/api/v1` |

Do not put Mongo, JWT, or Gemini secrets in the frontend project. Production builds reject localhost `VITE_API_BASE_URL`.

## Atlas Vector Search

1. Network Access: allow Vercel egress (M0 often `0.0.0.0/0`).
2. Create index `knowledge_vectors_index` on collection `knowledge_vectors` (Atlas UI; M0 cannot create this from the app):

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

3. Wait until Active, then publish or `POST /api/v1/knowledge-documents/{id}/ingest`. Chroma vectors are not migrated.

## Existing vs empty databases

| Database | Action |
|---|---|
| New empty MongoDB | Register a user; indexes created on API startup |
| Pre-workspace legacy data | From `backend/`: dry-run then run `python -m scripts.backfill_workspaces`, `python -m scripts.reindex_knowledge_chroma`, `python -m scripts.cleanup_owner_id`. Do **not** run on startup |

## SPA deep links

Hosts must serve `index.html` for `/dashboard/*` and query deep links (`?ticket=`, `?customer=`, `?conversation=`, `?document=`).

| File | Host |
|---|---|
| `frontend/vercel.json` | Vercel |
| `frontend/public/_redirects` | Netlify |

## Local single-worker production-like run

Auth and AI rate limits are in-memory (not shared across workers):

```powershell
cd backend
.\.venv\Scripts\Activate.ps1
uvicorn main:app --host 0.0.0.0 --port 8000 --workers 1
```

Use TLS in front of the API. Do not mix an HTTPS SPA with a plain HTTP API in the browser.
