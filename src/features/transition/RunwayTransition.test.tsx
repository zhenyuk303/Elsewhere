import { act, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  REDUCED_TRANSITION_MS,
  RunwayTransition,
  TRANSITION_MS,
} from './RunwayTransition'

const origin = {
  left: 96,
  top: 520,
  width: 340,
  height: 56,
  dividerX: 640,
  cardTop: 48,
  cardHeight: 760,
}

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

  it('runs the five transition stages at their exact boundaries', () => {
    const onComplete = vi.fn()
    render(<RunwayTransition origin={origin} onComplete={onComplete} />)

    const overlay = screen.getByTestId('runway-transition')
    expect(overlay).toHaveAttribute('data-stage', 'collapse')

    act(() => vi.advanceTimersByTime(449))
    expect(overlay).toHaveAttribute('data-stage', 'collapse')
    act(() => vi.advanceTimersByTime(1))
    expect(overlay).toHaveAttribute('data-stage', 'dock')

    act(() => vi.advanceTimersByTime(550))
    expect(overlay).toHaveAttribute('data-stage', 'stretch')
    act(() => vi.advanceTimersByTime(700))
    expect(overlay).toHaveAttribute('data-stage', 'morph')
    act(() => vi.advanceTimersByTime(200))
    expect(overlay).toHaveAttribute('data-stage', 'flight')

    act(() => vi.advanceTimersByTime(TRANSITION_MS - 1900))
    expect(onComplete).toHaveBeenCalledOnce()

    act(() => vi.advanceTimersByTime(TRANSITION_MS))
    expect(onComplete).toHaveBeenCalledOnce()
  })

  it('exposes the geometry and semantic animation layers', () => {
    render(<RunwayTransition origin={origin} onComplete={vi.fn()} />)

    expect(screen.getByTestId('runway-transition')).toHaveStyle({
      '--origin-left': '96px',
      '--origin-top': '520px',
      '--origin-width': '340px',
      '--origin-height': '56px',
      '--divider-x': '640px',
      '--card-top': '48px',
      '--card-height': '760px',
    })
    expect(screen.getByTestId('transition-shape')).toBeInTheDocument()
    expect(screen.getByTestId('transition-dot')).toBeInTheDocument()
    expect(screen.getByTestId('transition-airplane')).toHaveAttribute(
      'aria-hidden',
      'true',
    )
    expect(screen.getByTestId('page-wipe')).toBeInTheDocument()
    expect(screen.getByTestId('wing-guide-left')).toBeInTheDocument()
    expect(screen.getByTestId('wing-guide-right')).toBeInTheDocument()
    expect(document.querySelector('#gooey-runway-filter')).not.toBeInTheDocument()
    expect(document.querySelector('.liquid-drop')).not.toBeInTheDocument()
  })

  it('cleans up timers when the transition unmounts', () => {
    const onComplete = vi.fn()
    const { unmount } = render(
      <RunwayTransition origin={origin} onComplete={onComplete} />,
    )

    act(() => vi.advanceTimersByTime(1000))
    unmount()
    act(() => vi.advanceTimersByTime(TRANSITION_MS))

    expect(onComplete).not.toHaveBeenCalled()
  })

  it('preserves the stage order on the short reduced-motion path', () => {
    setReducedMotion(true)
    const onComplete = vi.fn()
    render(<RunwayTransition origin={origin} onComplete={onComplete} />)
    const overlay = screen.getByTestId('runway-transition')

    expect(overlay).toHaveAttribute('data-stage', 'collapse')
    act(() => vi.advanceTimersByTime(30))
    expect(overlay).toHaveAttribute('data-stage', 'dock')
    act(() => vi.advanceTimersByTime(35))
    expect(overlay).toHaveAttribute('data-stage', 'stretch')
    act(() => vi.advanceTimersByTime(35))
    expect(overlay).toHaveAttribute('data-stage', 'morph')
    act(() => vi.advanceTimersByTime(20))
    expect(overlay).toHaveAttribute('data-stage', 'flight')
    act(() => vi.advanceTimersByTime(REDUCED_TRANSITION_MS - 121))
    expect(onComplete).not.toHaveBeenCalled()
    act(() => vi.advanceTimersByTime(1))
    expect(onComplete).toHaveBeenCalledOnce()
  })
})
