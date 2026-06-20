import type { Depth } from '../types/api/types.gen'

/**
 * Display-only knobs mirroring `backend/app/agents/depth.py`.
 * Keep in sync when depth profiles change.
 */
const DEPTH_DISPLAY_PROFILES: Record<
  Depth,
  { resultsPerQuestion: number; baseMinutes: number; minutesPerQuestion: number }
> = {
  shallow: { resultsPerQuestion: 3, baseMinutes: 1, minutesPerQuestion: 0.5 },
  standard: { resultsPerQuestion: 5, baseMinutes: 1.5, minutesPerQuestion: 0.6 },
  deep: { resultsPerQuestion: 8, baseMinutes: 2, minutesPerQuestion: 0.75 },
}

/**
 * Rough wall-clock guess for the preview card — not backed by pipeline telemetry.
 * Base minutes cover fixed agent overhead; per-question minutes scale with the
 * kept sub-question count the user sees on this screen.
 */
export function estimateResearchDuration(depth: Depth, questionCount: number): string {
  const { baseMinutes, minutesPerQuestion } = DEPTH_DISPLAY_PROFILES[depth]
  const total = baseMinutes + minutesPerQuestion * questionCount
  const rounded = Math.max(1, Math.round(total))
  return `~ ${rounded} min`
}

/** Sources Scout will fetch ≈ results-per-question × kept sub-questions. */
export function estimateSourcesReviewed(depth: Depth, questionCount: number): string {
  const { resultsPerQuestion } = DEPTH_DISPLAY_PROFILES[depth]
  const count = resultsPerQuestion * questionCount
  if (count === 0) {
    return '0 sources reviewed'
  }
  return `~${count} sources reviewed`
}
