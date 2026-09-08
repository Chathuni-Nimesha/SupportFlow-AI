# Local portfolio demo seed

Development-only tooling to populate **one** workspace with realistic SupportFlow AI data for portfolio screenshots.

## What it creates

| Entity | Count | Notes |
|---|---|---|
| Owner user | existing | Use `--owner-email` for your logged-in account |
| Team | OWNER + 1 ADMIN + 2 AGENTS | Directory members only (no extra logins) |
| Customers | 8 | Unique emails per workspace |
| Conversations | 10 | Mixed statuses/channels + multi-message threads |
| Tickets | 7 | OPEN / IN_PROGRESS / PENDING / RESOLVED / CLOSED |
| Knowledge | 5 | Published via real ingestion workflow |

Idempotency uses stable emails plus a `demo_seed_key` marker on conversations/tickets/messages/team/customers, and the `demo-seed` knowledge tag. Existing non-demo records are never deleted or overwritten.

## Commands

From `backend/` (with venv activated):

```powershell
python -m scripts.seed_demo_data --owner-email you@example.com --dry-run --allow-non-localhost
python -m scripts.seed_demo_data --owner-email you@example.com --allow-non-localhost
```

Useful flags:

- `--owner-email` — **required in practice** for your current workspace owner
- `--create-owner-if-missing` — only if you intentionally want the default demo owner registered
- `--allow-non-localhost` — required if `MONGODB_URI` is Atlas (dev cluster only)
- `--skip-rag-check` — skip the post-seed knowledge retrieval smoke test

## Safety guards

- Blocked when `APP_ENV` is production
- Blocked when `VERCEL=1`
- Blocked for non-localhost Mongo unless `--allow-non-localhost`
- Does not delete customers, conversations, tickets, or collections

Never run this against production Atlas. Do not deploy the seed to Vercel.

## Implementation

- Catalog: `app/demo/catalog.py`
- Seed logic: `app/demo/seed.py` (calls existing services)
- CLI: `scripts/seed_demo_data.py`
- Tests: `tests/unit/test_seed_demo_data.py`
