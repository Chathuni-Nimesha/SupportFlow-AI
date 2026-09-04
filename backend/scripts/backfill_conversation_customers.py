"""CLI: additive conversation.customer_id backfill (Phase 2B).

Run from the repository root:

    python -m backend.scripts.backfill_conversation_customers --dry-run
    python -m backend.scripts.backfill_conversation_customers

From ``backend/``:

    python -m scripts.backfill_conversation_customers --dry-run
"""

from __future__ import annotations

import argparse
import asyncio
import sys
from pathlib import Path

_BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(_BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(_BACKEND_ROOT))

from app.database.mongodb import close_mongodb, connect_mongodb, get_database
from app.migrations.conversation_customer_backfill import (
    format_conversation_customer_backfill_report,
    run_conversation_customer_backfill,
)


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Set conversation.customer_id when there is exactly one customer "
            "with the same workspace_id and email. Does not create customers, "
            "change owner_id/workspace_id, or rewrite name/email. "
            "Does not run on startup."
        ),
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Print planned links without writing to MongoDB.",
    )
    return parser.parse_args(argv)


async def async_main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)
    await connect_mongodb()
    try:
        report = await run_conversation_customer_backfill(
            get_database(),
            dry_run=args.dry_run,
        )
        print(format_conversation_customer_backfill_report(report), end="")
    finally:
        await close_mongodb()
    return 0


def main(argv: list[str] | None = None) -> int:
    return asyncio.run(async_main(argv))


if __name__ == "__main__":
    raise SystemExit(main())
