"""CLI: re-index published knowledge into Chroma with workspace_id metadata.

Run from the repository root:

    python -m backend.scripts.reindex_knowledge_chroma --dry-run
    python -m backend.scripts.reindex_knowledge_chroma

From ``backend/``:

    python -m scripts.reindex_knowledge_chroma --dry-run
"""

from __future__ import annotations

import argparse
import asyncio
import sys
from pathlib import Path

_BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(_BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(_BACKEND_ROOT))

from app.database.chroma import reset_chroma_client
from app.database.mongodb import close_mongodb, connect_mongodb, get_database
from app.migrations.chroma_workspace_reindex import (
    format_chroma_reindex_report,
    run_chroma_workspace_reindex,
)


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Re-index published knowledge documents so Chroma chunks include "
            "workspace_id. Does not drop the collection. Does not invent "
            "workspace_id for documents that still lack it. Does not run on "
            "application startup."
        ),
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Print planned counts without writing to Chroma or MongoDB.",
    )
    return parser.parse_args(argv)


async def async_main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)
    await connect_mongodb()
    try:
        report = await run_chroma_workspace_reindex(
            get_database(),
            dry_run=args.dry_run,
        )
        print(format_chroma_reindex_report(report), end="")
    finally:
        await close_mongodb()
        reset_chroma_client()
    return 0


def main(argv: list[str] | None = None) -> int:
    return asyncio.run(async_main(argv))


if __name__ == "__main__":
    raise SystemExit(main())
