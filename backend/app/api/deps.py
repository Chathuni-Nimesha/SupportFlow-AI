"""Shared FastAPI query dependencies."""

from typing import Annotated

from fastapi import Query

from app.core.pagination import DEFAULT_PAGE, DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE

PageParam = Annotated[
    int,
    Query(ge=1, description="1-based page number"),
]
PageSizeParam = Annotated[
    int,
    Query(
        ge=1,
        le=MAX_PAGE_SIZE,
        description=f"Items per page (max {MAX_PAGE_SIZE})",
    ),
]

PageQuery = PageParam
PageSizeQuery = PageSizeParam

DEFAULT_LIST_PAGE = DEFAULT_PAGE
DEFAULT_LIST_PAGE_SIZE = DEFAULT_PAGE_SIZE
