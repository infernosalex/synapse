import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { useNavigate, useParams } from '@tanstack/react-router'

import { AppNavbar, SynapseBrandLink } from '../components/AppNavbar'
import { ReportRenderer } from '../components/ReportRenderer'
import { Button } from '../components/ui/Button'
import { AGENTS, type Agent } from '../components/ui/Agent'
import { AgentDot } from '../components/ui/AgentDot'
import { TooltipProvider } from '../components/ui/Tooltip'
import { cn } from '../components/ui/cn'
import { credibilityColor } from '../lib/source-utils'
import {
  useDerivedJobState,
  type CurrentPhase,
  type SourceEntry,
} from '../hooks/useDerivedJobState'
import { useJobStream } from '../hooks/useJobStream'
import type { Source, Verdict } from '../types/api/types.gen'

const REPORT_REDIRECT_DELAY_MS = 1500

type BlockStatus = 'done' | 'active' | 'queue'

// Editorial role verbs, matching the landing pipeline visualisation so the
// live run reads as the same artifact the marketing page promises.
const AGENT_ROLE: Record<Agent, string> = {
  scout: 'researches',
  scribe: 'synthesises',
  critic: 'verifies',
}

function formatElapsed(seconds: number): string {
  const m = Math.floor(seconds / 60)
    .toString()
    .padStart(2, '0')
  const s = (seconds % 60).toString().padStart(2, '0')
  return `${m}:${s}`
}

function verdictLabel(verdict: Verdict): string {
  switch (verdict) {
    case 'supported':
      return 'Supported'
    case 'partially_supported':
      return 'Partial'
    case 'unsupported':
      return 'Unsupported'
    case 'contradicted':
      return 'Contradicted'
    default: {
      const _exhaustive: never = verdict
      return String(_exhaustive)
    }
  }
}

function verdictColor(verdict: Verdict): string {
  switch (verdict) {
    case 'supported':
      return 'var(--scout)'
    case 'partially_supported':
      return 'var(--scribe)'
    case 'unsupported':
    case 'contradicted':
      return 'var(--critic)'
    default: {
      const _exhaustive: never = verdict
      void _exhaustive
      return 'var(--muted)'
    }
  }
}

// The three pipeline blocks each resolve to done / active / queue. On `failed`
// we can't read the broken phase from `currentPhase` alone, so we infer it from
// the handoff flags (the first phase that never handed off is the one that
// broke) — same derivation the report's audit trail uses.
function blockStatuses(
  currentPhase: CurrentPhase,
  scoutComplete: boolean,
  scribeComplete: boolean,
): Record<Agent, BlockStatus> {
  const order: Agent[] = ['scout', 'scribe', 'critic']
  const resolve = (idx: number): BlockStatus => {
    if (currentPhase === 'done') return 'done'
    if (currentPhase === 'failed') {
      const failedIdx = !scoutComplete ? 0 : !scribeComplete ? 1 : 2
      if (idx < failedIdx) return 'done'
      if (idx === failedIdx) return 'active'
      return 'queue'
    }
    const currentIdx = order.indexOf(currentPhase as Agent)
    if (idx < currentIdx) return 'done'
    if (idx === currentIdx) return 'active'
    return 'queue'
  }
  return { scout: resolve(0), scribe: resolve(1), critic: resolve(2) }
}

