# Phase 1B — Personal workspace backfill

Additive MongoDB migration for databases that still have resources without
`workspace_id`. It does **not** change application code, JWT structure, or
startup behavior.

**Runtime tenant boundary:** live queries use `workspace_id` from
`get_current_workspace()`. `owner_id` is compatibility and attribution
metadata only. This script is **not** the tenant boundary: it *finds*
unstamped documents by `owner_id` so it can stamp the missing
`workspace_id`. That lookup is migration-only.

A **new empty database** does not need this script. Registering a user
creates a personal workspace and stamps `workspace_id` on new resources.

## Purpose

For every existing user, ensure exactly one personal workspace
(`owner_user_id = user._id`) and set `workspace_id` on that user's resources
when the field is missing.

Runtime isolation is:

```text
JWT {sub, exp, type}
  → authenticated user
  → get_current_workspace()
  → workspace_id
  → resources
```

This migration does **not** establish `owner_id` as the runtime tenant
boundary. After resources are stamped, APIs continue to scope data by
`workspace_id` from `get_current_workspace()`. `owner_id` remains on
documents as compatibility/attribution metadata and is not removed.

## Dry-run command (zero writes)

From the repository root, using the backend virtualenv:

```powershell
python -m backend.scripts.backfill_workspaces --dry-run
```

```powershell
.\backend\.venv\Scripts\python.exe -m backend.scripts.backfill_workspaces --dry-run
```

From `backend/` with the project venv:

```powershell
.\.venv\Scripts\python.exe -m scripts.backfill_workspaces --dry-run
```

Dry-run prints per-user counts and must not insert or update any document.

## Execution command (writes)

From the repository root, using the backend virtualenv:

```powershell
python -m backend.scripts.backfill_workspaces
```

```powershell
.\backend\.venv\Scripts\python.exe -m backend.scripts.backfill_workspaces
```

From `backend/`:

```powershell
.\.venv\Scripts\python.exe -m scripts.backfill_workspaces
```

This is **not** run on FastAPI startup. Run it once against the target
database after a dry-run.

## Collections affected

| Collection | Action |
|---|---|
| `workspaces` | Insert one personal workspace per user if none exists for `owner_user_id` |
| `conversations` | `$set` `workspace_id` when missing |
| `messages` | `$set` `workspace_id` when missing |
| `customers` | `$set` `workspace_id` when missing |
| `tickets` | `$set` `workspace_id` when missing |
| `team_members` | `$set` `workspace_id` when missing (OWNER `_id` unchanged) |
| `knowledge_documents` | `$set` `workspace_id` when missing |
| `users` | Unchanged |

Workspace name: `company_name` when present, otherwise `"<name>'s Workspace"`.
Workspace `_id` is a new UUID and is never equal to `user._id`.

## Idempotency

Safe to run repeatedly.

- Existing workspace for `owner_user_id` is reused (no second workspace).
- Documents that already have `workspace_id` are not updated.
- `owner_id`, `user_id`, `assignee_id`, and `assigned_agent_id` are never
  changed.
- No documents are deleted.

## Verification procedure

1. Run dry-run. Confirm planned workspace creates and resource counts.
2. Snapshot counts if needed:
   - `db.workspaces.countDocuments()`
   - resources with `{ workspace_id: { $exists: false } }`
3. Run write mode.
4. Confirm:
   - `workspaces.countDocuments({ owner_user_id: userId }) == 1`
   - workspace `_id != userId`
   - OWNER team member `_id` still equals the user id
   - tickets/conversations keep the same `assignee_id` / `assigned_agent_id`
   - every former `owner_id=userId` document now has `workspace_id` set
     (except rows that already had a different `workspace_id`)
5. Run write mode again. Planned resource updates should be `0`; no extra
   workspaces.

## Rollback considerations

This migration only **adds** data:

- New `workspaces` documents can be deleted if you decide to abort before
  Phase 1C/1D (`db.workspaces.deleteMany({})` only after confirming nothing
  else depends on them).
- `workspace_id` on resources can be unset:
  `db.<collection>.updateMany({}, { $unset: { workspace_id: 1 } })`
- `owner_id` is left in place, so rolling back `workspace_id` returns the
  pre-1B document shape without restoring from backup.
- Do not drop `owner_id` indexes. Do not restore from backup unless you also
  need to undo unrelated data changes.

## Warnings

**This script does not migrate Chroma.** It only stamps MongoDB
`workspace_id`. After a backfill on an existing knowledge base, run the
separate Chroma reindex (`python -m scripts.reindex_knowledge_chroma` from
`backend/`) so chunk metadata includes `workspace_id`. Runtime RAG
retrieval already filters on `workspace_id` and `status=Published`; it does
not use `owner_id` as the tenant boundary.

**This migration does not switch tenancy to `owner_id`.** Stamping
`workspace_id` does not change JWT claims (`sub`, `exp`, `type` only), auth,
or the frontend. The active workspace remains `get_current_workspace()`.
`owner_id` stays as compatibility/attribution metadata.

**Do not run this from the FastAPI lifespan.** It is a manual CLI only.
