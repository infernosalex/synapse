"""Auth router: registers all fastapi-users sub-routers under /api/auth."""

from __future__ import annotations

from fastapi import APIRouter

from app.auth.dependencies import auth_app, cookie_backend
from app.auth.schemas import UserCreate, UserRead, UserUpdate

router = APIRouter()

router.include_router(
    auth_app.get_auth_router(cookie_backend),
    tags=["auth"],
)
router.include_router(
    auth_app.get_register_router(UserRead, UserCreate),
    tags=["auth"],
)
router.include_router(
    auth_app.get_users_router(UserRead, UserUpdate),
    prefix="/users",
    tags=["auth"],
)
