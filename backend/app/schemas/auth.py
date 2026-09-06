"""Authentication and user Pydantic schemas."""

from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

from app.schemas.workspace import WorkspaceSummaryResponse

# bcrypt silently truncates or errors after 72 bytes. Reject longer values.
BCRYPT_PASSWORD_MAX_BYTES = 72
PASSWORD_TOO_LONG_FOR_BCRYPT = (
    "Password is too long. Use at most 72 bytes "
    "(bcrypt cannot hash longer values safely)."
)


def validate_password_for_bcrypt(password: str) -> str:
    """Reject passwords bcrypt cannot hash without truncation."""
    if len(password.encode("utf-8")) > BCRYPT_PASSWORD_MAX_BYTES:
        raise ValueError(PASSWORD_TOO_LONG_FOR_BCRYPT)
    return password


class UserRegisterRequest(BaseModel):
    first_name: str = Field(min_length=1, max_length=100)
    last_name: str = Field(min_length=1, max_length=100)
    company_name: str = Field(min_length=1, max_length=200)
    email: EmailStr
    password: str = Field(min_length=8, max_length=BCRYPT_PASSWORD_MAX_BYTES)

    @field_validator("password")
    @classmethod
    def password_fits_bcrypt(cls, value: str) -> str:
        return validate_password_for_bcrypt(value)


class UserLoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=BCRYPT_PASSWORD_MAX_BYTES)

    @field_validator("password")
    @classmethod
    def password_fits_bcrypt(cls, value: str) -> str:
        return validate_password_for_bcrypt(value)


class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    first_name: str
    last_name: str
    company_name: str
    email: EmailStr
    is_active: bool
    created_at: datetime
    default_workspace_id: str | None = Field(
        default=None,
        description=(
            "Selected current workspace id, persisted on the user document. "
            "This is the active tenant for get_current_workspace. "
            "It is not encoded in the JWT. There is no separate "
            "active_workspace_id; default_workspace_id is the selected workspace, "
            "falling back to the user's personal workspace when unset or invalid."
        ),
    )
    workspaces: list[WorkspaceSummaryResponse] = Field(default_factory=list)


class AuthTokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse


class MessageResponse(BaseModel):
    message: str
