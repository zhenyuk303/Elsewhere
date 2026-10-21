import { CSSProperties, useEffect, useRef, useState } from 'react'
import type { TransitionOrigin } from '../auth/types'
import type { TransitionStage } from './transitionTypes'
import './transition.css'

export const TRANSITION_MS = 3200
export const REDUCED_TRANSITION_MS = 120

type RunwayTransitionProps = {
  origin: TransitionOrigin
  onComplete: () => void
}

type TransitionStyle = CSSProperties & {
  '--origin-left': string
  '--origin-top': string
  '--origin-width': string
  '--origin-height': string
}

function Airplane() {
  return (
    <svg
      className="runway-airplane"
      data-testid="airplane"
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
  const [stage, setStage] = useState<TransitionStage>('liquid')
  const completed = useRef(false)

  useEffect(() => {
    const reduced = window.matchMedia?.(
      '(prefers-reduced-motion: reduce)',
    ).matches
    const runwayAt = reduced ? 35 : 900
    const flightAt = reduced ? 70 : 1700
    const completeAt = reduced ? REDUCED_TRANSITION_MS : TRANSITION_MS

    const runwayTimer = window.setTimeout(() => setStage('runway'), runwayAt)
    const flightTimer = window.setTimeout(() => setStage('flight'), flightAt)
    const completionTimer = window.setTimeout(() => {
      if (completed.current) return
      completed.current = true
      onComplete()
    }, completeAt)

    return () => {
      window.clearTimeout(runwayTimer)
      window.clearTimeout(flightTimer)
      window.clearTimeout(completionTimer)
    }
  }, [onComplete])

  const style: TransitionStyle = {
    '--origin-left': `${origin.left}px`,
    '--origin-top': `${origin.top}px`,
    '--origin-width': `${origin.width}px`,
    '--origin-height': `${origin.height}px`,
  }

  return (
    <div
      className={`runway-transition stage-${stage}`}
      data-testid="runway-transition"
      data-stage={stage}
      style={style}
      aria-hidden="true"
    >
      <svg className="goo-filter" aria-hidden="true">
        <defs>
          <filter id="gooey-runway-filter">
            <feGaussianBlur in="SourceGraphic" stdDeviation="12" result="blur" />
            <feColorMatrix
              in="blur"
              mode="matrix"
              values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 24 -10"
              result="goo"
            />
            <feComposite in="SourceGraphic" in2="goo" operator="atop" />
          </filter>
        </defs>
      </svg>

      <div className="liquid-field">
        <div className="liquid-button">
          <span className="liquid-label">Login</span>
        </div>
        <span className="liquid-drop liquid-drop--one" />
        <span className="liquid-drop liquid-drop--two" />
        <span className="liquid-drop liquid-drop--three" />
      </div>

      <div className="runway-plane">
        <span className="runway-centerline" />
        <span className="runway-centerline runway-centerline--two" />
        <span className="runway-centerline runway-centerline--three" />
      </div>
      <Airplane />
      <div className="speed-light speed-light--left" />
      <div className="speed-light speed-light--right" />
    </div>
  )
}
