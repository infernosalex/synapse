"""Integration coverage for follow-up lineage queries in `JobRepository`.

Exercises the real joins (`FollowUp` ↔ `ResearchJob`) against Postgres; the
pure mapping helper is unit-tested separately in `tests/unit/test_persistence.py`.
"""

from __future__ import annotations

import uuid

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.models import User
from app.models.orm import FollowUp, ResearchJob
from app.models.research import JobStatus
from app.services.persistence import JobNotFoundError, JobRepository

pytestmark = pytest.mark.integration


async def _user(session: AsyncSession) -> User:
    user = User(
        id=uuid.uuid4(),
        email=f"lineage-{uuid.uuid4()}@example.com",
        hashed_password="not-a-real-hash",
        is_active=True,
        is_superuser=False,
        is_verified=False,
    )
    session.add(user)
    await session.flush()
    return user


def _job(user_id: uuid.UUID, topic: str, status: JobStatus = JobStatus.COMPLETED) -> ResearchJob:
    return ResearchJob(
        id=uuid.uuid4(),
        user_id=user_id,
        topic=topic,
        models={"scout": "x", "scribe": "y", "critic": "z"},
        status=status.value,
    )


async def test_get_lineage_returns_parent_and_children(async_session: AsyncSession) -> None:
    user = await _user(async_session)
    parent = _job(user.id, "Parent topic")
    child_a = _job(user.id, "Child A", status=JobStatus.SCOUTING)
    child_b = _job(user.id, "Child B")
    async_session.add_all([parent, child_a, child_b])
    await async_session.flush()
    async_session.add_all(
        [
            FollowUp(parent_job_id=parent.id, child_job_id=child_a.id, question="Q-A"),
            FollowUp(parent_job_id=parent.id, child_job_id=child_b.id, question="Q-B"),
        ]
    )
    await async_session.commit()

    repo = JobRepository(async_session)

    parent_lineage = await repo.get_lineage(parent.id, user_id=user.id)
    assert parent_lineage.parent is None
    assert {c.question for c in parent_lineage.children} == {"Q-A", "Q-B"}
    child_a_link = next(c for c in parent_lineage.children if c.question == "Q-A")
    assert child_a_link.job_id == child_a.id
    assert child_a_link.topic == "Child A"
    assert child_a_link.status is JobStatus.SCOUTING

    child_lineage = await repo.get_lineage(child_a.id, user_id=user.id)
    assert child_lineage.children == []
    assert child_lineage.parent is not None
    assert child_lineage.parent.job_id == parent.id
    assert child_lineage.parent.topic == "Parent topic"
    assert child_lineage.parent.question == "Q-A"


async def test_get_lineage_rejects_other_users_job(async_session: AsyncSession) -> None:
    owner = await _user(async_session)
    other = await _user(async_session)
    job = _job(owner.id, "Owned")
    async_session.add(job)
    await async_session.commit()

    repo = JobRepository(async_session)
    with pytest.raises(JobNotFoundError):
        await repo.get_lineage(job.id, user_id=other.id)


async def test_get_follow_up_parent_id(async_session: AsyncSession) -> None:
    user = await _user(async_session)
    parent = _job(user.id, "Parent")
    child = _job(user.id, "Child")
    standalone = _job(user.id, "Standalone")
    async_session.add_all([parent, child, standalone])
    await async_session.flush()
    async_session.add(FollowUp(parent_job_id=parent.id, child_job_id=child.id, question="Q"))
    await async_session.commit()

    repo = JobRepository(async_session)
    assert await repo.get_follow_up_parent_id(child.id) == parent.id
    assert await repo.get_follow_up_parent_id(standalone.id) is None
