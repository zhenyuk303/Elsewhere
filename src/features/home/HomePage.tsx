import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from 'react'
import { BrandLogo } from '../brand/BrandLogo'
import { usePopupPullout } from '../transition/usePopupPullout'
import {
  FOOTPRINTS_TO_GUIDES_EXIT_MS,
  HOME_ACTION_DELAY_MS,
  HOME_CONTENT_DELAY_MS,
  HOME_COUNTER_EXIT_AT_MS,
  HOME_COUNTER_STOPS,
  HOME_FOOTPRINTS_EXIT_MS,
  HOME_LINE_REVEAL_MS,
  HOME_SLIDE_INTERVAL_MS,
  homeIntroSlides,
  type HomePhase,
} from './homeIntro'
import { useHomeMarquee } from './useHomeMarquee'
import { WalkerParade } from './WalkerParade'
import './home.css'

const introStyle = {
  '--home-counter-exit-at': `${HOME_COUNTER_EXIT_AT_MS}ms`,
  '--home-content-delay': `${HOME_CONTENT_DELAY_MS}ms`,
  '--home-action-delay': `${HOME_ACTION_DELAY_MS}ms`,
  '--home-line-duration': `${HOME_LINE_REVEAL_MS}ms`,
  '--home-footprints-exit': `${HOME_FOOTPRINTS_EXIT_MS}ms`,
  '--footprints-guides-exit': `${FOOTPRINTS_TO_GUIDES_EXIT_MS}ms`,
} as CSSProperties

const digits = Array.from({ length: 10 }, (_, digit) => digit)
const actionEdges = ['top', 'right', 'bottom', 'left'] as const

type Subpage = 'footprints' | 'guides' | 'community'

type HomePageProps = {
  phase: HomePhase
  onLogout: () => Promise<void>
  onOpenFootprints?: () => void
  onOpenGuides?: () => void
  onOpenCommunity?: () => void
  onReturnHome?: () => void
  footprints?: ReactNode
  guides?: ReactNode
  community?: ReactNode
}

function ProfileIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <circle cx="12" cy="8" r="3.25" />
      <path d="M5.7 19c.8-3.5 3-5.3 6.3-5.3s5.5 1.8 6.3 5.3" />
    </svg>
  )
}

