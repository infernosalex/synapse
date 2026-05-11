import type { ClaimFlag, ReportSection, Source } from '../types/api'

interface MarginPanelProps {
  section: ReportSection
  sources: Source[]
  claimFlags: ClaimFlag[]
}

function verdictAgent(verdict: ClaimFlag['verdict']): string {
  switch (verdict) {
    case 'supported':
      return 'scout'
    case 'partially_supported':
      return 'scribe'
    case 'unsupported':
    case 'contradicted':
      return 'critic'
  }
}

function verdictLabel(verdict: ClaimFlag['verdict']): string {
  switch (verdict) {
    case 'supported':
      return 'VERIFIED'
    case 'partially_supported':
      return 'PARTIAL'
    case 'unsupported':
      return 'UNSUPPORTED'
    case 'contradicted':
      return 'CONTRADICTED'
  }
}

export function MarginPanel({ section, sources, claimFlags }: MarginPanelProps) {
  const citedSources = sources.filter((s) => section.cited_source_ids?.includes(s.id))
  const sectionFlags = claimFlags.filter((f) => f.section_id === section.id)
  const indexMap = new Map(sources.map((s, i) => [s.id, i + 1]))

  return (
    <div style={{ padding: '56px 24px' }}>
      {citedSources.map((src) => (
        <div
          key={src.id}
          className="mb-3"
          style={{
            borderLeft: '2px solid var(--line)',
            paddingLeft: 10,
            paddingBottom: 10,
          }}
        >
          <div
            className="font-mono"
            style={{ fontSize: 9, letterSpacing: '0.1em', color: 'var(--muted)', marginBottom: 3 }}
          >
            [{indexMap.get(src.id) ?? '?'}]
          </div>
          <div
            className="serif truncate"
            style={{ fontSize: 11, lineHeight: 1.4, color: 'var(--fg-2)', maxWidth: 220 }}
            title={src.title}
          >
            {src.title}
          </div>
          <div className="flex items-center gap-1.5 mt-1">
            <div className="flex-1 h-[2px]" style={{ background: 'var(--line)' }}>
              <div
                style={{
                  width: `${Math.round(src.credibility * 100)}%`,
                  height: '100%',
                  background:
                    src.credibility > 0.8
                      ? 'var(--scout)'
                      : src.credibility > 0.6
                        ? 'var(--scribe)'
                        : 'var(--critic)',
                }}
              />
            </div>
            <span className="font-mono" style={{ fontSize: 9, color: 'var(--muted)' }}>
              .{Math.round(src.credibility * 100)}
            </span>
          </div>
        </div>
      ))}

      {sectionFlags.map((flag) => {
        const agent = verdictAgent(flag.verdict)
        return (
          <div
            key={flag.claim_id}
            style={{
              borderLeft: `2px solid var(--${agent})`,
              paddingLeft: 12,
              paddingBottom: 14,
              marginBottom: 18,
            }}
          >
            <div
              className="font-mono mb-1"
              style={{ fontSize: 9, letterSpacing: '0.12em', color: `var(--${agent})` }}
            >
              {verdictLabel(flag.verdict)}
            </div>
            <div className="serif" style={{ fontSize: 12, lineHeight: 1.5, color: 'var(--fg-2)' }}>
              {flag.rationale}
            </div>
          </div>
        )
      })}
    </div>
  )
}
