import { credibilityColor } from '../lib/source-utils'

interface SourcePillProps {
  title: string
  credibility: number | null
}

export function SourcePill({ title, credibility }: SourcePillProps) {
  const color = credibility !== null ? credibilityColor(credibility) : 'var(--muted)'

  return (
    <div
      className="inline-flex items-center gap-1.5"
      style={{
        padding: '4px 8px',
        border: '1px solid var(--line-soft)',
        background: 'var(--bg)',
      }}
    >
      <span
        className="rounded-full shrink-0"
        style={{ width: 4, height: 4, background: color }}
        aria-hidden
      />
      <span className="font-sans text-[11px]" style={{ color: 'var(--fg-2)' }}>
        {title}
      </span>
      {credibility !== null ? (
        <span className="font-mono text-[9px]" style={{ color }}>
          .{Math.round(credibility * 100)}
        </span>
      ) : (
        // Loading pulse shown while the source_scored event for this source hasn't arrived yet.
        <span
          className="pulse-dot"
          style={{ color: 'var(--muted)' }}
          aria-label="loading credibility score"
        />
      )}
    </div>
  )
}
