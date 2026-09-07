"""MongoDB Atlas Vector Search store tests (no real Gemini or Atlas calls)."""

from unittest.mock import AsyncMock

import pytest
from httpx import AsyncClient
from mongomock_motor import AsyncMongoMockClient

from app.config.settings import (
    CHROMA_DISABLED_FOR_MONGO_STORE,
    get_settings,
    normalize_vector_store,
)
from app.database.chroma import get_chroma_client, reset_chroma_client
from app.database.mongodb import get_database
from app.models.knowledge import KNOWLEDGE_VECTORS_COLLECTION
from app.services import gemini_embeddings
from app.services.gemini_embeddings import set_embedding_client
from app.services.knowledge_ingestion import ingest_knowledge_document
from app.services.knowledge_retrieval import retrieve_knowledge
from app.services.mongo_vector_store import (
    mongo_published_workspace_filter,
    query_published_vectors,
)

SAMPLE_PUBLISHED = {
    "title": "Password reset policy",
    "content": (
        "Customers can reset passwords from the account security page. "
        "Require email verification before allowing a password change."
    ),
    "source_type": "manual",
    "status": "Published",
    "tags": ["security"],
}

SAMPLE_DRAFT = {
    "title": "Unpublished refund notes",
    "content": "Draft refund wording that must not appear in retrieval.",
    "source_type": "manual",
    "status": "Draft",
    "tags": ["billing"],
}


class FakeEmbeddingClient:
    def embed(
        self,
        *,
        api_key: str,
        model_name: str,
        texts: list[str],
        task_type: str,
        dimensions: int,
    ) -> list[list[float]]:
        vectors: list[list[float]] = []
        for text in texts:
            values = [0.0] * dimensions
            for index, char in enumerate(text.encode("utf-8")):
                values[index % dimensions] += (char % 31) / 31.0
            vectors.append(values)
        return vectors


