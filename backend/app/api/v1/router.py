"""API v1 router aggregation."""

from fastapi import APIRouter

from app.api.v1.endpoints import ai, auth, conversations, knowledge

api_router = APIRouter()
api_router.include_router(auth.router)
api_router.include_router(conversations.router)
api_router.include_router(knowledge.router)
api_router.include_router(knowledge.search_router)
api_router.include_router(ai.router)
