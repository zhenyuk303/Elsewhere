import { useLayoutEffect, useRef, useState, type RefObject } from 'react'

const expandDuration = 220
const retractDuration = 170

function paperKeyframes(popup: HTMLElement): Keyframe[] {
  const width = popup.offsetWidth
  const height = popup.offsetHeight
  const above = popup.dataset.placement === 'above'
  const direction = above ? -1 : 1
  const anchor = above ? height : 0
  const shadowMargin = 48
  const nearEdge = anchor - shadowMargin * direction
  const farEdge = width + shadowMargin

  function clip(depth: number, bow: number) {
    const edge = anchor + depth * direction
    const control = edge + bow * direction
    return `path("M ${-shadowMargin} ${nearEdge} H ${farEdge} V ${edge} C ${width * .84} ${control} ${width * .16} ${control} ${-shadowMargin} ${edge} Z")`
  }

  return [
    { clipPath: clip(0, 0), transform: `translateY(${-8 * direction}px)`, opacity: 0 },
    { offset: .48, clipPath: clip(height * .34, height * .37), transform: `translateY(${-2 * direction}px)`, opacity: 1 },
    { clipPath: clip(height + shadowMargin, 0), transform: 'translateY(0)', opacity: 1 },
  ]
}

export function usePopupPullout(open: boolean, popup: RefObject<HTMLElement | null>) {
  const [retained, setRetained] = useState(false)
  const active = useRef<Animation | null>(null)
  const present = open || retained

  useLayoutEffect(() => {
    if (!present) return
    return () => {
      active.current?.cancel()
      active.current = null
    }
  }, [present])

  useLayoutEffect(() => {
    const element = popup.current
    if (!element) return
    const preference = window.matchMedia?.('(prefers-reduced-motion: reduce)')
    if (typeof element.animate !== 'function' || preference?.matches ||
      window.CSS?.supports('clip-path', 'path("M 0 0 L 0 1 Z")') === false) {
      active.current?.cancel()
      active.current = null
      setRetained(false)
      return
    }

    if (open) setRetained(true)
    let animation = active.current
    if (!open && animation && (animation.currentTime === null || animation.currentTime === 0)) {
      animation.cancel()
      active.current = null
      setRetained(false)
      return
    }
    if (!animation) {
      animation = element.animate(paperKeyframes(element), {
        duration: expandDuration,
        easing: 'cubic-bezier(.23,.48,.28,1)',
        fill: 'both',
      })
      if (!open) animation.currentTime = expandDuration
      active.current = animation
    }

    animation.updatePlaybackRate(open ? 1 : -expandDuration / retractDuration)
    animation.play()
    animation.onfinish = () => {
      if (active.current !== animation || animation.playState !== 'finished') return
      if (open) {
        animation.cancel()
        active.current = null
      } else setRetained(false)
    }

    function honorPreference(event: MediaQueryListEvent) {
      if (!event.matches) return
      active.current?.cancel()
      active.current = null
      setRetained(false)
    }
    preference?.addEventListener?.('change', honorPreference)
    return () => preference?.removeEventListener?.('change', honorPreference)
  }, [open, popup])

  return present
}
