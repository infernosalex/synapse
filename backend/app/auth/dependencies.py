"""Auth backend, FastAPIUsers instance, and request-scoped user dependencies."""

from __future__ import annotations

import uuid

from fastapi_users import FastAPIUsers
from fastapi_users.authentication import (
    AuthenticationBackend,
    CookieTransport,
    JWTStrategy,
)

from app.auth.manager import get_user_manager
from app.auth.models import User
from app.config import get_settings

_settings = get_settings()

# httpOnly cookie storing the JWT. Browsers send it automatically on HTTP and
# WebSocket handshakes (same-origin in prod via the nginx reverse proxy, dev
# via the Vite proxy). The WS handler decodes the JWT directly from the cookie
# using the same secret.
cookie_transport = CookieTransport(
    cookie_name="synapse_auth",
    cookie_max_age=86400,
    cookie_httponly=True,
    cookie_samesite="lax",
    cookie_secure=_settings.cookie_secure,
)


def _get_jwt_strategy() -> JWTStrategy[User, uuid.UUID]:
    return JWTStrategy(secret=_settings.jwt_secret, lifetime_seconds=86400)


cookie_backend = AuthenticationBackend(
    name="cookie",
    transport=cookie_transport,
    get_strategy=_get_jwt_strategy,
)

auth_app: FastAPIUsers[User, uuid.UUID] = FastAPIUsers(
    get_user_manager,
    [cookie_backend],
)

current_active_user = auth_app.current_user(active=True)
current_superuser = auth_app.current_user(active=True, superuser=True)
