# Phase 1I — Obsolete unique `owner_id` index cleanup

Explicit, idempotent MongoDB **index** cleanup. It does **not** delete
documents, change `workspace_id`, or infer a tenant from `owner_id`.

This is **not** run on FastAPI startup.

## Why this exists

Runtime tenancy is `workspace_id`. Unique email constraints must be per
workspace:

- `customers (workspace_id, email)` unique
- `team_members (workspace_id, email)` unique

Leftover unique `(owner_id, email)` indexes can block the same email in
two workspaces when the creating user is the same.

`ensure_indexes()` no longer creates those unique owner indexes. Existing
databases may still have them until this script runs.

## Dry-run (zero writes)

From `backend/`:

```powershell
.\.venv\Scripts\python.exe -m scripts.cleanup_owner_id --dry-run
```

## Execution (drops indexes only)

```powershell
.\.venv\Scripts\python.exe -m scripts.cleanup_owner_id
```

Safe to run repeatedly. Missing indexes are skipped.

## What it drops

| Collection | Index | Why |
|---|---|---|
| `customers` | unique `(owner_id, email)` | Incorrect cross-workspace uniqueness |
| `team_members` | unique `(owner_id, email)` | Incorrect cross-workspace uniqueness |

Non-unique `owner_id` indexes and all `workspace_id` indexes are left in place.
`owner_id` fields on documents are left in place.