function IntroCounter({ phase }: { phase: HomePhase }) {
  const isRunning = phase === 'gallery' || phase === 'lifting'
  const [target, setTarget] = useState<number>(HOME_COUNTER_STOPS[0])

  useEffect(() => {
    if (!isRunning) return

    setTarget(HOME_COUNTER_STOPS[0])
    const timers = HOME_COUNTER_STOPS.slice(1).map((stop, index) =>
      window.setTimeout(() => setTarget(stop), (index + 1) * HOME_SLIDE_INTERVAL_MS),
    )
    return () => timers.forEach((timer) => window.clearTimeout(timer))
  }, [isRunning])

  const count = isRunning ? target : HOME_COUNTER_STOPS[0]

  return (
    <div className="homepage-intro-counter" aria-hidden="true">
      <div className="homepage-counter-window">
        <div className="homepage-counter-reels">
          {[Math.floor(count / 10), count % 10].map((digit, column) => (
            <span className="homepage-counter-column" key={column}>
              <span className="homepage-counter-strip" style={{ '--digit': digit } as CSSProperties}>
                {digits.map((value) => <span key={value}>{value}</span>)}
              </span>
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}

function HomepageMarquee({ phase }: { phase: HomePhase }) {
  const trackRef = useRef<HTMLSpanElement>(null)
  const [hasEntered, setHasEntered] = useState(false)
  useHomeMarquee(trackRef, phase === 'ready' || (phase === 'lifting' && hasEntered))

  return (
    <h1 className="homepage-marquee" id="homepage-title">
      <span className="homepage-marquee-reveal" onAnimationStart={(event) => {
        if (event.target === event.currentTarget) setHasEntered(true)
      }}>
        <span className="homepage-marquee-track" ref={trackRef}>
          <span>FIND YOUR ELSEWHERE</span>
          <span aria-hidden="true">FIND YOUR ELSEWHERE</span>
          <span aria-hidden="true">FIND YOUR ELSEWHERE</span>
        </span>
      </span>
    </h1>
  )
}

export function HomePage({
  phase, onLogout, onOpenFootprints, onOpenGuides, onOpenCommunity, onReturnHome, footprints, guides, community,
}: HomePageProps) {
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false)
  const [isLogoutPending, setIsLogoutPending] = useState(false)
  const [pendingPage, setPendingPage] = useState<Subpage | null>(null)
  const [guidesArrival, setGuidesArrival] = useState(false)
  const profileMenuRef = useRef<HTMLDivElement>(null)
  const profilePopupRef = useRef<HTMLDivElement>(null)
  const showProfilePopup = usePopupPullout(isProfileMenuOpen, profilePopupRef)
  const profileButtonRef = useRef<HTMLButtonElement>(null)
  const logoutPendingRef = useRef(false)
  const menuFocusTargetRef = useRef<'first' | 'last'>('first')
  const footprintsButtonRef = useRef<HTMLButtonElement>(null)
  const guidesButtonRef = useRef<HTMLButtonElement>(null)
  const communityButtonRef = useRef<HTMLButtonElement>(null)
  const activePage = community ? 'community' : guides ? 'guides' : footprints ? 'footprints' : null
  const hasSubpage = activePage !== null
  const leavingHome = !hasSubpage && pendingPage !== null
  const leavingFootprints = !!footprints && pendingPage === 'guides'
  const openPages = { footprints: onOpenFootprints, guides: onOpenGuides, community: onOpenCommunity }
  const openPendingPage = pendingPage ? openPages[pendingPage] : undefined
  const isInteractive = phase === 'lifting' || phase === 'ready'
  const isHidden = phase === 'primed'
  const isInteractionLocked = !isInteractive

  useEffect(() => {
    if (isHidden || hasSubpage) return
    document.body.classList.add('home-view')
    return () => document.body.classList.remove('home-view')
  }, [isHidden, hasSubpage])

  useEffect(() => {
    if (!openPendingPage) return
    const timer = window.setTimeout(() => {
      setGuidesArrival(leavingFootprints)
      setPendingPage(null)
      openPendingPage()
    }, leavingFootprints ? FOOTPRINTS_TO_GUIDES_EXIT_MS : HOME_FOOTPRINTS_EXIT_MS)
    return () => window.clearTimeout(timer)
  }, [pendingPage, leavingFootprints, openPendingPage])

  function openPage(destination: Subpage) {
    const open = openPages[destination]
    if (!isInteractive || !open || pendingPage === destination) return
    if (activePage === destination) {
      setPendingPage(null)
      return
    }
    if ((hasSubpage && !(activePage === 'footprints' && destination === 'guides')) ||
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      setPendingPage(null)
      setGuidesArrival(false)
      open()
      return
    }
    setPendingPage(destination)
  }

  function returnHome() {
    const triggerPage = pendingPage ?? activePage
    const trigger = triggerPage === 'community' ? communityButtonRef : triggerPage === 'guides' ? guidesButtonRef : footprintsButtonRef
    setPendingPage(null)
    setGuidesArrival(false)
    onReturnHome?.()
    trigger.current?.focus({ preventScroll: true })
  }

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
      closeProfileMenu(true)
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
      closeProfileMenu(true)
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
      className={`homepage homepage--${activePage ?? phase}`}
      style={introStyle}
      data-home-phase={phase}
      data-footprints-transition={leavingHome ? 'leaving' : undefined}
      aria-labelledby={`${activePage ?? 'homepage'}-title`}
      aria-hidden={isHidden ? true : undefined}
      inert={isInteractionLocked ? true : undefined}
    >
      <div
        className="homepage-warm-reveal"
        aria-hidden={isInteractionLocked ? true : undefined}
      >
        <nav
          className="homepage-nav"
          aria-label="Primary navigation"
          aria-hidden={isInteractionLocked ? true : undefined}
        >
          {onReturnHome || hasSubpage ? (
            <button type="button" className="homepage-brand-home" aria-label="Elsewhere home"
              disabled={!hasSubpage && !leavingHome} onClick={returnHome}>
              <BrandLogo className="homepage-brand homepage-reveal-line" decorative />
            </button>
          ) : <BrandLogo className="homepage-brand homepage-reveal-line" />}
          <div className="homepage-nav-right">
            <button className="homepage-nav-action" type="button" ref={footprintsButtonRef}
              aria-current={footprints ? 'page' : undefined} onClick={() => openPage('footprints')}>
              <span className="homepage-reveal-line">Footprints</span>
            </button>
            <button className="homepage-nav-action" type="button" ref={guidesButtonRef}
              aria-current={guides ? 'page' : undefined} onClick={() => openPage('guides')}>
              <span className="homepage-reveal-line">Guides</span>
            </button>
            <button className="homepage-nav-action" type="button" ref={communityButtonRef}
              aria-current={community ? 'page' : undefined} onClick={() => openPage('community')}>
              <span className="homepage-reveal-line">Community</span>
            </button>
          </div>
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
            {showProfilePopup ? (
              <div
                className="homepage-profile-menu"
                id="homepage-profile-menu"
                ref={profilePopupRef}
                role="menu"
                aria-label="User menu"
                aria-hidden={!isProfileMenuOpen || undefined}
                inert={!isProfileMenuOpen}
                onKeyDown={handleMenuKeyDown}
              >
                <button
                  className="homepage-profile-menu-item"
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    closeProfileMenu(true)
                    if (hasSubpage || leavingHome) returnHome()
                  }}
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
        </nav>

        {community ?? (guides ? (
          guidesArrival ? <div className="homepage-guides-arrival">{guides}</div> : guides
        ) : footprints ? (
          <div className="homepage-footprints-content" data-leaving={leavingFootprints || undefined} inert={leavingFootprints}>
            {footprints}
          </div>
        ) : (
          <div className="homepage-route-content" inert={leavingHome ? true : undefined}>
            <HomepageMarquee phase={phase} />

            {phase === 'ready' ? <WalkerParade /> : null}

            <section
              className="homepage-final-copy"
              aria-hidden={phase === 'gallery' || phase === 'primed' ? true : undefined}
            >
              <p>
                <span className="homepage-reveal-line">Follow the places that move you.</span>
                <span className="homepage-reveal-line">Keep the moments that stay.</span>
              </p>
              <button className="homepage-primary-action" type="button">
                <span className="homepage-action-outline" aria-hidden="true">
                  {actionEdges.map((edge) => <span data-edge={edge} key={edge} />)}
                </span>
                <span className="homepage-action-label homepage-reveal-line">BEGIN THE JOURNEY</span>
              </button>
            </section>

            <footer className="homepage-footer">
              <p className="homepage-credit homepage-reveal-line"><BrandLogo /><span>· 2026</span></p>
            </footer>
          </div>
        ))}
      </div>

      {!hasSubpage && <>
      <div className="homepage-indigo-curtain" aria-hidden="true" />

      <div className="homepage-intro-visual">
        {homeIntroSlides.map((slide, index) => (
          <div
            className="homepage-intro-frame"
            data-slide-index={index}
            key={slide.id}
            style={{ '--frame-delay': `${index * HOME_SLIDE_INTERVAL_MS}ms` } as CSSProperties}
          >
            <img
              className="homepage-intro-image"
              src={slide.src}
              alt={slide.alt}
              decoding="async"
              loading="eager"
            />
          </div>
        ))}
      </div>

      <IntroCounter phase={phase} />
      </>}
    </main>
  )
}
