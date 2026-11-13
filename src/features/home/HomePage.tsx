import { useEffect, useRef, useState, type TransitionEvent } from 'react'
import { travelSlides } from '../carousel/carouselData'
import './home.css'

export const HOME_ROTATION_MS = 10_000

type LayerSlot = 0 | 1

type HomePageProps = {
  onLogout: () => Promise<void>
}

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

export function HomePage({ onLogout }: HomePageProps) {
  const [layerIndexes, setLayerIndexes] = useState<[number, number]>([0, 1])
  const [activeSlot, setActiveSlot] = useState<LayerSlot>(0)
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false)
  const [isLogoutPending, setIsLogoutPending] = useState(false)
  const layerReadyRef = useRef<[boolean, boolean]>([false, false])
  const profileMenuRef = useRef<HTMLDivElement>(null)
  const profileButtonRef = useRef<HTMLButtonElement>(null)
  const logoutPendingRef = useRef(false)

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

  useEffect(() => {
    if (!isProfileMenuOpen) return

    function handlePointerDown(event: PointerEvent) {
      if (
        event.target instanceof Node &&
        !profileMenuRef.current?.contains(event.target)
      ) {
        setIsProfileMenuOpen(false)
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Escape') return
      setIsProfileMenuOpen(false)
      profileButtonRef.current?.focus()
    }

    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isProfileMenuOpen])

  async function handleLogout() {
    if (logoutPendingRef.current) return
    logoutPendingRef.current = true
    setIsLogoutPending(true)
    try {
      await onLogout()
      setIsProfileMenuOpen(false)
    } catch {
      // Keep the menu open so a failed logout can be retried.
    } finally {
      logoutPendingRef.current = false
      setIsLogoutPending(false)
    }
  }

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
          <button className="homepage-nav-action" type="button">
            Footprints
          </button>
          <button className="homepage-nav-action" type="button">
            Guides
          </button>
          <button className="homepage-nav-action" type="button">
            Community
          </button>
          <div className="homepage-profile-wrap" ref={profileMenuRef}>
            <button
              className="homepage-profile"
              type="button"
              aria-label="User profile"
              aria-haspopup="menu"
              aria-expanded={isProfileMenuOpen}
              aria-controls="homepage-profile-menu"
              ref={profileButtonRef}
              onClick={() => setIsProfileMenuOpen((open) => !open)}
            >
              <ProfileIcon />
            </button>
            {isProfileMenuOpen ? (
              <div
                className="homepage-profile-menu"
                id="homepage-profile-menu"
                role="menu"
                aria-label="User menu"
              >
                <button
                  className="homepage-profile-menu-item"
                  type="button"
                  role="menuitem"
                  onClick={() => setIsProfileMenuOpen(false)}
                >
                  Personal homepage
                </button>
                <button
                  className="homepage-profile-menu-item"
                  type="button"
                  role="menuitem"
                  disabled={isLogoutPending}
                  onClick={handleLogout}
                >
                  Log out
                </button>
              </div>
            ) : null}
          </div>
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
