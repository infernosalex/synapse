"""Critic - fact-checking agent.

Verifies the Scribe report against the original sources, scores confidence
per section, flags unsupported claims (hallucinations).
"""

from __future__ import annotations

from app.models.research import ScribeReport, Source, VerifiedReport


class CriticAgent:
    def __init__(self, model: str) -> None:
        self.model = model

    async def verify(self, report: ScribeReport, sources: list[Source]) -> VerifiedReport:
        """Verify each claim in the report against sources."""
        raise NotImplementedError

    async def score_section(self, section_text: str, sources: list[Source]) -> float:
        """Compute confidence score in [0, 1] for one section."""
        raise NotImplementedError

    async def flag_hallucinations(self, report: ScribeReport, sources: list[Source]) -> list[str]:
        """Return a list of flagged unsupported claims."""
        raise NotImplementedError
