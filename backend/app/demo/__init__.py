"""Local-only portfolio demo seed helpers.

This package is for development screenshots. It must never run in production
or on Vercel. Seed logic lives in ``app.demo.seed``; static content in
``app.demo.catalog``.
"""

from app.demo.seed import SeedReport, format_seed_report, run_portfolio_seed

__all__ = [
    "SeedReport",
    "format_seed_report",
    "run_portfolio_seed",
]
