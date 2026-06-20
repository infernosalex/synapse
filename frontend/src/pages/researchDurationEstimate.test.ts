import { describe, expect, it } from 'vitest'

import { estimateResearchDuration, estimateSourcesReviewed } from './researchDurationEstimate'

describe('estimateResearchDuration', () => {
  it('scales with kept sub-question count', () => {
    expect(estimateResearchDuration('standard', 4)).toBe('~ 4 min')
    expect(estimateResearchDuration('standard', 2)).toBe('~ 3 min')
    expect(estimateResearchDuration('deep', 8)).toBe('~ 8 min')
    expect(estimateResearchDuration('deep', 2)).toBe('~ 4 min')
    expect(estimateResearchDuration('shallow', 2)).toBe('~ 2 min')
  })

  it('never goes below one minute', () => {
    expect(estimateResearchDuration('shallow', 0)).toBe('~ 1 min')
  })
})

describe('estimateSourcesReviewed', () => {
  it('multiplies results-per-question by kept count', () => {
    expect(estimateSourcesReviewed('shallow', 2)).toBe('~6 sources reviewed')
    expect(estimateSourcesReviewed('standard', 4)).toBe('~20 sources reviewed')
    expect(estimateSourcesReviewed('deep', 8)).toBe('~64 sources reviewed')
  })

  it('shows zero when nothing is kept', () => {
    expect(estimateSourcesReviewed('deep', 0)).toBe('0 sources reviewed')
  })
})
