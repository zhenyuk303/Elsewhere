import { useEffect, useState } from 'react'

export type CarouselPhase = 'reveal' | 'hold' | 'slide'

export const REVEAL_MS = 2500
export const HOLD_MS = 3000
export const SLIDE_MS = 1200

const phaseDuration: Record<CarouselPhase, number> = {
  reveal: REVEAL_MS,
  hold: HOLD_MS,
  slide: SLIDE_MS,
}

export function useCarousel(itemCount: number, paused: boolean) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [phase, setPhase] = useState<CarouselPhase>('reveal')

  useEffect(() => {
    if (paused || itemCount < 2) return

    const timer = window.setTimeout(() => {
      if (phase === 'reveal') {
        setPhase('hold')
        return
      }

      if (phase === 'hold') {
        setPhase('slide')
        return
      }

      setCurrentIndex((index) => (index + 1) % itemCount)
      setPhase('reveal')
    }, phaseDuration[phase])

    return () => window.clearTimeout(timer)
  }, [itemCount, paused, phase])

  const nextIndex = itemCount > 0 ? (currentIndex + 1) % itemCount : 0

  return { currentIndex, nextIndex, phase }
}
