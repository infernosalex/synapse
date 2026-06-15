"""Scribe eval: LLM-as-judge + deterministic citation metrics.

Parametrised over EVAL_SCRIBE_MODELS × scribe_cases.json. A test only fails
on infrastructure errors (agent raises, judge unreachable, malformed fixture);
low quality scores are recorded and printed but never cause failure.
"""

from __future__ import annotations

import re
from uuid import uuid4

import pytest

from app.agents.scribe import ScribeAgent
from app.models.research import ReportSection, ScribeReport
from app.services.validation import ScribeValidationError
from tests.evals._harness import (
    RUBRIC_COHERENCE,
    RUBRIC_FACTUAL_ACCURACY,
    RUBRIC_STRUCTURE_QUALITY,
    EvalConfig,
    judge,
    load_eval_config,
)
from tests.evals._loaders import ScribeCase, load_scribe_cases
from tests.evals._reporting import EvalRecorder

# Replicated from app.services.validation (those symbols are module-private).
_CLAIM_SPAN_RE = re.compile(
    r"<span\b[^>]*\bdata-claim\s*=\s*['\"][^'\"]+['\"][^>]*>",
    re.IGNORECASE,
)
_CLAIM_SPAN_BLOCK_RE = re.compile(
    r"<span\b[^>]*\bdata-claim\s*=\s*['\"][^'\"]+['\"][^>]*>(.*?)</span>",
    re.IGNORECASE | re.DOTALL,
)
_FOOTNOTE_REF_RE = re.compile(r"\[\^?(s\d+)\]")

# Computed at collection time so pytest.mark.parametrize can use the values.
# Uses the same env-reading logic as the `eval_config` fixture; the fixture
# is still needed at test time for the (potentially different) judge_model.
_cfg = load_eval_config()
_CASES = load_scribe_cases()
_PARAMS = [(m, c) for m in _cfg.scribe_models for c in _CASES]


@pytest.mark.agent_eval
@pytest.mark.parametrize(
    "model,case_obj",
    _PARAMS,
    ids=[f"{m.split('/')[-1]}__{c.id}" for m, c in _PARAMS],
)
async def test_scribe_quality(
    model: str,
    case_obj: ScribeCase,
    eval_config: EvalConfig,
    eval_recorder: EvalRecorder,
) -> None:
    agent = ScribeAgent(model)
    try:
        report = await agent.synthesize(
            job_id=uuid4(),
            topic=case_obj.topic,
            sub_questions=case_obj.sub_questions,
            sources=case_obj.sources,
        )
    except ScribeValidationError as exc:
        # A model that cannot produce a schema-valid report after retries is a
        # candidate-quality failure, not an infrastructure error. Record it as a
        # 0 on output_valid (report-only) rather than failing the test red.
        eval_recorder.record("scribe", model, case_obj.id, "output_valid", 0.0, str(exc))
        eval_recorder.record_output(
            "scribe", model, case_obj.id, f"**SYNTHESIS FAILED after retries:**\n\n{exc}"
        )
        return
    eval_recorder.record("scribe", model, case_obj.id, "output_valid", 1.0)
    eval_recorder.record_output("scribe", model, case_obj.id, _format_report(report))

    # -- deterministic metrics ------------------------------------------------
    cov, cov_detail = _citation_coverage(report.sections)
    eval_recorder.record("scribe", model, case_obj.id, "citation_coverage", cov, cov_detail)

    density = _claim_density(report.sections)
    eval_recorder.record("scribe", model, case_obj.id, "claim_density", density)

    # -- LLM judge ------------------------------------------------------------
    body = "\n\n".join(f"## {s.heading}\n{s.body_md}" for s in report.sections)
    source_block = "\n\n".join(
        f"[{s.id}] {s.title}\nSnippet: {s.snippet}" for s in case_obj.sources
    )

    coherence = await judge(
        judge_model=eval_config.judge_model,
        rubric=RUBRIC_COHERENCE,
        content=f"Topic: {case_obj.topic}\n\nReport:\n{body}",
    )
    eval_recorder.record(
        "scribe",
        model,
        case_obj.id,
        "coherence",
        coherence.score,
        coherence.reasoning,
    )

    factual = await judge(
        judge_model=eval_config.judge_model,
        rubric=RUBRIC_FACTUAL_ACCURACY,
        content=(f"Topic: {case_obj.topic}\n\nSources:\n{source_block}\n\nReport:\n{body}"),
    )
    eval_recorder.record(
        "scribe",
        model,
        case_obj.id,
        "factual_accuracy",
        factual.score,
        factual.reasoning,
    )

    structure = await judge(
        judge_model=eval_config.judge_model,
        rubric=RUBRIC_STRUCTURE_QUALITY,
        content=(
            f"Title: {report.title}\n"
            f"Summary: {report.summary_md}\n"
            f"Sections ({len(report.sections)}): "
            + ", ".join(f'"{s.heading}"' for s in report.sections)
        ),
    )
    eval_recorder.record(
        "scribe",
        model,
        case_obj.id,
        "structure_quality",
        structure.score,
        structure.reasoning,
    )


# ---- transcript + metric helpers --------------------------------------------


def _format_report(report: ScribeReport) -> str:
    """Render a Scribe report as Markdown for the manual-review transcript."""
    parts = [f"**Title:** {report.title}", f"**Summary:** {report.summary_md}", ""]
    for section in report.sections:
        parts.append(f"##### {section.heading} (`{section.id}`)")
        parts.append(section.body_md)
        parts.append("")
    if report.contradictions:
        parts.append("**Contradictions:**")
        for c in report.contradictions:
            positions = " | ".join(
                f"{p.statement} ({', '.join(p.source_ids)})" for p in c.positions
            )
            parts.append(f"- {c.topic}: {positions}")
    if report.follow_ups:
        parts.append("**Follow-ups:** " + "; ".join(report.follow_ups))
    return "\n".join(parts)


def _citation_coverage(sections: list[ReportSection]) -> tuple[float, str]:
    """Fraction of claim spans that contain at least one footnote reference."""
    total = 0
    cited = 0
    for section in sections:
        for content in _CLAIM_SPAN_BLOCK_RE.findall(section.body_md):
            total += 1
            if _FOOTNOTE_REF_RE.search(content):
                cited += 1
    if total == 0:
        return 1.0, "0/0 spans (no claims)"
    return round(cited / total, 4), f"{cited}/{total} spans"


def _claim_density(sections: list[ReportSection]) -> float:
    """Average number of claim spans per section (informational)."""
    if not sections:
        return 0.0
    total = sum(len(_CLAIM_SPAN_RE.findall(s.body_md)) for s in sections)
    return round(total / len(sections), 2)
