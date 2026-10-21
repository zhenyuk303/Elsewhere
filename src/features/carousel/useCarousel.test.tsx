import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  HOLD_MS,
  REVEAL_MS,
  SLIDE_MS,
  useCarousel,
} from './useCarousel'

describe('useCarousel', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('advances through reveal, hold, and horizontal slide at the agreed timings', () => {
    const { result } = renderHook(() => useCarousel(3, false))

    expect(result.current).toEqual({
      currentIndex: 0,
      nextIndex: 1,
      phase: 'reveal',
    })

    act(() => vi.advanceTimersByTime(REVEAL_MS))
    expect(result.current.phase).toBe('hold')

    act(() => vi.advanceTimersByTime(HOLD_MS))
    expect(result.current.phase).toBe('slide')

    act(() => vi.advanceTimersByTime(SLIDE_MS))
    expect(result.current).toEqual({
      currentIndex: 1,
      nextIndex: 2,
      phase: 'reveal',
    })
  })

  it('cancels the active phase timer while paused and resumes one clean timer', () => {
    const { result, rerender } = renderHook(
      ({ paused }) => useCarousel(3, paused),
      { initialProps: { paused: false } },
    )

    act(() => vi.advanceTimersByTime(1000))
    rerender({ paused: true })
    act(() => vi.advanceTimersByTime(10000))
    expect(result.current.phase).toBe('reveal')
    expect(result.current.currentIndex).toBe(0)

    rerender({ paused: false })
    act(() => vi.advanceTimersByTime(REVEAL_MS - 1))
    expect(result.current.phase).toBe('reveal')
    act(() => vi.advanceTimersByTime(1))
    expect(result.current.phase).toBe('hold')
  })
})
