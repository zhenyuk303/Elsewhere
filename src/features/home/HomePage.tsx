import { useEffect, useRef, useState, type TransitionEvent } from 'react'
import { travelSlides } from '../carousel/carouselData'
import './home.css'

export const HOME_ROTATION_MS = 10_000

type LayerSlot = 0 | 1

function placeLabel(location: string) {
  return `${location.toUpperCase()}, CHINA`
}

function ProfileIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <circle cx="12" cy="8" r="3.25" />
      <path d="M5.7 19c.8-3.5 3-5.3 6.3-5.3s5.5 1.8 6.3 5.3" />
    </svg>
  )
}

export function HomePage() {
  const [layerIndexes, setLayerIndexes] = useState<[number, number]>([0, 1])
  const [activeSlot, setActiveSlot] = useState<LayerSlot>(0)
  const layerReadyRef = useRef<[boolean, boolean]>([false, false])

  useEffect(() => {
    document.body.classList.add('home-view')
    return () => document.body.classList.remove('home-view')
  }, [])

  useEffect(() => {
    const timer = window.setInterval(() => {
      setActiveSlot((slot) => {
        const preparedSlot: LayerSlot = slot === 0 ? 1 : 0
        return layerReadyRef.current[preparedSlot] ? preparedSlot : slot
      })
    }, HOME_ROTATION_MS)

    return () => window.clearInterval(timer)
  }, [])

  function handleFadeComplete(
    slot: LayerSlot,
    event: TransitionEvent<HTMLDivElement>,
  ) {
    if (event.propertyName !== 'opacity' || slot !== activeSlot) return

    const hiddenSlot: LayerSlot = activeSlot === 0 ? 1 : 0
    const followingIndex =
      (layerIndexes[activeSlot] + 1) % travelSlides.length
    layerReadyRef.current[hiddenSlot] = false
    setLayerIndexes((indexes) => {
      if (indexes[hiddenSlot] === followingIndex) return indexes
      const nextIndexes: [number, number] = [...indexes]
      nextIndexes[hiddenSlot] = followingIndex
      return nextIndexes
    })
  }

  return (
    <main className="homepage" aria-labelledby="homepage-title">
      <section
        className="homepage-background"
        aria-label="Travel destinations"
      >
        {layerIndexes.map((slideIndex, slot) => {
          const slide = travelSlides[slideIndex]
          const layerSlot = slot as LayerSlot
          return (
            <div
              className={`homepage-slide ${activeSlot === layerSlot ? 'is-active' : ''}`}
              key={layerSlot}
              aria-hidden={activeSlot !== layerSlot}
              onTransitionEnd={(event) =>
                handleFadeComplete(layerSlot, event)
              }
            >
              <img
                src={slide.src}
                alt=""
                aria-hidden="true"
                onLoad={() => {
                  layerReadyRef.current[layerSlot] = true
                }}
                onError={() => {
                  layerReadyRef.current[layerSlot] = false
                }}
              />
              <p className="homepage-location">{placeLabel(slide.location)}</p>
            </div>
          )
        })}
      </section>

      <nav className="homepage-nav" aria-label="Primary navigation">
        <span className="homepage-brand">ELSEWHERE</span>
        <div className="homepage-nav-links">
          <span>Footprints</span>
          <span>Guides</span>
          <span>Community</span>
          <button
            className="homepage-profile"
            type="button"
            aria-label="User profile"
          >
            <ProfileIcon />
          </button>
        </div>
      </nav>

      <section className="homepage-copy">
        <p className="homepage-kicker">A WORLD WAITING FOR YOU</p>
        <h1 id="homepage-title">
          <span className="homepage-title-strong">Explore</span>
          {' '}
          <span className="homepage-title-light">the World</span>
        </h1>
        <span className="homepage-divider" aria-hidden="true" />
        <p className="homepage-intro">
          <span>Take the road less traveled.</span>
          <span>Collect moments, leave footprints,</span>
          <span>and find your own elsewhere.</span>
        </p>
      </section>

      <p className="homepage-section-marker">01 / A NEW PERSPECTIVE</p>
    </main>
  )
}
