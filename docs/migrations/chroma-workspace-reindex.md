# Phase 1D-4 — Chroma workspace re-index

Explicit, idempotent re-index of **published** knowledge documents so Chroma
chunk metadata includes `workspace_id`.

This is **not** run on FastAPI startup. It does **not** drop the Chroma
collection.

## Why this exists

Phase 1B stamped `workspace_id` on MongoDB `knowledge_documents`. Existing
Chroma chunks may still have only `owner_id`. After the Phase 1D-4 runtime
cutover, search/RAG filters Chroma with:

```text
$and: [{ workspace_id: current_workspace.id }, { status: "Published" }]
```

Chunks without `workspace_id` are **not** returned. That is intentional: the
query never searches all tenants.

## Prerequisites

1. MongoDB workspace backfill (Phase 1B) has been applied.
2. Published knowledge documents have a non-empty `workspace_id`.

Documents that are published but still missing `workspace_id` are skipped.
This script does **not** invent a workspace mapping for them. Run
`backfill_workspaces` first.

## Dry-run (zero writes)

From the repository root, using the backend virtualenv:

```powershell
.\backend\.venv\Scripts\python.exe -m backend.scripts.reindex_knowledge_chroma --dry-run
```

From `backend/`:

```powershell
.\.venv\Scripts\python.exe -m scripts.reindex_knowledge_chroma --dry-run
```

## Execution (writes)

```powershell
.\backend\.venv\Scripts\python.exe -m backend.scripts.reindex_knowledge_chroma
```

For each published document with `workspace_id`:

1. Delete existing Chroma chunks for that `document_id` (including legacy
   owner-only metadata).
2. Upsert new chunks with `workspace_id`, `owner_id`, `status`, and the
   rest of the existing metadata fields.
3. Persist ingestion status back onto the Mongo document.

Chunk ids stay `{document_id}::chunk::{index}`. Re-running replaces the same
ids and is safe.

## What is not done

- The Chroma collection is not deleted or renamed.
- Draft documents are not indexed (existing publish-only behavior).
- Orphan Chroma chunks whose Mongo parent was already deleted are not
  swept. They cannot match the workspace filter, so they are not retrieved.
- Runtime queries never fall back to `owner_id`.
