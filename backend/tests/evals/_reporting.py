"""EvalRecorder: collect metric rows and emit a leaderboard on session teardown."""

from __future__ import annotations

import json
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path

_RESULTS_DIR = Path(__file__).parent / "results"


@dataclass
class MetricRow:
    agent: str
    model: str
    case_id: str
    metric: str
    value: float
    detail: str = ""


@dataclass
class OutputRow:
    """A pre-rendered Markdown transcript of one agent's output for a case.

    Tests format their own output because each agent has a different shape;
    the recorder stays agnostic and just collates them into a transcript file
    for manual inspection.
    """

    agent: str
    model: str
    case_id: str
    content_md: str


class EvalRecorder:
    """Accumulate per-case metric rows and write a leaderboard at session teardown.

    Calling `.dump()` in a pytest session-scoped fixture finalizer ensures
    artifacts are written even when individual tests error.
    """

    def __init__(self) -> None:
        self._rows: list[MetricRow] = []
        self._outputs: list[OutputRow] = []

    def record(
        self,
        agent: str,
        model: str,
        case_id: str,
        metric: str,
        value: float,
        detail: str = "",
    ) -> None:
        self._rows.append(
            MetricRow(
                agent=agent,
                model=model,
                case_id=case_id,
                metric=metric,
                value=value,
                detail=detail,
            )
        )

    def record_output(self, agent: str, model: str, case_id: str, content_md: str) -> None:
        """Capture a Markdown transcript of an agent's raw output for manual review."""
        self._outputs.append(
            OutputRow(agent=agent, model=model, case_id=case_id, content_md=content_md)
        )

    def dump(self) -> None:
        """Write JSON + Markdown artifacts and print the summary table."""
        if not self._rows and not self._outputs:
            return
        _RESULTS_DIR.mkdir(exist_ok=True)
        timestamp = datetime.now(UTC).strftime("%Y%m%dT%H%M%SZ")
        if self._rows:
            self._write_json(timestamp)
            self._write_md(timestamp)
            self._print_table()
        if self._outputs:
            self._write_outputs_md(timestamp)

    # ---- internals ----------------------------------------------------------

    def _compute_means(self) -> dict[str, dict[str, dict[str, float]]]:
        """Compute per-(agent, model, metric) means across all recorded cases."""
        sums: dict[tuple[str, str, str], list[float]] = {}
        for row in self._rows:
            key = (row.agent, row.model, row.metric)
            if key not in sums:
                sums[key] = []
            sums[key].append(row.value)
        means: dict[str, dict[str, dict[str, float]]] = {}
        for key, vals in sums.items():
            agent, model, metric = key
            if agent not in means:
                means[agent] = {}
            if model not in means[agent]:
                means[agent][model] = {}
            means[agent][model][metric] = round(sum(vals) / len(vals), 3)
        return means

    def _write_json(self, timestamp: str) -> None:
        path = _RESULTS_DIR / f"{timestamp}.json"
        data = [
            {
                "agent": r.agent,
                "model": r.model,
                "case_id": r.case_id,
                "metric": r.metric,
                "value": r.value,
                "detail": r.detail,
            }
            for r in self._rows
        ]
        path.write_text(json.dumps(data, indent=2))
        print(f"\nEval results written to {path}")

    def _write_md(self, timestamp: str) -> None:
        means = self._compute_means()
        lines: list[str] = [f"# Eval Results — {timestamp}\n"]
        for agent, models in sorted(means.items()):
            lines.append(f"## {agent}\n")
            all_metrics = sorted({m for mm in models.values() for m in mm})
            header = "| model | " + " | ".join(all_metrics) + " |"
            sep = "|---|" + "---|" * len(all_metrics)
            lines.append(header)
            lines.append(sep)
            for model_name, metrics in sorted(models.items()):
                vals = " | ".join(str(metrics.get(m, "-")) for m in all_metrics)
                lines.append(f"| {model_name} | {vals} |")
            lines.append("")
        path = _RESULTS_DIR / f"{timestamp}.md"
        path.write_text("\n".join(lines))

    def _print_table(self) -> None:
        means = self._compute_means()
        print("\n=== Eval Summary ===")
        for agent, models in sorted(means.items()):
            print(f"\n[{agent}]")
            all_metrics = sorted({m for mm in models.values() for m in mm})
            col_w = 30
            header = f"  {'model':<{col_w}}" + "".join(f"{m:<{col_w}}" for m in all_metrics)
            print(header)
            for model_name, metrics in sorted(models.items()):
                values = "".join(f"{metrics.get(m, float('nan')):<{col_w}.3f}" for m in all_metrics)
                print(f"  {model_name:<{col_w}}" + values)

    def _write_outputs_md(self, timestamp: str) -> None:
        """Write a human-readable transcript of every agent output, grouped agent → case → model."""
        lines: list[str] = [f"# Eval Agent Outputs — {timestamp}\n"]
        for agent in sorted({o.agent for o in self._outputs}):
            lines.append(f"## {agent}\n")
            agent_rows = [o for o in self._outputs if o.agent == agent]
            for case_id in sorted({o.case_id for o in agent_rows}):
                lines.append(f"### case: {case_id}\n")
                for out in sorted(
                    (o for o in agent_rows if o.case_id == case_id),
                    key=lambda o: o.model,
                ):
                    lines.append(f"#### model: {out.model}\n")
                    lines.append(out.content_md.rstrip())
                    lines.append("")
        path = _RESULTS_DIR / f"{timestamp}_outputs.md"
        path.write_text("\n".join(lines))
        print(f"Eval agent outputs written to {path}")