export default function JobProgressPage() {
  const { jobId } = useParams({ from: '/research/$jobId' })
  const navigate = useNavigate()
  const { messages, status: wsStatus } = useJobStream(jobId)

  const derived = useDerivedJobState(messages)
  const {
    topic,
    currentPhase,
    subQuestions,
    sources,
    sections,
    claimFlags,
    overallConfidence,
    sourceCount,
    wordCount,
    claimCount,
    scoutComplete,
    scribeComplete,
    createdAt,
  } = derived

  const isTerminal = currentPhase === 'done' || currentPhase === 'failed'
  const isFailed = currentPhase === 'failed'

  // nowMs is updated by the interval so elapsed time stays in state rather than
  // calling Date.now() as an impure expression during render.
  const [nowMs, setNowMs] = useState(() => Date.now())

  useEffect(() => {
    if (!createdAt || isTerminal) return
    const id = setInterval(() => setNowMs(Date.now()), 1000)
    return () => clearInterval(id)
  }, [createdAt, isTerminal])

  const elapsedSeconds = createdAt
    ? Math.max(0, Math.floor((nowMs - new Date(createdAt).getTime()) / 1000))
    : 0

  const [completionMessage, setCompletionMessage] = useState<string | undefined>()

  useEffect(() => {
    if (currentPhase !== 'done') return
    // Defer the message update out of the synchronous effect body to dodge the
    // cascading-render lint rule; the 0ms timer still flushes this turn.
    const msgId = setTimeout(() => setCompletionMessage('Report ready — opening…'), 0)
    const navId = setTimeout(() => {
      void navigate({ to: '/research/$jobId/report', params: { jobId } })
    }, REPORT_REDIRECT_DELAY_MS)
    return () => {
      clearTimeout(msgId)
      clearTimeout(navId)
    }
  }, [currentPhase, jobId, navigate])

  const status = blockStatuses(currentPhase, scoutComplete, scribeComplete)
  const failedMessage = messages.find((m) => m.type === 'job_failed')

  const statusColor = isFailed
    ? 'var(--critic)'
    : currentPhase === 'done'
      ? 'var(--scout)'
      : 'var(--scribe)'

  const statusLabel = isFailed
    ? `Failed${failedMessage?.type === 'job_failed' ? ` — ${failedMessage.error}` : ''}`
    : currentPhase === 'done'
      ? 'Completed'
      : `In progress · ${formatElapsed(elapsedSeconds)} elapsed`

  const statusLabelShort = isFailed
    ? 'Failed'
    : currentPhase === 'done'
      ? 'Completed'
      : `In progress · ${formatElapsed(elapsedSeconds)}`

  const stageLine = isFailed
    ? 'Run halted'
    : currentPhase === 'done'
      ? 'Run complete'
      : currentPhase === 'scout'
        ? 'Stage 1 of 3 · Scout is researching'
        : currentPhase === 'scribe'
          ? 'Stage 2 of 3 · Scribe is writing'
          : 'Stage 3 of 3 · Critic is verifying'

  const latestSection = sections[sections.length - 1]

  return (
    <div className="flex flex-col min-h-screen bg-bg text-fg">
      {/* App chrome — brief → plan → run → report breadcrumb, live status, cancel */}
      <AppNavbar variant="app" className="flex items-center gap-3 sm:gap-4 px-4 sm:px-7 lg:px-10">
        <SynapseBrandLink
          className="flex items-center gap-2 sm:gap-2.5 shrink-0"
          labelClassName="serif hidden sm:inline-block"
          labelStyle={{ fontSize: '1rem', fontWeight: 500 }}
          markSize={22}
        />

        <span className="hidden sm:block w-px h-4 shrink-0 bg-line" aria-hidden />

        <nav className="flex items-center gap-2 min-w-0" aria-label="run breadcrumb">
          <Crumb className="hidden md:inline">New brief</Crumb>
          <CrumbSep className="hidden md:inline" />
          <Crumb>Plan</Crumb>
          <CrumbSep />
          <Crumb active>Run</Crumb>
          <CrumbSep className="hidden sm:inline" />
          <Crumb className="hidden sm:inline">Report</Crumb>
        </nav>

        <div
          className="ml-auto flex items-center gap-2 label shrink-0"
          style={{ color: statusColor }}
          aria-live="polite"
          aria-label="job status"
        >
          {!isTerminal && wsStatus === 'open' && <span className="pulse-dot" aria-hidden />}
          <span className="hidden md:inline">{statusLabel}</span>
          <span className="md:hidden">{statusLabelShort}</span>
        </div>

        {/* Cancel is a future capability; backend cancellation is not exposed yet. */}
        {/* TODO: wire up job cancellation endpoint */}
        <Button variant="ghost" size="sm" disabled className="hidden sm:inline-flex">
          Cancel
        </Button>
      </AppNavbar>

      {/* Connection-lost banner — muted stripe, non-intrusive */}
      {(wsStatus === 'error' || wsStatus === 'closed') && !isTerminal && (
        <div
          className="px-4 sm:px-7 py-2 text-center label bg-bg-2 border-b border-line"
          style={{ color: 'var(--muted)' }}
          role="alert"
          aria-live="assertive"
        >
          Connection lost — results may be incomplete.
        </div>
      )}

      {/* Masthead — restates the brief in the display face, banded like the report */}
      <header className="border-b" style={{ borderColor: 'var(--fg)' }}>
        <div className="mx-auto w-full max-w-[72rem] px-4 sm:px-7 lg:px-10 pt-8 sm:pt-11 pb-7 sm:pb-9">
          <div className="flex items-center gap-2.5 mb-4 sm:mb-5">
            <span className="micro" style={{ color: statusColor }}>
              {stageLine}
            </span>
            {completionMessage && (
              <span className="micro" style={{ color: 'var(--scout)' }} role="status">
                · {completionMessage}
              </span>
            )}
          </div>
          <h1
            className="serif m-0"
            style={{
              fontSize: 'clamp(1.75rem, 4.5vw, 3.25rem)',
              lineHeight: 1.05,
              fontWeight: 300,
              letterSpacing: '-0.03em',
              textWrap: 'balance',
              maxWidth: '52rem',
              color: topic ? 'var(--fg)' : 'var(--muted)',
            }}
            title={topic ?? undefined}
          >
            {topic ? `\u201c${topic}\u201d` : 'Loading…'}
          </h1>
        </div>
      </header>

      {/* Body — pipeline document + sticky telemetry margin */}
      <div className="flex-1">
        <div className="mx-auto w-full max-w-[72rem] px-4 sm:px-7 lg:px-10 py-8 sm:py-10 grid gap-8 lg:gap-12 lg:grid-cols-[1fr_17rem]">
          <main
            className="border border-line bg-bg"
            aria-label="pipeline progress"
            style={{ alignSelf: 'start' }}
          >
            <PipelineBlock agent="scout" status={status.scout}>
              <ScoutContent
                status={status.scout}
                subQuestions={subQuestions}
                sources={sources}
                sourceCount={sourceCount}
              />
            </PipelineBlock>

            <PipelineBlock agent="scribe" status={status.scribe}>
              <ScribeContent
                status={status.scribe}
                sections={sections}
                scribeComplete={scribeComplete}
                latestSection={latestSection}
                sources={sources}
              />
            </PipelineBlock>

            <PipelineBlock agent="critic" status={status.critic} last>
              <CriticContent status={status.critic} claimFlags={claimFlags} />
            </PipelineBlock>
          </main>

          {/* Telemetry rail — sticky on lg, stacks below the pipeline on mobile */}
          <aside className="lg:sticky lg:top-8 lg:self-start">
            <div className="micro mb-4">Run telemetry</div>
            <dl className="m-0">
              <Metric label="Sub‑questions" value={String(subQuestions.length)} />
              <Metric label="Sources read" value={String(sourceCount)} />
              <Metric
                label="Words drafted"
                value={wordCount > 0 ? wordCount.toLocaleString() : '—'}
              />
              <Metric label="Claims audited" value={String(claimCount)} />
              <Metric
                label="Elapsed"
                value={createdAt ? formatElapsed(elapsedSeconds) : '—'}
                last
              />
            </dl>

            <div className="mt-7 pt-6 border-t border-line">
              <ConfidenceReadout value={overallConfidence} />
            </div>

            <p
              className="serif text-[0.8125rem] leading-relaxed font-light italic mt-7"
              style={{ color: 'var(--fg-3)' }}
            >
              {isFailed
                ? 'The run stopped early — partial results are shown above.'
                : currentPhase === 'done'
                  ? 'Every claim has been checked against its source. Opening your report…'
                  : 'Agents hand off in sequence — Scout to Scribe to Critic — so nothing reaches you unchecked.'}
            </p>
          </aside>
        </div>
      </div>
    </div>
  )
}

