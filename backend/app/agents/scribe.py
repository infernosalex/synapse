"""Scribe - synthesis agent.

Turns Scout's raw sources into a structured, cited report.
"""

from __future__ import annotations

from app.models.research import ScribeReport, Source


class ScribeAgent:
    def __init__(self, model: str) -> None:
        self.model = model

    async def synthesize(self, topic: str, sources: list[Source]) -> ScribeReport:
        """Synthesise a structured report with citations & summary."""
        raise NotImplementedError

    async def contradictions(self, sources: list[Source]) -> list[str]:
        """Identify contradictions between sources."""
        raise NotImplementedError
