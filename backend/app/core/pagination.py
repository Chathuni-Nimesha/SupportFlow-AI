"""Shared list pagination helpers."""

from typing import Any

DEFAULT_PAGE = 1
DEFAULT_PAGE_SIZE = 20
MAX_PAGE_SIZE = 100


def page_offset(page: int, page_size: int) -> int:
    return (page - 1) * page_size


def has_next_page(page: int, page_size: int, total: int) -> bool:
    return page * page_size < total


def paginated_payload(
    items: list[Any],
    *,
    page: int,
    page_size: int,
    total: int,
) -> dict[str, Any]:
    return {
        "items": items,
        "page": page,
        "page_size": page_size,
        "total": total,
        "has_next": has_next_page(page, page_size, total),
    }


async def paginate_find(
    collection: Any,
    filters: dict[str, Any],
    *,
    page: int,
    page_size: int,
    sort_field: str = "updated_at",
    sort_direction: int = -1,
) -> tuple[list[dict[str, Any]], int]:
    """Return (documents, total) for an owner-scoped list query."""
    skip = page_offset(page, page_size)
    total = await collection.count_documents(filters)
    cursor = (
        collection.find(filters)
        .sort(sort_field, sort_direction)
        .skip(skip)
        .limit(page_size)
    )
    documents = await cursor.to_list(length=page_size)
    return documents, total
