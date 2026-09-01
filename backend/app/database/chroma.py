"""ChromaDB client helpers for knowledge embeddings."""

from typing import Any

from app.config.settings import get_settings, normalize_chroma_auth_header
from app.core.logging import get_logger

logger = get_logger(__name__)

_chroma_client: Any | None = None
_embedding_function: Any | None = None


class DeterministicHashEmbeddingFunction:
    """
    Lightweight local embedding used for tests / offline mode.

    Not intended for production semantic quality — production uses Chroma's
    DefaultEmbeddingFunction (all-MiniLM-L6-v2 via ONNX).
    """

    def __init__(self, dimensions: int = 384) -> None:
        self._dimensions = dimensions

    def is_legacy(self) -> bool:
        # Satisfy Chroma embedding-function config expectations.
        return True

    def name(self) -> str:
        return "deterministic-hash"

    def __call__(self, input: list[str]) -> list[list[float]]:
        vectors: list[list[float]] = []
        for text in input:
            values = [0.0] * self._dimensions
            if not text:
                vectors.append(values)
                continue
            for index, char in enumerate(text.encode("utf-8")):
                values[index % self._dimensions] += (char % 31) / 31.0
            norm = sum(value * value for value in values) ** 0.5 or 1.0
            vectors.append([value / norm for value in values])
        return vectors

    def embed_documents(self, input: list[str]) -> list[list[float]]:
        """Chroma document embedding API (used on upsert)."""
        return self(input)

    def embed_query(self, input: list[str]) -> list[list[float]]:
        """Chroma query embedding API (required by collection.query)."""
        return self(input)


def reset_chroma_client() -> None:
    """Clear the cached ChromaDB client (useful for tests / shutdown)."""
    global _chroma_client, _embedding_function
    _chroma_client = None
    _embedding_function = None


def get_embedding_function() -> Any:
    """Return the configured embedding function (lazy)."""
    global _embedding_function

    if _embedding_function is not None:
        return _embedding_function

    settings = get_settings()
    model = settings.chroma_embedding_model.strip().lower()

    if model in {"hash", "deterministic", "test"}:
        _embedding_function = DeterministicHashEmbeddingFunction()
        logger.info("Using deterministic hash embedding function")
        return _embedding_function

    from chromadb.utils import embedding_functions

    # DefaultEmbeddingFunction → ONNX MiniLM (all-MiniLM-L6-v2), no Gemini.
    _embedding_function = embedding_functions.DefaultEmbeddingFunction()
    logger.info("Using Chroma DefaultEmbeddingFunction (all-MiniLM-L6-v2)")
    return _embedding_function


def http_chroma_client_kwargs(settings: Any) -> dict[str, Any]:
    """
    Build HttpClient keyword arguments from settings.

    Authentication/TLS are only attached when configured. An empty token
    does not enable Chroma auth.
    """
    kwargs: dict[str, Any] = {
        "host": (settings.chroma_host or "localhost").strip() or "localhost",
        "port": int(settings.chroma_port),
        "ssl": bool(settings.chroma_ssl),
    }
    token = (settings.chroma_auth_token or "").strip()
    if not token:
        return kwargs

    from chromadb.config import Settings as ChromaClientSettings

    kwargs["settings"] = ChromaClientSettings(
        chroma_client_auth_provider=(
            "chromadb.auth.token_authn.TokenAuthClientProvider"
        ),
        chroma_client_auth_credentials=token,
        chroma_auth_token_transport_header=normalize_chroma_auth_header(
            getattr(settings, "chroma_auth_header", None),
        ),
    )
    return kwargs


def get_chroma_client() -> Any:
    """
    Lazily create and return a ChromaDB client.

    Modes:
    - http: chromadb.HttpClient(CHROMA_HOST, CHROMA_PORT, optional SSL/token)
    - persistent: local PersistentClient(CHROMA_PERSIST_DIRECTORY)
    - ephemeral: in-memory EphemeralClient (tests)
    """
    global _chroma_client

    if _chroma_client is not None:
        return _chroma_client

    import chromadb

    settings = get_settings()
    mode = settings.chroma_mode.strip().lower()

    if mode == "ephemeral":
        _chroma_client = chromadb.EphemeralClient()
        logger.info("ChromaDB EphemeralClient initialized")
    elif mode == "persistent":
        _chroma_client = chromadb.PersistentClient(
            path=settings.chroma_persist_directory,
        )
        logger.info(
            "ChromaDB PersistentClient initialized at %s",
            settings.chroma_persist_directory,
        )
    else:
        kwargs = http_chroma_client_kwargs(settings)
        _chroma_client = chromadb.HttpClient(**kwargs)
        logger.info(
            "ChromaDB HttpClient configured for %s:%s ssl=%s auth=%s",
            kwargs["host"],
            kwargs["port"],
            kwargs["ssl"],
            "token" if "settings" in kwargs else "none",
        )

    return _chroma_client


def get_knowledge_collection() -> Any:
    """Return the shared knowledge collection with embedding function attached."""
    settings = get_settings()
    client = get_chroma_client()
    return client.get_or_create_collection(
        name=settings.chroma_collection,
        embedding_function=get_embedding_function(),
        metadata={"hnsw:space": "cosine"},
    )
