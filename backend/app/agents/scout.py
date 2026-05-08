"""Scout - research agent.

Decomposes a user topic into sub-questions, searches multiple sources,
and evaluates relevance & credibility.
"""

from __future__ import annotations

from app.models.research import Source


class ScoutAgent:
    def __init__(self, model: str) -> None:
        self.model = model

    async def decompose(self, topic: str) -> list[str]:
        """Break a topic into sub-questions."""
        raise NotImplementedError

    async def search(self, query: str) -> list[Source]:
        """Run a query against external sources."""
        raise NotImplementedError

    async def evaluate(self, sources: list[Source]) -> list[Source]:
        """Score relevance for each source."""
        raise NotImplementedError

    async def score_source(self, source: Source) -> float:
        """Return credibility score in [0, 1]."""
        raise NotImplementedError

    async def deduplicate(self, sources: list[Source]) -> list[Source]:
        """Remove near-duplicates by URL / content fingerprint."""
        raise NotImplementedError
