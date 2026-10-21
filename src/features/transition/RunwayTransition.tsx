import { CSSProperties, useEffect, useRef, useState } from 'react'
import type { TransitionOrigin } from '../auth/types'
import type { TransitionStage } from './transitionTypes'
import './transition.css'

export const TRANSITION_MS = 3000
export const REDUCED_TRANSITION_MS = 150

type RunwayTransitionProps = {
  origin: TransitionOrigin
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
}

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

  const style: TransitionStyle = {
    '--origin-left': `${origin.left}px`,
    '--origin-top': `${origin.top}px`,
    '--origin-width': `${origin.width}px`,
    '--origin-height': `${origin.height}px`,
    '--divider-x': `${origin.dividerX}px`,
    '--card-top': `${origin.cardTop}px`,
    '--card-height': `${origin.cardHeight}px`,
  }

  return (
    <div
      className={`runway-transition stage-${stage}`}
      data-testid="runway-transition"
      data-stage={stage}
      style={style}
      aria-hidden="true"
    >
      <div className="page-wipe" data-testid="page-wipe" />
      <div className="transition-shape" data-testid="transition-shape">
        <span className="transition-label">Login</span>
      </div>
      <span className="transition-dot" data-testid="transition-dot" />
      <span
        className="wing-guide wing-guide--left"
        data-testid="wing-guide-left"
      />
      <span
        className="wing-guide wing-guide--right"
        data-testid="wing-guide-right"
      />
      <Airplane />
    </div>
  )
}
