"""Unit tests for workspace role authorization helpers."""

import pytest
from fastapi import HTTPException

from app.auth.roles import (
    KNOWLEDGE_MANAGE_FORBIDDEN,
    OWNER_ADMIN_ROLES,
    ROLE_FORBIDDEN,
    TEAM_MANAGE_FORBIDDEN,
    WORKSPACE_UPDATE_FORBIDDEN,
    require_any_workspace_role,
    require_owner_or_admin,
    require_workspace_role,
)


def test_owner_and_admin_pass_owner_or_admin_check() -> None:
    require_owner_or_admin("OWNER")
    require_owner_or_admin("ADMIN")
    require_workspace_role("OWNER", "OWNER", "ADMIN")
    require_any_workspace_role("ADMIN", OWNER_ADMIN_ROLES)


def test_agent_is_rejected_from_owner_or_admin() -> None:
    with pytest.raises(HTTPException) as exc_info:
        require_owner_or_admin("AGENT")
    assert exc_info.value.status_code == 403
    assert exc_info.value.detail == ROLE_FORBIDDEN


def test_custom_forbidden_details() -> None:
    with pytest.raises(HTTPException) as workspace_exc:
        require_owner_or_admin("AGENT", detail=WORKSPACE_UPDATE_FORBIDDEN)
    assert workspace_exc.value.detail == WORKSPACE_UPDATE_FORBIDDEN

    with pytest.raises(HTTPException) as team_exc:
        require_workspace_role("AGENT", "OWNER", "ADMIN", detail=TEAM_MANAGE_FORBIDDEN)
    assert team_exc.value.detail == TEAM_MANAGE_FORBIDDEN

    with pytest.raises(HTTPException) as knowledge_exc:
        require_any_workspace_role(
            "AGENT",
            OWNER_ADMIN_ROLES,
            detail=KNOWLEDGE_MANAGE_FORBIDDEN,
        )
    assert knowledge_exc.value.detail == KNOWLEDGE_MANAGE_FORBIDDEN
