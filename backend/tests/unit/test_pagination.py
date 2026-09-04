"""List endpoint pagination tests."""

import pytest
from httpx import AsyncClient


async def _create_customer(
    client: AsyncClient,
    headers: dict[str, str],
    email: str,
    first_name: str,
) -> dict:
    response = await client.post(
        "/api/v1/customers",
        headers=headers,
        json={
            "first_name": first_name,
            "last_name": "Page",
            "email": email,
        },
    )
    assert response.status_code == 201, response.text
    return response.json()


@pytest.mark.asyncio
async def test_customer_list_paginates(
    client: AsyncClient,
    auth_headers: dict[str, str],
) -> None:
    await _create_customer(client, auth_headers, "one@page.example", "One")
    await _create_customer(client, auth_headers, "two@page.example", "Two")
    await _create_customer(client, auth_headers, "three@page.example", "Three")

    first = await client.get(
        "/api/v1/customers",
        headers=auth_headers,
        params={"page": 1, "page_size": 2},
    )
    assert first.status_code == 200
    body = first.json()
    assert body["page"] == 1
    assert body["page_size"] == 2
    assert body["total"] == 3
    assert body["has_next"] is True
    assert len(body["items"]) == 2
    first_ids = {item["id"] for item in body["items"]}

    second = await client.get(
        "/api/v1/customers",
        headers=auth_headers,
        params={"page": 2, "page_size": 2},
    )
    assert second.status_code == 200
    next_page = second.json()
    assert next_page["page"] == 2
    assert next_page["total"] == 3
    assert next_page["has_next"] is False
    assert len(next_page["items"]) == 1
    assert next_page["items"][0]["id"] not in first_ids


@pytest.mark.asyncio
async def test_customer_search_is_paginated_not_global(
    client: AsyncClient,
    auth_headers: dict[str, str],
) -> None:
    await _create_customer(client, auth_headers, "alpha@page.example", "Alpha")
    await _create_customer(client, auth_headers, "beta@page.example", "Beta")
    await _create_customer(
        client,
        auth_headers,
        "harbor@page.example",
        "Harbor",
    )

    searched = await client.get(
        "/api/v1/customers",
        headers=auth_headers,
        params={"q": "harbor", "page": 1, "page_size": 20},
    )
    assert searched.status_code == 200
    body = searched.json()
    assert body["total"] == 1
    assert body["has_next"] is False
    assert body["items"][0]["email"] == "harbor@page.example"


@pytest.mark.asyncio
async def test_page_size_above_max_is_rejected(
    client: AsyncClient,
    auth_headers: dict[str, str],
) -> None:
    response = await client.get(
        "/api/v1/customers",
        headers=auth_headers,
        params={"page_size": 101},
    )
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_conversation_list_pagination_metadata(
    client: AsyncClient,
    auth_headers: dict[str, str],
) -> None:
    for index in range(3):
        created = await client.post(
            "/api/v1/conversations",
            headers=auth_headers,
            json={
                "customer_name": f"Customer {index}",
                "customer_email": f"c{index}@page.example",
                "subject": f"Subject {index}",
            },
        )
        assert created.status_code == 201

    response = await client.get(
        "/api/v1/conversations",
        headers=auth_headers,
        params={"page": 1, "page_size": 2},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["total"] == 3
    assert body["page_size"] == 2
    assert len(body["items"]) == 2
    assert body["has_next"] is True
