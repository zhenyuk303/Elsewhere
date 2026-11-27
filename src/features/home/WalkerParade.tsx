import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { walkerCycles } from './walkerData'
import './walker.css'

const EMPTY_INTERVAL_MS = 5000

function prefersReducedMotion() {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
}

export function WalkerParade() {
  const [index, setIndex] = useState(0)
  const [waiting, setWaiting] = useState(false)
  const [reducedMotion, setReducedMotion] = useState(prefersReducedMotion)
  const [unavailable, setUnavailable] = useState(false)
  const completedCrossing = useRef(false)
  const failed = useRef(new Set<number>())
  const crossMs = useRef(Math.round((window.innerWidth + 180) / 140 * 1000))

  useEffect(() => {
    const query = window.matchMedia?.('(prefers-reduced-motion: reduce)')
    if (!query) return
    const update = () => setReducedMotion(query.matches)
    query.addEventListener?.('change', update)
    return () => query.removeEventListener?.('change', update)
  }, [])

  useEffect(() => {
    if (!waiting || reducedMotion || unavailable) return
    const timer = window.setTimeout(() => {
      let next = (index + 1) % walkerCycles.length
      while (failed.current.has(next) && next !== index) {
        next = (next + 1) % walkerCycles.length
      }
      completedCrossing.current = false
      setIndex(next)
      setWaiting(false)
    }, EMPTY_INTERVAL_MS)
    return () => window.clearTimeout(timer)
  }, [index, waiting, reducedMotion, unavailable])

  if (reducedMotion || unavailable) return null

  const cycle = walkerCycles[index]
  const style = {
    '--frame-steps': cycle.frameCount - 1,
    '--cycle-ms': `${cycle.cycleMs}ms`,
    '--cross-ms': `${crossMs.current}ms`,
  } as CSSProperties

  function finishCrossing(event: React.AnimationEvent<HTMLDivElement>) {
    if (event.target !== event.currentTarget || event.animationName !== 'walker-cross') return
    if (completedCrossing.current) return
    completedCrossing.current = true
    setWaiting(true)
  }

  function skipFailedSprite() {
    if (failed.current.has(index)) return
    failed.current.add(index)
    if (failed.current.size === walkerCycles.length) {
      setUnavailable(true)
      return
    }
    let next = (index + 1) % walkerCycles.length
    while (failed.current.has(next)) next = (next + 1) % walkerCycles.length
    completedCrossing.current = false
    setIndex(next)
    setWaiting(false)
  }

  return (
    <div className="walker-lane" aria-hidden="true">
      {!waiting ? (
        <div className="walker-crossing" key={cycle.id} style={style} onAnimationEnd={finishCrossing}>
          <div className="walker-frame">
            <img
              className="walker-strip"
              src={cycle.src}
              alt=""
              draggable={false}
              style={{ width: `${cycle.frameCount * 100}%` }}
              onError={skipFailedSprite}
            />
          </div>
        </div>
      ) : null}
    </div>
  )
}