// ——————————————————————————————————————————————————————————
// Chrome bits
// ——————————————————————————————————————————————————————————

function Crumb({
  children,
  active,
  className,
}: {
  children: ReactNode
  active?: boolean
  className?: string
}) {
  return (
    <span className={cn('micro', className)} style={active ? undefined : { color: 'var(--muted)' }}>
      {children}
    </span>
  )
}

function CrumbSep({ className }: { className?: string }) {
  return (
    <span
      className={cn('font-mono text-[0.625rem]', className)}
      style={{ color: 'var(--muted)' }}
      aria-hidden
    >
      ›
    </span>
  )
}

// ——————————————————————————————————————————————————————————
// Pipeline block — the live equivalent of the landing AgentPipelineHero block
// ——————————————————————————————————————————————————————————

function PipelineBlock({
  agent,
  status,
  last,
  children,
}: {
  agent: Agent
  status: BlockStatus
  last?: boolean
  children: ReactNode
}) {
  const meta = AGENTS[agent]
  const isActive = status === 'active'
  const isQueue = status === 'queue'

  return (
    <section
      className={cn('px-5 sm:px-7 py-5 sm:py-6', !last && 'border-b border-line')}
      style={{
        background: isActive ? `var(--${agent}-soft)` : 'transparent',
        transition: 'background 480ms ease-out',
      }}
      aria-label={`${agent} stage`}
    >
      <div className="flex items-center gap-3">
        <AgentDot agent={agent} size={30} halo={isActive} />
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2.5">
            <span
              className="serif text-lg font-medium leading-none"
              style={{ letterSpacing: '-0.015em' }}
            >
              {meta.name}
            </span>
            <span className="font-mono text-[0.625rem] uppercase tracking-[0.12em] text-muted">
              {AGENT_ROLE[agent]}
            </span>
          </div>
        </div>
        <BlockBadge agent={agent} status={status} />
      </div>

      <div className={cn('mt-4', isQueue && 'opacity-60')}>{children}</div>
    </section>
  )
}

