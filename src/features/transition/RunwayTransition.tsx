import { CSSProperties, useEffect, useRef, useState } from 'react'
import type { TransitionOrigin } from '../auth/types'
import type { TransitionStage } from './transitionTypes'
import './transition.css'

export const TRANSITION_MS = 3000
export const REDUCED_TRANSITION_MS = 150

type RunwayTransitionProps = {
  origin: TransitionOrigin
  actionLabel: 'Sign Up' | 'Login'
  onComplete: () => void
}

type TransitionStyle = CSSProperties & {
  '--origin-left': string
  '--origin-top': string
  '--origin-width': string
  '--origin-height': string
  '--divider-x': string
  '--card-top': string
  '--card-height': string
  '--origin-center-x': string
  '--origin-center-y': string
  '--circle-left': string
  '--circle-top': string
  '--bar-left': string
  '--plane-top': string
  '--flight-distance': string
}

const BAR_WIDTH = 44
const PLANE_SIZE = 64
const TAIL_HALF_SPAN = 12.2
const TAIL_Y_OFFSET = 59.5
const TAIL_RISE = 3.3
const TAIL_EDGE_SLOPE = TAIL_RISE / TAIL_HALF_SPAN
const TRAIL_OVERSCAN = 32

function Airplane() {
  return (
    <svg
      className="transition-airplane"
      data-testid="transition-airplane"
      aria-hidden="true"
      viewBox="0 0 64 64"
    >
      <path d="M32 2c3.2 0 5 6.5 5 14.5v8.7l18.5 11.3v6L37 37.8v11.7l7.2 5.2v4.8L32 56.2l-12.2 3.3v-4.8l7.2-5.2V37.8L8.5 42.5v-6L27 25.2v-8.7C27 8.5 28.8 2 32 2Z" />
    </svg>
  )
}

export function RunwayTransition({
  origin,
  actionLabel,
  onComplete,
}: RunwayTransitionProps) {
  const [stage, setStage] = useState<TransitionStage>('collapse')
  const completed = useRef(false)

  useEffect(() => {
    const reduced = window.matchMedia?.(
      '(prefers-reduced-motion: reduce)',
    ).matches
    const boundaries = reduced
      ? { dock: 30, stretch: 65, morph: 100, flight: 120 }
      : { dock: 450, stretch: 1000, morph: 1700, flight: 1900 }
    const completeAt = reduced ? REDUCED_TRANSITION_MS : TRANSITION_MS

    const stageTimers = (
      Object.entries(boundaries) as Array<
        [Exclude<TransitionStage, 'collapse'>, number]
      >
    ).map(([nextStage, delay]) =>
      window.setTimeout(() => setStage(nextStage), delay),
    )
    const completionTimer = window.setTimeout(() => {
      if (completed.current) return
      completed.current = true
      onComplete()
    }, completeAt)

    return () => {
      stageTimers.forEach((timer) => window.clearTimeout(timer))
      window.clearTimeout(completionTimer)
    }
  }, [onComplete])

  const originCenterX = origin.left + origin.width / 2
  const originCenterY = origin.top + origin.height / 2
  const cardBottom = origin.cardTop + origin.cardHeight
  const planeTop = cardBottom - PLANE_SIZE
  const tailY = planeTop + TAIL_Y_OFFSET
  const tailLeftX = origin.dividerX - TAIL_HALF_SPAN
  const tailRightX = origin.dividerX + TAIL_HALF_SPAN

  // Carry the same trail past both top corners before handing off to the homepage.
  const farthestSide = Math.max(0, tailLeftX, window.innerWidth - tailRightX)
  const flightDistance = Math.ceil(Math.max(
    cardBottom + 34,
    tailY + farthestSide * TAIL_EDGE_SLOPE + TRAIL_OVERSCAN,
  ))
  const trailBottomY = window.innerHeight + flightDistance + TRAIL_OVERSCAN
  const trailRun = (trailBottomY - tailY) / TAIL_EDGE_SLOPE
  const trailLeftX = tailLeftX - trailRun
  const trailRightX = tailRightX + trailRun
  const trailPoints = [
    [tailLeftX, tailY],
    [origin.dividerX, tailY - TAIL_RISE],
    [tailRightX, tailY],
    [trailRightX, trailBottomY],
    [trailLeftX, trailBottomY],
  ].map(([x, y]) => `${x},${y}`).join(' ')

  const style: TransitionStyle = {
    '--origin-left': `${origin.left}px`,
    '--origin-top': `${origin.top}px`,
    '--origin-width': `${origin.width}px`,
    '--origin-height': `${origin.height}px`,
    '--divider-x': `${origin.dividerX}px`,
    '--card-top': `${origin.cardTop}px`,
    '--card-height': `${origin.cardHeight}px`,
    '--origin-center-x': `${originCenterX}px`,
    '--origin-center-y': `${originCenterY}px`,
    '--circle-left': `${originCenterX - BAR_WIDTH / 2}px`,
    '--circle-top': `${originCenterY - BAR_WIDTH / 2}px`,
    '--bar-left': `${origin.dividerX - BAR_WIDTH / 2}px`,
    '--plane-top': `${planeTop}px`,
    '--flight-distance': `${-flightDistance}px`,
  }

  return (
    <div
      className={`runway-transition stage-${stage}`}
      data-testid="runway-transition"
      data-stage={stage}
      style={style}
      aria-hidden="true"
    >
      <div className="transition-shape" data-testid="transition-shape">
        <span className="transition-label">{actionLabel}</span>
      </div>
      <span className="transition-dot" data-testid="transition-dot" />
      <div className="flight-assembly" data-testid="flight-assembly">
        <svg className="flight-trail" aria-hidden="true">
          <polygon className="page-wipe" data-testid="page-wipe" points={trailPoints} />
          <line
            className="wing-guide"
            data-testid="wing-guide-left"
            x1={tailLeftX}
            y1={tailY}
            x2={trailLeftX}
            y2={trailBottomY}
          />
          <line
            className="wing-guide"
            data-testid="wing-guide-right"
            x1={tailRightX}
            y1={tailY}
            x2={trailRightX}
            y2={trailBottomY}
          />
        </svg>
        <Airplane />
      </div>
    </div>
  )
}
