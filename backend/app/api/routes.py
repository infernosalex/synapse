"""HTTP route handlers."""

from __future__ import annotations

from uuid import UUID, uuid4

from fastapi import APIRouter, status

from app.models.research import (
    JobStatus,
    ResearchJob,
    ResearchRequest,
)

router = APIRouter()


@router.post(
    "/research",
    response_model=ResearchJob,
    status_code=status.HTTP_202_ACCEPTED,
    tags=["research"],
)
async def start_research(payload: ResearchRequest) -> ResearchJob:
    """Queue a new research job.

    TODO: persist job to DB, push to taskiq, hand off to orchestrator.
    """
    job_id: UUID = uuid4()
    return ResearchJob(
        id=job_id,
        topic=payload.topic,
        language=payload.language,
        depth=payload.depth,
        models=payload.models,
        status=JobStatus.PENDING,
        progress=0.0,
    )
