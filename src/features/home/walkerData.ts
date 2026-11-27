export type WalkerCycle = {
  id: string
  sourceRange: readonly [number, number]
  src: string
  frameCount: number
  cycleMs: number
}

export const walkerCycles: readonly WalkerCycle[] = [
  { id: 'walk-01', sourceRange: [0, 2], src: '/images/walkers/walk-01.webp', frameCount: 20, cycleMs: 1333 },
  { id: 'walk-02', sourceRange: [2, 6], src: '/images/walkers/walk-02.webp', frameCount: 20, cycleMs: 1333 },
  { id: 'walk-03', sourceRange: [6, 10], src: '/images/walkers/walk-03.webp', frameCount: 20, cycleMs: 1333 },
  { id: 'walk-04', sourceRange: [10, 14], src: '/images/walkers/walk-04.webp', frameCount: 20, cycleMs: 1333 },
  { id: 'walk-05', sourceRange: [14, 19], src: '/images/walkers/walk-05.webp', frameCount: 20, cycleMs: 1333 },
  { id: 'walk-06', sourceRange: [19, 25], src: '/images/walkers/walk-06.webp', frameCount: 17, cycleMs: 1133 },
  { id: 'walk-07', sourceRange: [34, 42], src: '/images/walkers/walk-07.webp', frameCount: 27, cycleMs: 1800 },
]
