import { useLayoutEffect, useRef, type MouseEvent, type PointerEvent } from 'react'
import './anchored-dialog.css'

type AnchoredDialogOptions = {
  anchor: HTMLElement | null
  onClose: () => void
  initialFocus?: string
  onBackdropClick?: () => void
  motion?: 'paper' | 'card'
}

const motionQuery = '(prefers-reduced-motion: reduce)'
const paperTiming = { easing: 'cubic-bezier(.25, .62, .26, 1)' }

function prefersReducedMotion() {
  return window.matchMedia?.(motionQuery).matches ?? false
}

function pixels(values: number[]) {
  return values.map(value => `${Number(value.toFixed(2))}px`).join(' ')
}

function dialogFrames(panel: HTMLDialogElement, anchor: HTMLElement | null, motion: 'paper' | 'card'): Keyframe[] | undefined {
  if (!anchor?.isConnected || typeof panel.animate !== 'function' || prefersReducedMotion()) return

  const target = panel.getBoundingClientRect()
  const source = anchor.getBoundingClientRect()
  if (!source.width || !source.height || target.width < 40 || target.height < 40) return

  const { width, height } = target
  if (motion === 'card') {
    return [
      { transformOrigin: 'top left', opacity: .72,
        transform: `translate(${pixels([source.left - target.left])}, ${pixels([source.top - target.top])}) scale(${source.width / width}, ${source.height / height})` },
      { transformOrigin: 'top left', opacity: 1, transform: 'translate(0px, 0px) scale(1, 1)' },
    ]
  }

  if (window.CSS?.supports('clip-path', 'inset(0 round 8px)') === false) return
  const pullsLeft = source.left + source.width / 2 >= target.left + width / 2
  const pullsUp = source.top + source.height / 2 >= target.top + height / 2
  const seam = Math.min(26, source.height / 2)
  const seamX = pullsLeft ? source.left : source.right
  const seamY = source.top + (source.height + (pullsUp ? seam : -seam)) / 2
  const startX = seamX - (pullsLeft ? target.right : target.left)
  const startY = seamY - (pullsUp ? target.bottom : target.top)
  const reachX = Math.max(4, Math.min(width * .36, 260,
    (pullsLeft ? seamX : window.innerWidth - seamX) - 10))
  const reachY = Math.max(seam, Math.min(height * .29, 210,
    (pullsUp ? seamY : window.innerHeight - seamY) - 10))

  const leadingCorner = pullsUp ? (pullsLeft ? 0 : 1) : (pullsLeft ? 3 : 2)

  function clip(reach: number, length: number, round: number, padding = 0) {
    const horizontalCut = width - reach
    const verticalCut = height - length
    const insets = [
      pullsUp ? verticalCut : -padding,
      pullsLeft ? -padding : horizontalCut,
      pullsUp ? -padding : verticalCut,
      pullsLeft ? horizontalCut : -padding,
    ]
    const corners = [round * .55, round * .55, round * .55, round * .55]
    corners[leadingCorner] = round
    corners[(leadingCorner + 2) % 4] = 0
    return `inset(${pixels(insets)} round ${pixels(corners)})`
  }

  function offset(x: number, y: number) {
    return `translate(${pixels([x])}, ${pixels([y])})`
  }

  const shadowPadding = 48
  return [
    { clipPath: clip(0, seam, 0), transform: offset(startX, startY) },
    { offset: .36, clipPath: clip(reachX, reachY, Math.min(56, reachX * .42, reachY * .48)),
      transform: offset(startX * .72, startY * .79) },
    { clipPath: clip(width + shadowPadding, height + shadowPadding, 0, shadowPadding),
      transform: offset(0, 0) },
  ]
}

function hideDialog(panel: HTMLDialogElement) {
  if (typeof panel.close === 'function') panel.close()
  else panel.removeAttribute('open')
}

function hitsBackdrop(event: MouseEvent<HTMLDialogElement>) {
  if (event.target !== event.currentTarget) return false
  const { left, top, right, bottom } = event.currentTarget.getBoundingClientRect()
  return event.clientX < left || event.clientX >= right || event.clientY < top || event.clientY >= bottom
}

export function useAnchoredDialog({ anchor, onClose, initialFocus, onBackdropClick, motion = 'paper' }: AnchoredDialogOptions) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const animation = useRef<Animation | null>(null)
  const isClosing = useRef(false)
  const startedOnBackdrop = useRef(false)

  useLayoutEffect(() => {
    const panel = dialogRef.current
    if (!panel) return
    if (anchor?.isConnected && typeof panel.animate === 'function' && !prefersReducedMotion()) {
      panel.dataset.anchoredDialog = 'open'
    }
    if (typeof panel.showModal === 'function') panel.showModal()
    else panel.setAttribute('open', '')
    if (initialFocus) panel.querySelector<HTMLElement>(initialFocus)?.focus({ preventScroll: true })

    const frames = dialogFrames(panel, anchor, motion)
    if (frames) {
      const opening = panel.animate(frames, { ...paperTiming, duration: motion === 'card' ? 310 : 255, fill: 'backwards' })
      animation.current = opening
      opening.onfinish = () => { animation.current = null }
    } else {
      delete panel.dataset.anchoredDialog
    }

    return () => {
      animation.current?.cancel()
      animation.current = null
      isClosing.current = false
      startedOnBackdrop.current = false
      panel.inert = false
      delete panel.dataset.anchoredDialog
      if (panel.open) hideDialog(panel)
    }
  }, [anchor, initialFocus, motion])

  function close(afterClose?: () => void) {
    const panel = dialogRef.current
    if (!panel?.open || isClosing.current) return
    isClosing.current = true

    function finish() {
      if (!panel) return
      hideDialog(panel)
      animation.current?.cancel()
      animation.current = null
      panel.inert = false
      try { afterClose?.() }
      finally { onClose() }
    }

    const opening = animation.current
    if (prefersReducedMotion()) {
      finish()
      return
    }

    if (opening && opening.playState !== 'finished') {
      if (opening.currentTime === null || opening.currentTime === 0) {
        finish()
        return
      }
      panel.inert = true
      panel.dataset.anchoredDialog = 'closing'
      opening.onfinish = finish
      opening.reverse()
      return
    }

    const frames = dialogFrames(panel, anchor, motion)
    if (!frames) {
      finish()
      return
    }
    panel.inert = true
    panel.dataset.anchoredDialog = 'closing'
    const closing = panel.animate(frames, { ...paperTiming, duration: motion === 'card' ? 215 : 195, direction: 'reverse', fill: 'both' })
    animation.current = closing
    closing.onfinish = finish
  }

  const backdropProps = {
    onPointerDown(event: PointerEvent<HTMLDialogElement>) {
      startedOnBackdrop.current = event.button === 0 && hitsBackdrop(event)
    },
    onPointerCancel() {
      startedOnBackdrop.current = false
    },
    onClick(event: MouseEvent<HTMLDialogElement>) {
      const isBackdropClick = startedOnBackdrop.current && hitsBackdrop(event)
      startedOnBackdrop.current = false
      if (isBackdropClick) (onBackdropClick ?? close)()
    },
  }

  return { dialogRef, close, backdropProps }
}
