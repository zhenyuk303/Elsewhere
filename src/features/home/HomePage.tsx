import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react'
import { homeIntroSlides, type HomePhase } from './homeIntro'
import './home.css'

type HomePageProps = {
  phase: HomePhase
  onLogout: () => Promise<void>
}

function ProfileIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <circle cx="12" cy="8" r="3.25" />
      <path d="M5.7 19c.8-3.5 3-5.3 6.3-5.3s5.5 1.8 6.3 5.3" />
    </svg>
  )
}

export function HomePage({ phase, onLogout }: HomePageProps) {
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false)
  const [isLogoutPending, setIsLogoutPending] = useState(false)
  const profileMenuRef = useRef<HTMLDivElement>(null)
  const profileButtonRef = useRef<HTMLButtonElement>(null)
  const logoutPendingRef = useRef(false)
  const menuFocusTargetRef = useRef<'first' | 'last'>('first')
  const isInteractive = phase === 'lifting' || phase === 'ready'
  const isHidden = phase === 'primed'
  const isInteractionLocked = !isInteractive

  useEffect(() => {
    if (isHidden) return
    document.body.classList.add('home-view')
    return () => document.body.classList.remove('home-view')
  }, [isHidden])

  useEffect(() => {
    if (isInteractive || !isProfileMenuOpen) return
    setIsProfileMenuOpen(false)
  }, [isInteractive, isProfileMenuOpen])

  useEffect(() => {
    if (!isProfileMenuOpen) return

    const menuItems = getMenuItems()
    const initialItem =
      menuFocusTargetRef.current === 'last'
        ? menuItems.at(-1)
        : menuItems[0]
    initialItem?.focus()

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
      closeProfileMenu(true)
    }

    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isProfileMenuOpen])

  function getMenuItems() {
    return Array.from(
      profileMenuRef.current?.querySelectorAll<HTMLButtonElement>(
        '[role="menuitem"]:not(:disabled)',
      ) ?? [],
    )
  }

  function openProfileMenu(focusTarget: 'first' | 'last' = 'first') {
    if (!isInteractive) return
    menuFocusTargetRef.current = focusTarget
    setIsProfileMenuOpen(true)
  }

  function closeProfileMenu(restoreFocus = false) {
    setIsProfileMenuOpen(false)
    if (restoreFocus) profileButtonRef.current?.focus()
  }

  function handleProfileClick() {
    if (!isInteractive) return
    if (isProfileMenuOpen) {
      closeProfileMenu()
      return
    }
    openProfileMenu()
  }

  function handleProfileKeyDown(event: ReactKeyboardEvent) {
    if (!isInteractive) return
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return
    event.preventDefault()
    openProfileMenu(event.key === 'ArrowUp' ? 'last' : 'first')
  }

  function handleMenuKeyDown(event: ReactKeyboardEvent) {
    if (event.key === 'Tab') {
      closeProfileMenu()
      return
    }

    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return
    event.preventDefault()
    const menuItems = getMenuItems()
    const currentIndex = menuItems.indexOf(
      document.activeElement as HTMLButtonElement,
    )
    const direction = event.key === 'ArrowDown' ? 1 : -1
    const nextIndex =
      (currentIndex + direction + menuItems.length) % menuItems.length
    menuItems[nextIndex]?.focus()
  }

  async function handleLogout() {
    if (logoutPendingRef.current) return
    logoutPendingRef.current = true
    setIsLogoutPending(true)
    try {
      await onLogout()
      closeProfileMenu(true)
    } catch {
      // Keep the menu open so a failed logout can be retried.
    } finally {
      logoutPendingRef.current = false
      setIsLogoutPending(false)
    }
  }

  return (
    <main
      className={`homepage homepage--${phase}`}
      data-home-phase={phase}
      aria-labelledby="homepage-title"
      aria-hidden={isHidden ? true : undefined}
      inert={isInteractionLocked ? true : undefined}
    >
      <div className="homepage-warm-reveal" aria-hidden="true" />

      <nav
        className="homepage-nav"
        aria-label="Primary navigation"
        aria-hidden={isInteractionLocked ? true : undefined}
      >
        <div className="homepage-nav-left">
          <button className="homepage-nav-action" type="button">
            Footprints
          </button>
        </div>
        <span className="homepage-brand">ELSEWHERE</span>
        <div className="homepage-nav-right">
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
              onClick={handleProfileClick}
              onKeyDown={handleProfileKeyDown}
            >
              <ProfileIcon />
            </button>
            {isProfileMenuOpen ? (
              <div
                className="homepage-profile-menu"
                id="homepage-profile-menu"
                role="menu"
                aria-label="User menu"
                onKeyDown={handleMenuKeyDown}
              >
                <button
                  className="homepage-profile-menu-item"
                  type="button"
                  role="menuitem"
                  onClick={() => closeProfileMenu(true)}
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

      <h1 className="homepage-marquee" id="homepage-title">
        <span>FIND YOUR ELSEWHERE</span>
      </h1>

      <div className="homepage-intro-visual">
        {homeIntroSlides.map((slide, index) => (
          <img
            className="homepage-intro-image"
            data-slide-index={index}
            key={slide.id}
            src={slide.src}
            alt={slide.alt}
            decoding="async"
            loading="eager"
          />
        ))}
      </div>

      <div className="homepage-intro-copies" aria-hidden={phase === 'ready'}>
        {homeIntroSlides.map((slide, index) => (
          <p
            className="homepage-intro-copy"
            data-slide-index={index}
            key={slide.id}
          >
            {slide.copy}
          </p>
        ))}
      </div>

      <section
        className="homepage-final-copy"
        aria-hidden={phase === 'gallery' || phase === 'primed' ? true : undefined}
      >
        <p>
          <span>Follow the places that move you.</span>
          <span>Keep the moments that stay.</span>
        </p>
        <button className="homepage-primary-action" type="button">
          BEGIN THE JOURNEY
        </button>
      </section>

      <p className="homepage-credit">ELSEWHERE · 2026</p>
    </main>
  )
}