function BlockBadge({ agent, status }: { agent: Agent; status: BlockStatus }) {
  if (status === 'active') {
    return (
      <span className="flex items-center gap-1.5 shrink-0" style={{ color: `var(--${agent})` }}>
        <span className="pulse-dot" aria-hidden />
        <span className="font-mono text-[0.625rem] uppercase tracking-[0.14em]">Working</span>
      </span>
    )
  }
  if (status === 'done') {
    return (
      <span className="flex items-center gap-1.5 shrink-0" style={{ color: `var(--${agent})` }}>
        <span aria-hidden>✓</span>
        <span className="font-mono text-[0.625rem] uppercase tracking-[0.14em]">Done</span>
      </span>
    )
  }
  return (
    <span
      className="font-mono text-[0.625rem] uppercase tracking-[0.14em] shrink-0"
      style={{ color: 'var(--muted)' }}
    >
      Queued
    </span>
  )
}

function MiniLabel({ children }: { children: ReactNode }) {
  return <div className="micro mb-2.5">{children}</div>
}

// ——————————————————————————————————————————————————————————
// Scout
// ——————————————————————————————————————————————————————————

function ScoutContent({
  status,
  subQuestions,
  sources,
  sourceCount,
}: {
  status: BlockStatus
  subQuestions: string[]
  sources: SourceEntry[]
  sourceCount: number
}) {
  if (subQuestions.length === 0) {
    return (
      <Placeholder>
        {status === 'queue' ? 'Waiting to start.' : 'Decomposing the topic into sub‑questions…'}
      </Placeholder>
    )
  }

  return (
    <div className="grid gap-6 sm:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] sm:gap-8">
      <div className="min-w-0">
        <MiniLabel>
          {subQuestions.length} sub‑question{subQuestions.length !== 1 ? 's' : ''} — one parallel
          sub‑agent each
        </MiniLabel>
        <ol className="list-none m-0 p-0 border-t border-line-soft">
          {subQuestions.map((q, i) => (
            <li key={i} className="flex items-baseline gap-2.5 py-2.5 border-b border-line-soft">
              <span
                className="font-mono text-[0.625rem] shrink-0"
                style={{ color: 'var(--scout)' }}
              >
                S.{String(i + 1).padStart(2, '0')}
              </span>
              <span className="serif text-[0.9375rem] leading-snug">{q}</span>
            </li>
          ))}
        </ol>
      </div>

      <div className="min-w-0 overflow-hidden">
        <MiniLabel>{sourceCount > 0 ? `${sourceCount} sources kept` : 'Evidence'}</MiniLabel>
        {sources.length > 0 ? (
          <ul className="list-none m-0 p-0 border-t border-line-soft">
            {sources.map((src) => (
              <SourceLine key={src.id} source={src} />
            ))}
          </ul>
        ) : (
          <Placeholder>Searching for sources…</Placeholder>
        )}
      </div>
    </div>
  )
}

function SourceLine({ source }: { source: SourceEntry }) {
  const color = source.credibility !== null ? credibilityColor(source.credibility) : 'var(--muted)'
  return (
    <li className="flex items-center gap-2.5 py-2 border-b border-line-soft min-w-0">
      <span className="size-1 rounded-full shrink-0" style={{ background: color }} aria-hidden />
      <span
        className="font-sans text-[0.8125rem] flex-1 min-w-0 truncate"
        style={{ color: 'var(--fg-2)' }}
        title={source.title}
      >
        {source.title}
      </span>
      {source.credibility !== null ? (
        <span className="font-mono text-[0.6875rem] shrink-0" style={{ color }}>
          .{Math.round(source.credibility * 100)}
        </span>
      ) : (
        <span
          className="pulse-dot shrink-0"
          style={{ color: 'var(--muted)' }}
          aria-label="loading credibility score"
        />
      )}
    </li>
  )
}

