import ReactMarkdown from 'react-markdown'
import rehypeRaw from 'rehype-raw'
import remarkGfm from 'remark-gfm'

import type { ClaimFlag, ReportSection } from '../types/api'
import { Tooltip } from './ui/Tooltip'
import { cn } from './ui/cn'

interface ClaimHighlightProps {
  id: string
  flag: ClaimFlag | undefined
  children?: React.ReactNode
}

function ClaimHighlight({ id, flag, children }: ClaimHighlightProps) {
  if (!flag) {
    return <span data-claim={id}>{children}</span>
  }

  const bgClass =
    flag.verdict === 'supported'
      ? 'bg-scout-soft'
      : flag.verdict === 'partially_supported'
        ? 'bg-scribe-soft'
        : 'bg-critic-soft'

  const isContradicted = flag.verdict === 'contradicted'

  const tooltipContent = (
    <span>
      <span
        className="uppercase tracking-widest"
        style={{ color: isContradicted ? 'var(--critic)' : undefined }}
      >
        {flag.verdict.replace(/_/g, ' ')}
      </span>
      {' — '}
      {flag.rationale}
    </span>
  )

  return (
    <Tooltip content={tooltipContent}>
      <span
        data-claim={id}
        className={cn('px-0.5', bgClass, isContradicted && 'line-through')}
        style={isContradicted ? { color: 'var(--critic)' } : undefined}
      >
        {children}
      </span>
    </Tooltip>
  )
}

interface ReportRendererProps {
  section: ReportSection
  claimFlags: ClaimFlag[]
}

export function ReportRenderer({ section, claimFlags }: ReportRendererProps) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      rehypePlugins={[rehypeRaw]}
      components={{
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        span: ({ node, ...props }: any) => {
          const claimId = node?.properties?.dataClaim as string | undefined
          if (claimId) {
            const flag = claimFlags.find((f) => f.claim_id === claimId)
            return <ClaimHighlight id={claimId} flag={flag} {...props} />
          }
          return <span {...props} />
        },
      }}
    >
      {section.body_md}
    </ReactMarkdown>
  )
}
