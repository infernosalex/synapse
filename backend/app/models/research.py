"""Pydantic models for the research domain.

These are the canonical API/agent boundary types.
The matching SQLAlchemy ORM tables live in app/models/orm.py; keep the two in sync when adding fields.
"""

from __future__ import annotations

from datetime import UTC, datetime
from enum import StrEnum
from uuid import UUID

from pydantic import BaseModel, Field, HttpUrl, model_validator

REQUIRED_MODEL_AGENTS = ("scout", "scribe", "critic")


class JobStatus(StrEnum):
    PENDING = "pending"
    SCOUTING = "scouting"
    SYNTHESIZING = "synthesizing"
    CRITIQUING = "critiquing"
    COMPLETED = "completed"
    FAILED = "failed"


class Depth(StrEnum):
    SHALLOW = "shallow"
    STANDARD = "standard"
    DEEP = "deep"


class ResearchRequest(BaseModel):
    """Inbound request body for POST /api/research."""

    topic: str = Field(..., min_length=3, max_length=500)
    language: str = Field(default="en", min_length=2, max_length=8)
    depth: Depth = Depth.STANDARD
    # Per-agent model IDs keyed by agent name. Each `REQUIRED_MODEL_AGENTS` entry must be present and non-empty: the orchestrator looks up `job.models[agent]` per phase, and a missing key would fail mid-run rather than at request time.
    models: dict[str, str] = Field(...)

    @model_validator(mode="after")
    def _require_all_agent_models(self) -> ResearchRequest:
        missing = [a for a in REQUIRED_MODEL_AGENTS if not self.models.get(a)]
        if missing:
            msg = f"models must include non-empty entries for: {', '.join(missing)}"
            raise ValueError(msg)
        return self


class ResearchJob(BaseModel):
    """Job descriptor returned to the client on creation and status queries."""

    id: UUID
    topic: str
    language: str = "en"
    depth: Depth = Depth.STANDARD
    models: dict[str, str] = Field(default_factory=dict)
    status: JobStatus = JobStatus.PENDING
    progress: float = Field(default=0.0, ge=0.0, le=1.0)
    error: str | None = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    completed_at: datetime | None = None


class Source(BaseModel):
    """A single source gathered by Scout, referenced by Scribe and Critic."""

    id: str  # short form: "s1", "s2", ... unique within a job
    url: HttpUrl
    title: str
    author: str | None = None
    published_at: datetime | None = None
    credibility: float = Field(ge=0.0, le=1.0)
    relevance: float = Field(ge=0.0, le=1.0)
    snippet: str  # quoted excerpt used for inline citation


class ReportSection(BaseModel):
    id: str  # "sec1", "sec2", ... sequential, unique within report
    heading: str
    # GFM markdown; factual claims wrapped in <span data-claim="secN.cM">.
    body_md: str
    cited_source_ids: list[str]  # subset of ScribeReport.sources[].id


class Contradiction(BaseModel):
    description: str
    source_ids: list[str]


class ScribeReport(BaseModel):
    id: UUID
    job_id: UUID
    topic: str
    title: str
    summary_md: str
    sections: list[ReportSection]
    sources: list[Source]
    contradictions: list[Contradiction]
    follow_ups: list[str]
    generated_at: datetime
    model: str  # which OpenRouter model produced this (audit trail)


class Verdict(StrEnum):
    SUPPORTED = "supported"
    PARTIALLY_SUPPORTED = "partially_supported"
    UNSUPPORTED = "unsupported"
    CONTRADICTED = "contradicted"


class ClaimFlag(BaseModel):
    claim_id: str  # matches data-claim="secN.cM" in body_md
    section_id: str  # redundant with claim_id prefix; kept for fast lookup
    verdict: Verdict
    rationale: str
    supporting_source_ids: list[str]  # empty when verdict is unsupported


class SectionConfidence(BaseModel):
    section_id: str
    score: float = Field(ge=0.0, le=1.0)
    reasoning: str


class CriticAnnotations(BaseModel):
    id: UUID
    report_id: UUID
    section_confidence: list[SectionConfidence]
    claim_flags: list[ClaimFlag]
    overall_confidence: float = Field(ge=0.0, le=1.0)
    model: str
    generated_at: datetime


class VerifiedReport(BaseModel):
    """Full response returned to the frontend once a job has completed."""

    job: ResearchJob
    report: ScribeReport
    annotations: CriticAnnotations
