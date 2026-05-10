import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { Pill } from './Pill'

describe('Pill', () => {
  it('renders label and value', () => {
    render(<Pill label="Depth" value="Standard" />)
    expect(screen.getByText('Depth')).toBeInTheDocument()
    expect(screen.getByText('Standard')).toBeInTheDocument()
  })

  it('applies disabled styling', () => {
    render(<Pill label="Length" value="2,500 words" disabled />)
    const inner = screen.getByText('Length').closest('div')
    const pill = inner?.parentElement
    expect(pill).toHaveClass('opacity-50')
    expect(pill).toHaveClass('cursor-not-allowed')
  })

  it('fires onClick when interactive', async () => {
    const onClick = vi.fn()
    render(<Pill label="Depth" value="Standard" interactive onClick={onClick} />)
    const button = screen.getByRole('button')
    await userEvent.click(button)
    expect(onClick).toHaveBeenCalledTimes(1)
  })
})
