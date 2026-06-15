"""Scout eval: real Exa search + LLM-as-judge + deterministic recall metrics.

Parametrised over EVAL_SCOUT_MODELS × scout_topics.json. Uses the real Exa API
(EXA_API_KEY must be set). A test only fails on infrastructure errors.
"""

from __future__ import annotations

from urllib.parse import urlparse
from uuid import uuid4

import httpx
import pytest

from app.agents.scout import ScoutAgent, ScoutValidationError
from app.agents.scout_graph import ScoutOutput, run_scout
from app.models.events import ProgressEvent
from app.models.research import Source
from app.services.search import ExaSearchClient
from tests.evals._harness import (
    RUBRIC_SEARCH_QUERY_QUALITY,
    RUBRIC_SOURCE_RELEVANCE,
    EvalConfig,
    judge,
    load_eval_config,
)
from tests.evals._loaders import CuratedSource, ScoutTopic, load_scout_topics
from tests.evals._reporting import EvalRecorder

_TIER_MIDPOINTS = {"high": 0.85, "medium": 0.55, "low": 0.30}

_cfg = load_eval_config()
_TOPICS = load_scout_topics()
_PARAMS = [(m, t) for m in _cfg.scout_models for t in _TOPICS]


async def _noop(_: ProgressEvent) -> None:
    """No-op event publisher; evals don't need progress events."""


@pytest.mark.agent_eval
@pytest.mark.parametrize(
    "model,topic_obj",
    _PARAMS,
    ids=[f"{m.split('/')[-1]}__{t.id}" for m, t in _PARAMS],
)
async def test_scout_quality(
    model: str,
    topic_obj: ScoutTopic,
    eval_config: EvalConfig,
    eval_recorder: EvalRecorder,
    http_client: httpx.AsyncClient,
) -> None:
    search_client = ExaSearchClient(http_client=http_client)
    agent = ScoutAgent(model, search_client=search_client)
    try:
        result: ScoutOutput = await run_scout(
            job_id=uuid4(),
            topic=topic_obj.topic,
            agent=agent,
            publish=_noop,
        )
    except ScoutValidationError as exc:
        # Candidate-quality failure (decompose never produced a usable list),
        # not infrastructure. Exa/network errors are NOT caught here — those are
        # genuine infrastructure failures and should fail the run.
        eval_recorder.record("scout", model, topic_obj.id, "output_valid", 0.0, str(exc))
        eval_recorder.record_output(
            "scout", model, topic_obj.id, f"**SCOUT FAILED after retries:**\n\n{exc}"
        )
        return
    eval_recorder.record("scout", model, topic_obj.id, "output_valid", 1.0)
    eval_recorder.record_output("scout", model, topic_obj.id, _format_scout(result))

    # -- deterministic metrics ------------------------------------------------
    recall, recall_detail = _curated_recall(result.sources, topic_obj.curated_sources)
    eval_recorder.record("scout", model, topic_obj.id, "curated_recall", recall, recall_detail)

    cal, cal_detail = _credibility_calibration(result.sources, topic_obj.curated_sources)
    eval_recorder.record("scout", model, topic_obj.id, "credibility_calibration", cal, cal_detail)

    # -- LLM judge ------------------------------------------------------------
    sub_q_block = "\n".join(f"- {q}" for q in result.sub_questions)
    sq_score = await judge(
        judge_model=eval_config.judge_model,
        rubric=RUBRIC_SEARCH_QUERY_QUALITY,
        content=f"Topic: {topic_obj.topic}\n\nSub-questions:\n{sub_q_block}",
    )
    eval_recorder.record(
        "scout",
        model,
        topic_obj.id,
        "search_query_quality",
        sq_score.score,
        sq_score.reasoning,
    )

    source_block = "\n".join(
        f"- {s.title} ({s.url}): {s.snippet[:200]}" for s in result.sources[:15]
    )
    rel_score = await judge(
        judge_model=eval_config.judge_model,
        rubric=RUBRIC_SOURCE_RELEVANCE,
        content=f"Topic: {topic_obj.topic}\n\nRetrieved sources:\n{source_block}",
    )
    eval_recorder.record(
        "scout",
        model,
        topic_obj.id,
        "source_relevance_judge",
        rel_score.score,
        rel_score.reasoning,
    )


# ---- transcript + metric helpers --------------------------------------------


def _format_scout(result: ScoutOutput) -> str:
    """Render Scout output (sub-questions + scored sources) as Markdown for review."""
    parts = ["**Sub-questions:**"]
    parts.extend(f"- {q}" for q in result.sub_questions)
    parts.append(f"\n**Sources ({len(result.sources)}):**")
    for s in result.sources:
        parts.append(
            f"- **{s.title}** (cred {s.credibility:.2f}, rel {s.relevance:.2f}) — {s.url}\n"
            f"  > {s.snippet[:200]}"
        )
    return "\n".join(parts)


def _registrable_domain(url: str) -> str:
    """Extract the two-label registrable domain (eTLD+1 approximation).

    Simple heuristic adequate for well-known curated sources. Both sides of
    the recall comparison use the same extraction, so the metric is consistent
    even for the few domains (e.g. co.uk) where two labels is not enough.
    """
    host = urlparse(url).hostname or ""
    parts = host.lower().split(".")
    return ".".join(parts[-2:]) if len(parts) >= 2 else host


def _curated_recall(
    sources: list[Source],
    curated: list[CuratedSource],
) -> tuple[float, str]:
    """Fraction of curated sources whose registrable domain Scout rediscovered."""
    if not curated:
        return 1.0, "no curated sources"
    scout_domains = {_registrable_domain(str(s.url)) for s in sources}
    matched = [cs for cs in curated if _registrable_domain(cs.url) in scout_domains]
    detail = f"matched {len(matched)}/{len(curated)}: " + ", ".join(
        _registrable_domain(cs.url) for cs in matched
    )
    return round(len(matched) / len(curated), 4), detail


def _credibility_calibration(
    sources: list[Source],
    curated: list[CuratedSource],
) -> tuple[float, str]:
    """1 - mean_abs_error between Scout's credibility scores and curated tier midpoints.

    Only sources whose domain matches a curated entry with a known tier
    contribute to the error. If no sources match, returns 1.0 (vacuously
    perfect calibration) with a note.
    """
    curated_by_domain = {_registrable_domain(cs.url): cs.tier for cs in curated}
    errors: list[float] = []
    for src in sources:
        domain = _registrable_domain(str(src.url))
        tier = curated_by_domain.get(domain)
        if tier is None:
            continue
        midpoint = _TIER_MIDPOINTS.get(tier)
        if midpoint is None:
            continue
        errors.append(abs(src.credibility - midpoint))
    if not errors:
        return 1.0, "no curated-domain matches found"
    mae = sum(errors) / len(errors)
    return round(1.0 - mae, 4), f"mae={mae:.3f} over {len(errors)} matched domains"
