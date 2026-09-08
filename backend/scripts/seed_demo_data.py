"""CLI: seed realistic local portfolio demo data.

Development only. Refuses APP_ENV=production and Vercel.

Populate your CURRENT logged-in workspace (recommended):

    cd backend
    python -m scripts.seed_demo_data --owner-email you@example.com --allow-non-localhost

Optional: create the default demo owner if missing:

    python -m scripts.seed_demo_data --create-owner-if-missing --allow-non-localhost

If MONGODB_URI is not localhost, pass --allow-non-localhost (dev Atlas only).
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
from app.database.mongodb import close_mongodb, connect_mongodb
from app.demo.constants import DEFAULT_OWNER_EMAIL
from app.demo.seed import format_seed_report, run_portfolio_seed


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Seed idempotent SupportFlow AI portfolio demo data into one "
            "local development workspace. Uses existing service create paths. "
            "Never deletes or overwrites existing non-demo records."
        ),
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Report planned creates/skips without writing new records.",
    )
    parser.add_argument(
        "--owner-email",
        default=DEFAULT_OWNER_EMAIL,
        help=(
            "Workspace owner email to seed into. Use your logged-in development "
            f"account. Default: {DEFAULT_OWNER_EMAIL}."
        ),
    )
    parser.add_argument(
        "--owner-password",
        default=None,
        help=(
            "Password used only when --create-owner-if-missing registers a new "
            "owner. Defaults to SupportFlowDemo1! or SUPPORTFLOW_DEMO_OWNER_PASSWORD."
        ),
    )
    parser.add_argument(
        "--create-owner-if-missing",
        action="store_true",
        help=(
            "Register the owner email if it does not exist. Off by default so "
            "the seed targets an existing development workspace."
        ),
    )
    parser.add_argument(
        "--allow-non-localhost",
        action="store_true",
        help=(
            "Allow seeding when MONGODB_URI is not localhost "
            "(for a personal Atlas *development* cluster only)."
        ),
    )
    parser.add_argument(
        "--skip-rag-check",
        action="store_true",
        help="Skip post-seed knowledge retrieval smoke check.",
    )
    return parser.parse_args(argv)


async def async_main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)
    try:
        await connect_mongodb()
    except Exception as exc:  # noqa: BLE001
        if args.dry_run:
            from app.demo.catalog import catalog_summary

            summary = catalog_summary()
            print("Demo seed dry-run completed.")
            print(
                "warning: MongoDB is unreachable "
                f"({type(exc).__name__}); showing catalog expectations only."
            )
            print(f"owner_email: {args.owner_email}")
            for key, value in summary.items():
                print(f"expected_{key}: {value}")
            return 0
        print(
            f"error: MongoDB connection failed ({type(exc).__name__}). "
            "Fix MONGODB_URI / network auth, then retry.",
            file=sys.stderr,
        )
        return 1

    try:
        report = await run_portfolio_seed(
            owner_email=args.owner_email,
            owner_password=args.owner_password,
            dry_run=args.dry_run,
            allow_non_localhost=args.allow_non_localhost,
            skip_rag_check=args.skip_rag_check,
            create_owner_if_missing=args.create_owner_if_missing,
        )
        print(format_seed_report(report), end="")
    finally:
        await close_mongodb()
        reset_chroma_client()
    return 0


def main(argv: list[str] | None = None) -> int:
    try:
        return asyncio.run(async_main(argv))
    except RuntimeError as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
