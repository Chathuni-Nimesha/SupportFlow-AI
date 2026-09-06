# Phase 2D — Ticket customer/conversation consistency (no backfill)

Phase 2D adds a **runtime** consistency check. It does not invent
historical Ticket ↔ Customer ↔ Conversation links.

## Why there is no data migration

Existing tickets may already have:

- a required `customer_id`
- an optional `conversation_id`
- a conversation whose `customer_id` is missing or different

Those documents stay valid. There is no safe way to rewrite them from
`owner_id`, email, or title.

Do **not** run a backfill for Phase 2D.

## Runtime rules

Create and update resolve both ids with:

```json
{ "_id": "<id>", "workspace_id": "<current workspace>" }
```

If both a ticket `customer_id` and a conversation `customer_id` are present
and they differ, the API returns **400** and does not write.

If the conversation has no `customer_id`, the ticket customer stays
independent. Customers are not auto-created or auto-linked.

`PATCH { "customer_id": null }` does **not** unlink. Tickets still require a
customer. `PATCH { "conversation_id": null }` still unlinks the conversation.

## Deletion

Customer delete does **not** cascade to tickets or conversations.

- If any ticket in the **current workspace** still references the
  customer, deletion is rejected with **409**. Tickets keep requiring
  `customer_id`; the API does not null it or invent a replacement
  customer.
- If no workspace tickets are linked, the customer is deleted and
  workspace-scoped conversations are **unlinked** (`customer_id`
  unset). `customer_name` and `customer_email` snapshots stay.
- Foreign-workspace tickets and conversations are never counted or
  rewritten.
- There is no conversation delete API. Tickets are not cascade-deleted.
