import { useEffect, type RefObject } from 'react'

export function useHomeMarquee(trackRef: RefObject<HTMLSpanElement | null>, active: boolean) {
  useEffect(() => {
    const track = trackRef.current
    const phrase = track?.firstElementChild
    if (!active || !track || !phrase || typeof track.animate !== 'function') return

    const motion = window.matchMedia?.('(prefers-reduced-motion: reduce)')
    let animation: Animation | undefined
    let loopWidth = 0
    let loopDuration = 0

    const update = () => {
      if (motion?.matches) {
        animation?.cancel()
        animation = undefined
        return
      }

      const width = phrase.getBoundingClientRect().width
      const viewport = window.innerWidth
      if (!width || !viewport) return

      // Measure one complete phrase so repeating it never causes a visible seam.
      const speedFactor = viewport < 479 ? 0.25 : viewport < 991 ? 0.5 : 1
      const duration = (width / viewport) * 15_000 * speedFactor
      if (animation && width === loopWidth && duration === loopDuration) return

      const time = animation?.currentTime
      const progress = typeof time === 'number' ? (time % loopDuration) / loopDuration : 0
      animation?.cancel()
      animation = track.animate(
        [{ transform: 'translate3d(0, 0, 0)' }, { transform: `translate3d(${-width}px, 0, 0)` }],
        { duration, easing: 'linear', iterations: Infinity },
      )
      animation.currentTime = progress * duration
      loopWidth = width
      loopDuration = duration
    }

    const resize = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(update)
    resize?.observe(phrase)
    window.addEventListener('resize', update)
    motion?.addEventListener?.('change', update)
    update()

    return () => {
      resize?.disconnect()
      window.removeEventListener('resize', update)
      motion?.removeEventListener?.('change', update)
      animation?.cancel()
    }
  }, [active, trackRef])
}
