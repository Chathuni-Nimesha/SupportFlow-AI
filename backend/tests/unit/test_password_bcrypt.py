"""bcrypt password length guards."""

import pytest
from pydantic import ValidationError

from app.schemas.auth import (
    BCRYPT_PASSWORD_MAX_BYTES,
    PASSWORD_TOO_LONG_FOR_BCRYPT,
    UserLoginRequest,
    UserRegisterRequest,
    validate_password_for_bcrypt,
)

VALID_REGISTER = {
    "first_name": "Maya",
    "last_name": "Chen",
    "company_name": "Acme Support",
    "email": "maya@acme.example",
    "password": "password123",
}


def test_bcrypt_helper_accepts_72_ascii_bytes() -> None:
    password = "a" * BCRYPT_PASSWORD_MAX_BYTES
    assert validate_password_for_bcrypt(password) == password


def test_bcrypt_helper_rejects_73_ascii_bytes() -> None:
    with pytest.raises(ValueError, match="72 bytes"):
        validate_password_for_bcrypt("a" * (BCRYPT_PASSWORD_MAX_BYTES + 1))


def test_bcrypt_helper_rejects_multibyte_over_72_bytes() -> None:
    # 37 × "é" (2 bytes) = 74 bytes, 37 characters.
    password = "é" * 37
    assert len(password) < BCRYPT_PASSWORD_MAX_BYTES
    assert len(password.encode("utf-8")) > BCRYPT_PASSWORD_MAX_BYTES
    with pytest.raises(ValueError) as exc_info:
        validate_password_for_bcrypt(password)
    assert str(exc_info.value) == PASSWORD_TOO_LONG_FOR_BCRYPT


def test_register_rejects_password_over_72_bytes() -> None:
    with pytest.raises(ValidationError) as exc_info:
        UserRegisterRequest.model_validate(
            {**VALID_REGISTER, "password": "a" * 73},
        )
    assert "72" in str(exc_info.value)


def test_login_rejects_password_over_72_bytes() -> None:
    with pytest.raises(ValidationError):
        UserLoginRequest.model_validate(
            {"email": "maya@acme.example", "password": "a" * 73},
        )


def test_register_accepts_8_to_72_byte_password() -> None:
    request = UserRegisterRequest.model_validate(
        {**VALID_REGISTER, "password": "a" * 72},
    )
    assert request.password == "a" * 72
