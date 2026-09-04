# Phase 2B — Conversation `customer_id` backfill

Explicit, idempotent, **additive** MongoDB backfill. It sets
`conversations.customer_id` only when an unlinked conversation has exactly
one matching customer in the **same workspace**.

This is **not** run on FastAPI startup.

## Why this exists

Conversations historically identified customers with denormalized
`customer_name` / `customer_email`. Phase 2B adds an optional
`customer_id` so related-conversation lookup can survive email changes.

Existing documents stay valid without `customer_id`. This script fills the
link when the match is unambiguous.

## Dry-run (zero writes)

From `backend/`:

```powershell
.\.venv\Scripts\python.exe -m scripts.backfill_conversation_customers --dry-run
```

## Execution (sets `customer_id` only)

```powershell
.\.venv\Scripts\python.exe -m scripts.backfill_conversation_customers
```

Safe to run repeatedly. Already-linked conversations are skipped.

## Match rule

For each conversation where:

- `workspace_id` is a non-empty string
- `customer_id` is missing, null, or blank
- `customer_email` is a non-empty string

find customers with **exactly**:

```json
{ "workspace_id": "<conversation.workspace_id>", "email": "<conversation.customer_email>" }
```

| Matches | Action |
|---|---|
| 1 | Set `conversation.customer_id` to that customer's `_id` |
| 0 | Skip |
| 2+ | Skip (ambiguous) |

## What it never does

- Infer `workspace_id` from `owner_id`
- Create customers
- Delete conversations or messages
- Rewrite `customer_name` or `customer_email`
- Change `owner_id` or `workspace_id`
- Drop indexes
