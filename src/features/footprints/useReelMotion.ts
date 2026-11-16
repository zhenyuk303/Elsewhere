import { useCallback, useEffect, useRef, useState } from 'react'
import { mobileBreakpoint } from './reelGeometry'

const frameLength = 1000 / 60

export function useReelMotion() {
  const [width, setWidth] = useState(() => window.innerWidth)
  const [position, setPosition] = useState(0)
  const [moving, setMoving] = useState(false)
  const [openingProgress, setOpeningProgress] = useState(1)
  const motion = useRef({ current: 0, target: 0, frame: 0, previousTime: 0, damping: .06, opening: false })

  const reset = useCallback((position = 0) => {
    const state = motion.current
    cancelAnimationFrame(state.frame)
    state.frame = state.previousTime = 0
    state.current = state.target = position
    state.opening = false
    setPosition(position)
    setMoving(false)
    setOpeningProgress(1)
  }, [])

  useEffect(() => {
    const resize = () => setWidth(window.innerWidth)
    window.addEventListener('resize', resize)
    return () => {
      window.removeEventListener('resize', resize)
      cancelAnimationFrame(motion.current.frame)
    }
  }, [])

  const open = useCallback(() => {
    const mobile = window.innerWidth <= mobileBreakpoint
    const startPosition = mobile ? 0 : 600
    const duration = mobile ? 1000 : 1500
    reset(startPosition)
    const state = motion.current
    state.opening = true
    setOpeningProgress(0)
    setMoving(true)
    let startTime: number | undefined
    function draw(time: number) {
      startTime ??= time
      const fraction = Math.min(1, (time - startTime) / duration)
      const progress = mobile
        ? (fraction < .5 ? 8 * fraction ** 4 : 1 - 8 * (1 - fraction) ** 4)
        : 1 - (1 - fraction) ** 3
      state.current = state.target = startPosition * (1 - progress)
      setPosition(state.current)
      setOpeningProgress(progress)
      if (fraction === 1) {
        state.frame = 0
        state.opening = false
        setMoving(false)
      } else state.frame = requestAnimationFrame(draw)
    }
    state.frame = requestAnimationFrame(draw)
  }, [reset])

  const scrollTo = useCallback((target: number, dragging = false) => {
    const state = motion.current
    if (state.opening) reset(state.current)
    state.target = target
    state.damping = dragging ? .10 : .06
    if (state.target === state.current || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      reset(target)
      return
    }
    if (state.frame) return
    setMoving(true)
    function draw(time: number) {
      const elapsed = state.previousTime ? time - state.previousTime : frameLength
      state.previousTime = time
      const decay = -Math.log1p(-state.damping) * Math.min(elapsed, 64) / frameLength
      const distance = state.target - state.current
      const remaining = Math.abs(distance)
      // Ease the final pixel to zero speed instead of snapping the remainder on the last frame.
      const nextDistance = remaining > 1
        ? remaining * Math.exp(-decay)
        : Math.max(0, Math.sqrt(remaining) - decay / 2) ** 2
      state.current = state.target - Math.sign(distance) * nextDistance
      if (nextDistance === 0) {
        state.frame = state.previousTime = 0
        setMoving(false)
      } else state.frame = requestAnimationFrame(draw)
      setPosition(state.current)
    }
    state.frame = requestAnimationFrame(draw)
  }, [reset])

  const move = useCallback((distance: number, dragging = false) => {
    scrollTo(motion.current.target + distance, dragging)
  }, [scrollTo])

  return { width, position, moving, move, reset, scrollTo, open, openingProgress }
}