@pytest.fixture
def mongo_vector_mode(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setenv("VECTOR_STORE", "mongo")
    monkeypatch.setenv("GOOGLE_API_KEY", "test-gemini-key-value")
    get_settings.cache_clear()
    original = gemini_embeddings.get_embedding_client()
    set_embedding_client(FakeEmbeddingClient())
    reset_chroma_client()
    yield
    set_embedding_client(original)
    monkeypatch.setenv("VECTOR_STORE", "chroma")
    get_settings.cache_clear()
    reset_chroma_client()


def test_normalize_vector_store_aliases() -> None:
    assert normalize_vector_store("chroma") == "chroma"
    assert normalize_vector_store("mongo") == "mongo"
    assert normalize_vector_store("mongo_vector") == "mongo"
    assert normalize_vector_store(None) == "chroma"


def test_mongo_published_filter_is_workspace_and_published() -> None:
    where = mongo_published_workspace_filter("workspace-a")
    assert where == {"workspace_id": "workspace-a", "status": "Published"}
    assert "owner_id" not in where


@pytest.mark.asyncio
async def test_mongo_upsert_and_workspace_isolation(
    client: AsyncClient,
    auth_headers: dict[str, str],
    sample_register_payload: dict,
    mongo_vector_mode,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    def fail_chroma():
        raise AssertionError(CHROMA_DISABLED_FOR_MONGO_STORE)

    monkeypatch.setattr("app.database.chroma.get_chroma_client", fail_chroma)

    created_a = await client.post(
        "/api/v1/knowledge-documents",
        headers=auth_headers,
        json=SAMPLE_PUBLISHED,
    )
    assert created_a.status_code == 201
    body_a = created_a.json()
    assert body_a["ingestion_status"] == "indexed"
    assert body_a["chunk_count"] >= 1

    other_payload = {**sample_register_payload, "email": "mongo-vec-b@acme.example"}
    await client.post("/api/v1/auth/register", json=other_payload)
    other_login = await client.post(
        "/api/v1/auth/login",
        json={"email": other_payload["email"], "password": other_payload["password"]},
    )
    other_headers = {"Authorization": f"Bearer {other_login.json()['access_token']}"}
    created_b = await client.post(
        "/api/v1/knowledge-documents",
        headers=other_headers,
        json=SAMPLE_PUBLISHED,
    )
    assert created_b.status_code == 201
    body_b = created_b.json()
    assert body_a["workspace_id"] != body_b["workspace_id"]

    collection = get_database()[KNOWLEDGE_VECTORS_COLLECTION]
    rows_a = await collection.find({"workspace_id": body_a["workspace_id"]}).to_list(50)
    rows_b = await collection.find({"workspace_id": body_b["workspace_id"]}).to_list(50)
    assert len(rows_a) == body_a["chunk_count"]
    assert len(rows_b) == body_b["chunk_count"]
    assert all(row["status"] == "Published" for row in rows_a)
    assert all(row["knowledge_document_id"] == body_a["id"] for row in rows_a)
    assert all(row["knowledge_document_id"] == body_b["id"] for row in rows_b)
    assert all(len(row["embedding"]) == 768 for row in rows_a)
    assert all("content" in row and row["chunk_id"] for row in rows_a)


@pytest.mark.asyncio
async def test_mongo_draft_is_not_upserted(
    client: AsyncClient,
    auth_headers: dict[str, str],
    mongo_vector_mode,
) -> None:
    created = await client.post(
        "/api/v1/knowledge-documents",
        headers=auth_headers,
        json=SAMPLE_DRAFT,
    )
    assert created.status_code == 201
    body = created.json()
    assert body["ingestion_status"] == "not_indexed"
    rows = await get_database()[KNOWLEDGE_VECTORS_COLLECTION].find(
        {"knowledge_document_id": body["id"]}
    ).to_list(10)
    assert rows == []


@pytest.mark.asyncio
async def test_mongo_unpublish_and_delete_remove_vectors(
    client: AsyncClient,
    auth_headers: dict[str, str],
    mongo_vector_mode,
) -> None:
    created = await client.post(
        "/api/v1/knowledge-documents",
        headers=auth_headers,
        json=SAMPLE_PUBLISHED,
    )
    body = created.json()
    document_id = body["id"]
    workspace_id = body["workspace_id"]
    collection = get_database()[KNOWLEDGE_VECTORS_COLLECTION]
    assert await collection.count_documents({"knowledge_document_id": document_id}) >= 1

    unpublished = await client.patch(
        f"/api/v1/knowledge-documents/{document_id}",
        headers=auth_headers,
        json={"status": "Draft"},
    )
    assert unpublished.status_code == 200
    assert unpublished.json()["ingestion_status"] == "not_indexed"
    assert await collection.count_documents({"knowledge_document_id": document_id}) == 0

    republished = await client.patch(
        f"/api/v1/knowledge-documents/{document_id}",
        headers=auth_headers,
        json={"status": "Published"},
    )
    assert republished.status_code == 200
    assert await collection.count_documents(
        {"knowledge_document_id": document_id, "workspace_id": workspace_id}
    ) >= 1

    deleted = await client.delete(
        f"/api/v1/knowledge-documents/{document_id}",
        headers=auth_headers,
    )
    assert deleted.status_code == 204
    assert await collection.count_documents({"knowledge_document_id": document_id}) == 0
    assert await collection.count_documents({"workspace_id": workspace_id}) == 0


@pytest.mark.asyncio
async def test_mongo_vector_search_uses_workspace_filter(
    mongo_vector_mode,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    captured: dict = {}

    class FakeCursor:
        def __aiter__(self):
            return self

        async def __anext__(self):
            raise StopAsyncIteration

    class FakeCollection:
        def aggregate(self, pipeline):
            captured["pipeline"] = pipeline
            return FakeCursor()

    monkeypatch.setattr(
        "app.services.mongo_vector_store.knowledge_vectors_collection",
        lambda: FakeCollection(),
    )
    monkeypatch.setattr(
        "app.services.mongo_vector_store.embed_query",
        AsyncMock(return_value=[0.1] * 768),
    )

    results = await query_published_vectors(
        workspace_id="workspace-a",
        query="password reset",
        top_k=5,
    )
    assert results == []
    search = captured["pipeline"][0]["$vectorSearch"]
    assert search["filter"] == mongo_published_workspace_filter("workspace-a")
    assert search["path"] == "embedding"
    assert "owner_id" not in str(search["filter"])


@pytest.mark.asyncio
async def test_mongo_query_drops_cross_workspace_hits(
    mongo_vector_mode,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    leaked = {
        "_id": "other::chunk::0",
        "chunk_id": "other::chunk::0",
        "content": "leaked chunk",
        "workspace_id": "workspace-b",
        "knowledge_document_id": "other-doc",
        "status": "Published",
        "owner_id": "user-b",
        "title": "Other",
        "source": "",
        "source_type": "manual",
        "tags": "",
        "chunk_index": 0,
        "score": 0.99,
    }

    class FakeCursor:
        def __init__(self):
            self._items = [leaked]

        def __aiter__(self):
            return self

        async def __anext__(self):
            if not self._items:
                raise StopAsyncIteration
            return self._items.pop(0)

    class FakeCollection:
        def aggregate(self, _pipeline):
            return FakeCursor()

    monkeypatch.setattr(
        "app.services.mongo_vector_store.knowledge_vectors_collection",
        lambda: FakeCollection(),
    )
    monkeypatch.setattr(
        "app.services.mongo_vector_store.embed_query",
        AsyncMock(return_value=[0.1] * 768),
    )

    results = await query_published_vectors(
        workspace_id="workspace-a",
        query="password reset",
        top_k=5,
    )
    assert results == []


@pytest.mark.asyncio
async def test_retrieve_knowledge_mongo_mode_does_not_use_chroma(
    mongo_vector_mode,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    captured: dict = {}

    async def fake_query(**kwargs):
        captured.update(kwargs)
        return []

    def fail_chroma():
        raise AssertionError("Chroma must not initialize when VECTOR_STORE=mongo")

    monkeypatch.setattr(
        "app.services.mongo_vector_store.query_published_vectors",
        fake_query,
    )
    monkeypatch.setattr("app.database.chroma.get_chroma_client", fail_chroma)

    results = await retrieve_knowledge(
        workspace_id="workspace-a",
        query="password reset",
        top_k=3,
    )
    assert results == []
    assert captured["workspace_id"] == "workspace-a"
    assert captured["query"] == "password reset"
    assert captured["top_k"] == 3


@pytest.mark.asyncio
async def test_local_chroma_mode_still_available() -> None:
    get_settings.cache_clear()
    assert get_settings().vector_store == "chroma"
    reset_chroma_client()
    client = get_chroma_client()
    assert client is not None
    reset_chroma_client()


@pytest.mark.asyncio
async def test_ingest_without_chroma_when_mongo(
    mongo_vector_mode,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    mock_db = AsyncMongoMockClient()["supportflow_test"]
    monkeypatch.setattr(
        "app.services.mongo_vector_store.get_database",
        lambda: mock_db,
    )

    def fail_chroma():
        raise AssertionError("Chroma must not initialize when VECTOR_STORE=mongo")

    monkeypatch.setattr("app.database.chroma.get_chroma_client", fail_chroma)

    result = await ingest_knowledge_document(
        {
            "_id": "doc-1",
            "owner_id": "user-1",
            "workspace_id": "workspace-1",
            "title": "Billing",
            "content": "Invoices are due in 30 days.",
            "status": "Published",
            "source_type": "manual",
            "source": None,
            "tags": ["billing"],
        }
    )
    assert result["ingestion_status"] == "indexed"
    assert result["chunk_count"] >= 1
    stored = await mock_db[KNOWLEDGE_VECTORS_COLLECTION].find({}).to_list(10)
    assert stored
    assert stored[0]["workspace_id"] == "workspace-1"
