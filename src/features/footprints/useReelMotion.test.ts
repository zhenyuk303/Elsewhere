import { act, renderHook } from '@testing-library/react'
import { useReelMotion } from './useReelMotion'

it('reaches the exact scroll target without speeding up in the last frame', () => {
  vi.useFakeTimers()
  try {
    const { result } = renderHook(useReelMotion)
    act(() => result.current.move(80))
    const positions = [result.current.position]
    for (let frame = 0; frame < 180 && result.current.moving; frame++) {
      act(() => vi.advanceTimersToNextFrame())
      positions.push(result.current.position)
    }

    const [previous, penultimate, final] = positions.slice(-3)
    expect(result.current.moving).toBe(false)
    expect(final).toBe(80)
    expect(final - penultimate).toBeLessThanOrEqual(penultimate - previous)
  } finally {
    vi.useRealTimers()
  }
})
