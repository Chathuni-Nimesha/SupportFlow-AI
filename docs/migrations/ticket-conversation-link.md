# Phase 2C — Ticket `conversation_id` (no backfill)

Tickets now accept an optional `conversation_id`. Existing tickets without
that field remain valid. The API returns `conversation_id: null` when the
field is missing.

## Why there is no data migration

SupportFlow does not store a historical ticket ↔ conversation relationship
that can be reconstructed safely.

Do **not**:

- Infer a conversation from `owner_id`
- Match tickets to conversations by email or title
- Invent links for existing tickets

Operators do not need to run a backfill. New and updated tickets may set
`conversation_id` through the API after resolving:

```json
{ "_id": "<conversation_id>", "workspace_id": "<current workspace>" }
```

## Runtime rules

- `conversation_id` is optional and non-unique
- Foreign-workspace ids are rejected with 404
- Explicit `PATCH { "conversation_id": null }` unlinks the ticket
- `customer_id` behavior is unchanged
