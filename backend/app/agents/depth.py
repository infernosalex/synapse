"""Depth tuning profiles for Scout, Scribe, and preview.

Single source of truth for every runtime knob that varies by `Depth`. Scout,
Scribe, the orchestrator, and the preview route all read from here rather than
hard-coding bounds in each module.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

from app.models.research import Depth

BodyDetail = Literal["concise", "standard", "thorough"]


@dataclass(frozen=True, slots=True)
class DepthProfile:
    sub_question_min: int
    sub_question_max: int
    results_per_question: int
    text_max_characters: int
    section_min: int
    section_max: int
    summary_sentence_min: int
    summary_sentence_max: int
    body_detail: BodyDetail


PROFILES: dict[Depth, DepthProfile] = {
    Depth.SHALLOW: DepthProfile(
        sub_question_min=2,
        sub_question_max=3,
        results_per_question=3,
        text_max_characters=4000,
        section_min=2,
        section_max=3,
        summary_sentence_min=1,
        summary_sentence_max=2,
        body_detail="concise",
    ),
    Depth.STANDARD: DepthProfile(
        sub_question_min=3,
        sub_question_max=5,
        results_per_question=5,
        text_max_characters=8000,
        section_min=3,
        section_max=5,
        summary_sentence_min=2,
        summary_sentence_max=4,
        body_detail="standard",
    ),
    Depth.DEEP: DepthProfile(
        sub_question_min=5,
        sub_question_max=8,
        results_per_question=8,
        text_max_characters=12000,
        section_min=5,
        section_max=8,
        summary_sentence_min=4,
        summary_sentence_max=6,
        body_detail="thorough",
    ),
}

SUB_QUESTION_STRUCT_MIN = min(p.sub_question_min for p in PROFILES.values())
SUB_QUESTION_STRUCT_MAX = max(p.sub_question_max for p in PROFILES.values())


def profile_for(depth: Depth) -> DepthProfile:
    """Return the tuning profile for `depth`, falling back to standard if missing."""
    return PROFILES.get(depth, PROFILES[Depth.STANDARD])
