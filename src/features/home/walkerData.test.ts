import { describe, expect, it } from 'vitest'
import { walkerCycles } from './walkerData'

describe('walkerCycles', () => {
  it('uses only the seven requested recording segments in order', () => {
    expect(walkerCycles.map(({ sourceRange }) => sourceRange)).toEqual([
      [0, 2],
      [2, 6],
      [6, 10],
      [10, 14],
      [14, 19],
      [19, 25],
      [34, 42],
    ])
    expect(walkerCycles.map(({ id }) => id)).toEqual([
      'walk-01', 'walk-02', 'walk-03', 'walk-04',
      'walk-05', 'walk-06', 'walk-07',
    ])
  })

  it('ships a sprite strip and timing for each loop', () => {
    const availableSprites = Object.keys(
      import.meta.glob('../../../public/images/walkers/*.webp'),
    )
    for (const cycle of walkerCycles) {
      expect(cycle.frameCount).toBeGreaterThan(1)
      expect(cycle.cycleMs).toBeGreaterThan(500)
      expect(cycle.src).toBe(`/images/walkers/${cycle.id}.webp`)
      expect(availableSprites.some((path) => path.endsWith(`${cycle.id}.webp`))).toBe(true)
    }
  })
})
