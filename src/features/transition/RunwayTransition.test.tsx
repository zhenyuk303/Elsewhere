import { act, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { REDUCED_TRANSITION_MS, RunwayTransition, TRANSITION_MS } from './RunwayTransition'

const origin = { left: 96, top: 520, width: 340, height: 56 }

function setReducedMotion(matches: boolean) {
  vi.stubGlobal(
    'matchMedia',
    vi.fn().mockReturnValue({
      matches,
      media: '(prefers-reduced-motion: reduce)',
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }),
  )
}

describe('RunwayTransition', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    setReducedMotion(false)
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('moves from the button origin through liquid, runway, and flight stages', () => {
    const onComplete = vi.fn()
    render(<RunwayTransition origin={origin} onComplete={onComplete} />)

    const overlay = screen.getByTestId('runway-transition')
    expect(overlay).toHaveAttribute('data-stage', 'liquid')
    expect(overlay).toHaveStyle({
      '--origin-left': '96px',
      '--origin-top': '520px',
      '--origin-width': '340px',
      '--origin-height': '56px',
    })
    expect(document.querySelector('#gooey-runway-filter')).toBeInTheDocument()
    expect(screen.getByTestId('airplane')).toHaveAttribute('aria-hidden', 'true')

    act(() => vi.advanceTimersByTime(900))
    expect(overlay).toHaveAttribute('data-stage', 'runway')

    act(() => vi.advanceTimersByTime(800))
    expect(overlay).toHaveAttribute('data-stage', 'flight')

    act(() => vi.advanceTimersByTime(TRANSITION_MS - 1700))
    expect(onComplete).toHaveBeenCalledOnce()

    act(() => vi.advanceTimersByTime(TRANSITION_MS))
    expect(onComplete).toHaveBeenCalledOnce()
  })

  it('uses the short completion path when reduced motion is requested', () => {
    setReducedMotion(true)
    const onComplete = vi.fn()
    render(<RunwayTransition origin={origin} onComplete={onComplete} />)

    act(() => vi.advanceTimersByTime(REDUCED_TRANSITION_MS - 1))
    expect(onComplete).not.toHaveBeenCalled()
    act(() => vi.advanceTimersByTime(1))
    expect(onComplete).toHaveBeenCalledOnce()
  })
})