// ——————————————————————————————————————————————————————————
// Scribe
// ——————————————————————————————————————————————————————————

interface SectionLike {
  id: string
  heading: string
  body_md: string
}

function toReportSources(entries: SourceEntry[]): Source[] {
  return entries.map((entry) => ({
    id: entry.id,
    url: entry.url,
    title: entry.title,
    credibility: entry.credibility ?? 0,
    relevance: entry.relevance ?? 0,
    snippet: '',
  }))
}

function ScribeContent({
  status,
  sections,
  scribeComplete,
  latestSection,
  sources,
}: {
  status: BlockStatus
  sections: SectionLike[]
  scribeComplete: boolean
  latestSection: SectionLike | undefined
  sources: SourceEntry[]
}) {
  const [hoveredSectionId, setHoveredSectionId] = useState<string | null>(null)
  // Preview swaps change block height; at the document bottom Chrome's scroll
  // anchoring nudges the viewport and breaks hover. Pin scrollY across swaps.
  const scrollLockY = useRef<number | null>(null)
  const reportSources = useMemo(() => toReportSources(sources), [sources])

  const setPreviewSection = useCallback((id: string | null) => {
    scrollLockY.current = window.scrollY
    setHoveredSectionId(id)
  }, [])

  useLayoutEffect(() => {
    const y = scrollLockY.current
    if (y === null) return
    scrollLockY.current = null
    window.scrollTo({ top: y, left: 0, behavior: 'instant' })
  }, [hoveredSectionId])

  if (sections.length === 0) {
    return (
      <Placeholder>
        {status === 'queue'
          ? 'Waiting for Scout’s evidence.'
          : 'Reading sources — outlining the report…'}
      </Placeholder>
    )
  }

  const defaultSection = latestSection ?? sections[sections.length - 1]
  const displaySection = sections.find((sec) => sec.id === hoveredSectionId) ?? defaultSection
  const displayIndex = displaySection
    ? sections.findIndex((sec) => sec.id === displaySection.id) + 1
    : 0
  const isWritingLatest =
    !scribeComplete && displaySection?.id === sections[sections.length - 1]?.id
  const isBrowsing = hoveredSectionId !== null && hoveredSectionId !== defaultSection?.id

  const previewLabel = isBrowsing
    ? `Previewing §${displayIndex} — ${displaySection?.heading}`
    : isWritingLatest
      ? `Drafting §${displayIndex} — ${displaySection?.heading}`
      : `§${displayIndex} — ${displaySection?.heading}`

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1.4fr] lg:gap-8">
      <div>
        <MiniLabel>Outline · hover to preview</MiniLabel>
        <ol
          className="list-none m-0 p-0 border-t border-line-soft"
          onMouseLeave={() => setPreviewSection(null)}
        >
          {sections.map((sec, i) => {
            const isWriting = !scribeComplete && i === sections.length - 1
            const isSelected = displaySection?.id === sec.id
            return (
              <li key={sec.id}>
                <button
                  type="button"
                  className={cn(
                    'w-full flex items-center gap-2.5 py-2.5 px-1 -mx-1 border-b border-line-soft text-left',
                    'transition-colors cursor-pointer',
                    isSelected ? 'bg-bg-2' : 'hover:bg-bg-2/70',
                  )}
                  onMouseEnter={() => setPreviewSection(sec.id)}
                  onFocus={() => setPreviewSection(sec.id)}
                  onBlur={() => setPreviewSection(null)}
                  aria-current={isSelected ? 'true' : undefined}
                >
                  <span
                    className="font-mono text-[0.625rem] shrink-0 w-6"
                    style={{ color: isSelected ? 'var(--scribe)' : 'var(--muted)' }}
                  >
                    §{i + 1}
                  </span>
                  <span
                    className={cn(
                      'serif text-[0.875rem] flex-1',
                      !isWriting && scribeComplete && 'text-fg-2',
                      !isWriting && !scribeComplete && 'line-through',
                    )}
                    style={{ fontWeight: isWriting || isSelected ? 500 : 400 }}
                  >
                    {sec.heading}
                  </span>
                  <span
                    className="font-mono text-[0.5625rem] uppercase tracking-[0.1em] shrink-0"
                    style={{ color: isWriting ? 'var(--scribe)' : 'var(--muted)' }}
                  >
                    {isWriting ? 'Writing' : 'Drafted'}
                  </span>
                </button>
              </li>
            )
          })}
        </ol>
      </div>

      <div className="[overflow-anchor:none]">
        <MiniLabel>{previewLabel}</MiniLabel>
        {displaySection ? (
          <div
            className={cn(
              'px-5 py-4 border-l-2 [overflow-anchor:none]',
              'serif text-[0.875rem] leading-relaxed font-light text-fg',
              '[&_p]:m-0 [&_p+p]:mt-3.5 [&_sup]:align-baseline',
            )}
            style={{ borderColor: 'var(--scribe)', background: 'var(--bg-2)' }}
          >
            <TooltipProvider>
              <ReportRenderer
                section={{
                  id: displaySection.id,
                  heading: displaySection.heading,
                  body_md: displaySection.body_md,
                  cited_source_ids: [],
                }}
                claimFlags={[]}
                sources={reportSources}
              />
            </TooltipProvider>
          </div>
        ) : null}
      </div>
    </div>
  )
}

