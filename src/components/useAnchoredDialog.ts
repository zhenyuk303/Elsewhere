import { useLayoutEffect, useRef, type MouseEvent, type PointerEvent } from 'react'
import './anchored-dialog.css'

type AnchoredDialogOptions = {
  anchor: HTMLElement | null
  onClose: () => void
  initialFocus?: string
  onBackdropClick?: () => void
}

const motionQuery = '(prefers-reduced-motion: reduce)'

function prefersReducedMotion() {
  return window.matchMedia?.(motionQuery).matches ?? false
}

function dialogFrames(panel: HTMLDialogElement, anchor: HTMLElement | null): Keyframe[] | undefined {
  if (!anchor?.isConnected || typeof panel.animate !== 'function' || prefersReducedMotion()) return
  if (window.CSS?.supports('clip-path', 'path("M 0 0 L 0 1 Z")') === false) return

  const target = panel.getBoundingClientRect()
  const source = anchor.getBoundingClientRect()
  if (!source.width || !source.height || target.width < 40 || target.height < 40) return

  const { width, height } = target
  const pullsLeft = source.left + source.width / 2 >= target.left + width / 2
  const pullsUp = source.top + source.height / 2 >= target.top + height / 2
  const seam = Math.min(26, source.height / 2)
  const seamX = pullsLeft ? source.left : source.right
  const seamY = source.top + (source.height + (pullsUp ? seam : -seam)) / 2
  const startX = seamX - (pullsLeft ? target.right : target.left)
  const startY = seamY - (pullsUp ? target.bottom : target.top)
  const reachX = Math.max(4, Math.min(width * .36, 168,
    (pullsLeft ? seamX : window.innerWidth - seamX) - 10))
  const reachY = Math.max(seam, Math.min(height * .39, 164,
    (pullsUp ? seamY : window.innerHeight - seamY) - 10))

  function point(x: number, y: number) {
    return `${(pullsLeft ? width - x : x).toFixed(2)} ${(pullsUp ? height - y : y).toFixed(2)}`
  }

  function sheet(reach: number, length: number, neck: number, droop: number, curl: number, padding = 0) {
    return `path("M ${point(-padding, -padding)}
      C ${point(reach * .24, -padding)}, ${point(reach * .66, droop * .1 - padding)}, ${point(reach, droop - padding)}
      C ${point(reach + curl, droop + (length - droop) * .24)}, ${point(reach + curl, length * .88)}, ${point(reach, length)}
      C ${point(reach * .7, length - (length - neck) * .08)}, ${point(reach * .34, neck)}, ${point(-padding, neck)}
      C ${point(-padding, neck * .65)}, ${point(-padding, neck * .25)}, ${point(-padding, -padding)} Z")`.replace(/\s+/g, ' ')
  }

  function frame(offset: number, position: number, clipPath: string, ink: number, sheen: number): Keyframe {
    return {
      offset,
      clipPath,
      transform: `translate(${startX * position}px, ${startY * position}px)`,
      '--paper-ink': ink,
      '--paper-sheen': sheen,
    }
  }

  // Pull a narrow leading edge out first. The curve fills in behind it while the form stays full size.
  const shadowInset = 56
  return [
    { ...frame(0, 1, sheet(0, seam, seam, 0, 0), 0, 0), easing: 'ease-out' },
    frame(.22, 1, sheet(reachX, reachY, seam, reachY * .42, 10), 0, .85),
    { ...frame(.55, .3, sheet(width * .83, height * .73, height * .32, height * .12, 14), .72, .52),
      easing: 'cubic-bezier(.2, .55, .26, 1)' },
    frame(1, 0, sheet(width + shadowInset, height + shadowInset, height + shadowInset, 0, 0, shadowInset), 1, 0),
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

export function useAnchoredDialog({ anchor, onClose, initialFocus, onBackdropClick }: AnchoredDialogOptions) {
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

    const frames = dialogFrames(panel, anchor)
    if (frames) {
      const opening = panel.animate(frames, { duration: 540, fill: 'backwards' })
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
  }, [anchor, initialFocus])

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

    const frames = dialogFrames(panel, anchor)
    if (!frames) {
      finish()
      return
    }
    panel.inert = true
    panel.dataset.anchoredDialog = 'closing'
    const closing = panel.animate(frames, { duration: 430, direction: 'reverse', fill: 'both' })
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
