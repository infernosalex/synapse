/**
 * Extract the domain hostname from a URL, stripping the `www.` prefix.
 * Falls back to the raw string if the URL is invalid.
 */
export function extractDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

/**
 * Map a credibility/relevance score (0–1) to a design-system colour token.
 * Thresholds match the Figma spec used by SourcePill and MarginPanel:
 *   > 0.9 → scout (high confidence)
 *   > 0.8 → scribe (mid-high)
 *   > 0.6 → muted (borderline)
 *   else  → critic (low)
 */
export function credibilityColor(score: number): string {
  if (score > 0.9) return 'var(--scout)'
  if (score > 0.8) return 'var(--scribe)'
  if (score > 0.6) return 'var(--muted)'
  return 'var(--critic)'
}