// ——————————————————————————————————————————————————————————
// Critic
// ——————————————————————————————————————————————————————————

interface ClaimFlagLike {
  claim_id: string
  verdict: Verdict
  rationale: string
}

function CriticContent({
  status,
  claimFlags,
}: {
  status: BlockStatus
  claimFlags: ClaimFlagLike[]
}) {
  if (status === 'queue') {
    return (
      <p
        className="serif text-[0.8125rem] leading-relaxed font-light italic m-0"
        style={{ color: 'var(--fg-2)' }}
      >
        Critic runs after Scribe — it needs the finished draft to audit. Expect a verdict on every
        claim, with confidence scored per section and any unsupported sentence flagged.
      </p>
    )
  }

  if (claimFlags.length === 0) {
    return <Placeholder>Verifying claims against their sources…</Placeholder>
  }

  return (
    <ul className="list-none m-0 p-0 border-t border-line-soft">
      {claimFlags.map((flag) => (
        <li
          key={flag.claim_id}
          className="flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-3.5 py-2.5 border-b border-line-soft"
        >
          <span
            className="font-mono text-[0.5625rem] uppercase tracking-[0.1em] shrink-0 sm:w-24"
            style={{ color: verdictColor(flag.verdict) }}
          >
            {verdictLabel(flag.verdict)}
          </span>
          <span
            className="serif text-[0.8125rem] leading-snug flex-1"
            style={{ color: 'var(--fg-2)' }}
          >
            {flag.rationale}
          </span>
        </li>
      ))}
    </ul>
  )
}

// ——————————————————————————————————————————————————————————
// Shared primitives
// ——————————————————————————————————————————————————————————

function Placeholder({ children }: { children: ReactNode }) {
  return (
    <div className="micro py-3 border-t border-line-soft" style={{ color: 'var(--muted)' }}>
      {children}
    </div>
  )
}

function Metric({ label, value, last }: { label: string; value: string; last?: boolean }) {
  return (
    <div
      className={cn(
        'flex items-baseline justify-between gap-3 py-2.5',
        !last && 'border-b border-line-soft',
      )}
    >
      <dt className="micro" style={{ fontSize: '0.5625rem' }}>
        {label}
      </dt>
      <dd className="font-mono text-[0.8125rem] m-0">{value}</dd>
    </div>
  )
}

function ConfidenceReadout({ value }: { value: number | null }) {
  const pct = value !== null ? Math.round(value * 100) : null
  return (
    <div>
      <div className="flex items-baseline justify-between mb-2">
        <span className="micro">Overall confidence</span>
        <span
          className="font-mono text-[0.8125rem]"
          style={{ color: pct !== null ? 'var(--fg)' : 'var(--muted)' }}
        >
          {pct !== null ? `${pct}%` : '—'}
        </span>
      </div>
      <div
        className="relative h-[3px] w-full"
        style={{ background: 'var(--line-soft)' }}
        aria-hidden
      >
        <div
          className="absolute inset-y-0 left-0"
          style={{
            width: `${pct ?? 0}%`,
            background: 'var(--critic)',
            transition: 'width 520ms cubic-bezier(0.2, 0.9, 0.3, 1)',
          }}
        />
      </div>
    </div>
  )
}
