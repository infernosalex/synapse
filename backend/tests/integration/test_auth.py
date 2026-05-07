"""Integration tests for the auth flow: register → login → current user."""

from __future__ import annotations

import uuid

import pytest
from httpx import AsyncClient

pytestmark = pytest.mark.integration


@pytest.mark.asyncio
async def test_register_login_me(client: AsyncClient) -> None:
    email = f"test-{uuid.uuid4()}@example.com"
    password = "Test1234!"

    # Register a new user.
    resp = await client.post(
        "/api/auth/register",
        json={"email": email, "password": password},
    )
    assert resp.status_code == 201, resp.text
    assert resp.json()["email"] == email
    assert resp.json()["is_active"] is True

    # Log in. CookieTransport returns 204 No Content with a Set-Cookie header.
    resp = await client.post(
        "/api/auth/login",
        data={"username": email, "password": password},
    )
    assert resp.status_code == 204, resp.text
    assert "synapse_auth" in client.cookies

    # The httpx client sends the cookie automatically on subsequent requests.
    resp = await client.get("/api/auth/users/me")
    assert resp.status_code == 200, resp.text
    assert resp.json()["email"] == email


@pytest.mark.asyncio
async def test_me_unauthenticated(client: AsyncClient) -> None:
    resp = await client.get("/api/auth/users/me")
    assert resp.status_code == 401
