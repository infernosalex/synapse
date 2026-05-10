import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'

import { ConfidenceBar } from './ConfidenceBar'

describe('ConfidenceBar', () => {
  it('renders correct percentage', () => {
    render(<ConfidenceBar value={0.91} />)
    expect(screen.getByText('.91')).toBeInTheDocument()
  })

  it('uses scout colour for high confidence', () => {
    const { container } = render(<ConfidenceBar value={0.91} />)
    const bar = container.querySelector('[style*="width: 91%"]')
    expect(bar).toHaveClass('bg-scout')
  })

  it('uses scribe colour for medium confidence', () => {
    const { container } = render(<ConfidenceBar value={0.8} />)
    const bar = container.querySelector('[style*="width: 80%"]')
    expect(bar).toHaveClass('bg-scribe')
  })

  it('uses critic colour for low confidence', () => {
    const { container } = render(<ConfidenceBar value={0.5} />)
    const bar = container.querySelector('[style*="width: 50%"]')
    expect(bar).toHaveClass('bg-critic')
  })
})
