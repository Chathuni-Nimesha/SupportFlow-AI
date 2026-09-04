# Phase 1B — Personal workspace backfill

Additive MongoDB migration. It prepares existing `owner_id`-scoped data for
workspaces. It does **not** change application runtime.

**Status after Phase 1D–1I:** live queries use `workspace_id` from
`get_current_workspace`. This script still *finds* unstamped documents by
`owner_id`. That is a migration lookup, not the runtime tenant boundary.

## Purpose

For every existing user, ensure exactly one personal workspace
(`owner_user_id = user._id`) and set `workspace_id` on that user's resources
when the field is missing.

Runtime isolation remains:

```text
JWT user.id → owner_id → resources
```

`workspace_id` is stored for the later cutover. Queries still use `owner_id`.

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

**Chroma is NOT migrated yet.** Knowledge embeddings still filter on
`owner_id`. Do not change RAG retrieval as part of this backfill.

**Runtime still uses `owner_id`.** Setting `workspace_id` does not switch
API queries, JWT claims, auth, or the frontend. Application behavior after
this script must match pre-1B behavior.

**Do not run this from the FastAPI lifespan.** It is a manual CLI only.
