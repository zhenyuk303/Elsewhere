import { act, fireEvent, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { WalkerParade } from './WalkerParade'

function finishCrossing(container: HTMLElement) {
  const walker = container.querySelector<HTMLElement>('.walker-crossing')
  expect(walker).not.toBeNull()
  emitAnimationEnd(walker!, 'walker-cross')
}

function emitAnimationEnd(element: HTMLElement, animationName: string) {
  // jsdom lacks AnimationEvent; React may register a prefixed event there.
  for (const type of ['animationend', 'webkitAnimationEnd', 'mozAnimationEnd']) {
    const event = new Event(type, { bubbles: true })
    Object.defineProperty(event, 'animationName', { value: animationName })
    fireEvent(element, event)
  }
}

describe('WalkerParade', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('shows one decorative walker, then waits five empty seconds after exit', () => {
    const { container } = render(<WalkerParade />)
    const lane = container.querySelector('.walker-lane')
    expect(lane).toHaveAttribute('aria-hidden', 'true')
    expect(lane?.querySelectorAll('.walker-crossing')).toHaveLength(1)
    expect(lane?.querySelector('img')).toHaveAttribute('src', '/images/walkers/walk-01.webp')
    expect(vi.getTimerCount()).toBe(0)

    finishCrossing(container)
    expect(lane?.querySelector('.walker-crossing')).toBeNull()
    act(() => vi.advanceTimersByTime(4999))
    expect(lane?.querySelector('.walker-crossing')).toBeNull()
    act(() => vi.advanceTimersByTime(1))
    expect(lane?.querySelector('img')).toHaveAttribute('src', '/images/walkers/walk-02.webp')
  })

  it('plays all seven source intervals in order and wraps to the first', () => {
    const { container } = render(<WalkerParade />)
    for (let index = 1; index <= 7; index += 1) {
      expect(container.querySelectorAll('.walker-crossing')).toHaveLength(1)
      expect(container.querySelector('img')).toHaveAttribute(
        'src', `/images/walkers/walk-0${index}.webp`,
      )
      finishCrossing(container)
      act(() => vi.advanceTimersByTime(5000))
    }
    expect(container.querySelector('img')).toHaveAttribute('src', '/images/walkers/walk-01.webp')
  })

  it('ignores duplicate crossing events and clears the wait on unmount', () => {
    const { container, unmount } = render(<WalkerParade />)
    const walker = container.querySelector<HTMLElement>('.walker-crossing')!
    emitAnimationEnd(walker, 'walker-cycle')
    expect(container.querySelector('.walker-crossing')).toBe(walker)
    emitAnimationEnd(walker, 'walker-cross')
    emitAnimationEnd(walker, 'walker-cross')
    expect(vi.getTimerCount()).toBe(1)
    unmount()
    expect(vi.getTimerCount()).toBe(0)
  })

  it('skips a failed sprite without holding the page', () => {
    const { container } = render(<WalkerParade />)
    fireEvent.error(container.querySelector('img')!)
    expect(container.querySelector('img')).toHaveAttribute('src', '/images/walkers/walk-02.webp')
  })

  it('omits continuous walking for reduced motion and removes its listener', () => {
    const removeEventListener = vi.fn()
    vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({
      matches: true,
      addEventListener: vi.fn(),
      removeEventListener,
    }))
    const { container, unmount } = render(<WalkerParade />)
    expect(container.querySelector('.walker-lane')).toBeNull()
    expect(vi.getTimerCount()).toBe(0)
    unmount()
    expect(removeEventListener).toHaveBeenCalledWith('change', expect.any(Function))
  })
})
