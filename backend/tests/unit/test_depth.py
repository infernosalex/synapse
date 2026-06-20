"""Unit tests for depth tuning profiles."""

from __future__ import annotations

import pytest

from app.agents import depth as depth_module
from app.agents.depth import PROFILES, SUB_QUESTION_STRUCT_MAX, SUB_QUESTION_STRUCT_MIN, profile_for
from app.models.research import Depth


def test_profile_for_returns_each_depth_profile() -> None:
    for depth in Depth:
        profile = profile_for(depth)
        assert profile is PROFILES[depth]


def test_standard_profile_matches_documented_values() -> None:
    profile = profile_for(Depth.STANDARD)
    assert profile.sub_question_min == 3
    assert profile.sub_question_max == 5
    assert profile.results_per_question == 5
    assert profile.text_max_characters == 8000
    assert profile.section_min == 3
    assert profile.section_max == 5
    assert profile.summary_sentence_min == 2
    assert profile.summary_sentence_max == 4
    assert profile.body_detail == "standard"


def test_profile_for_falls_back_to_standard_for_missing_depth(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    standard = PROFILES[Depth.STANDARD]
    monkeypatch.setattr(
        depth_module,
        "PROFILES",
        {depth: profile for depth, profile in PROFILES.items() if depth != Depth.DEEP},
    )
    assert profile_for(Depth.DEEP) == standard


def test_sub_question_struct_bounds_match_profile_envelope() -> None:
    assert min(p.sub_question_min for p in PROFILES.values()) == SUB_QUESTION_STRUCT_MIN
    assert max(p.sub_question_max for p in PROFILES.values()) == SUB_QUESTION_STRUCT_MAX
    assert SUB_QUESTION_STRUCT_MIN == 2
    assert SUB_QUESTION_STRUCT_MAX == 8
