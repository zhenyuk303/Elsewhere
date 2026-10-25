import { useCallback, useEffect, useRef, useState } from 'react'
import { AuthPanel } from './features/auth/AuthPanel'
import { authenticate, currentUser, logout, type AuthUser } from './features/auth/authApi'
import type {
  AuthMode,
  ButtonRect,
  TransitionOrigin,
} from './features/auth/types'
import { TravelCarousel } from './features/carousel/TravelCarousel'
import { HomePlaceholder } from './features/home/HomePlaceholder'
import { RunwayTransition } from './features/transition/RunwayTransition'

type ViewState = 'auth' | 'transitioning' | 'home'

export function App() {
  const cardRef = useRef<HTMLDivElement>(null)
  const [authMode, setAuthMode] = useState<AuthMode>('signup')
  const [view, setView] = useState<ViewState>('auth')
  const [user, setUser] = useState<AuthUser | null>(null)
  const [transitionOrigin, setTransitionOrigin] =
    useState<TransitionOrigin | null>(null)

  useEffect(() => {
    let active = true
    currentUser().then((restored) => {
      if (active && restored) {
        setUser(restored)
        setView('home')
      }
    })
    return () => { active = false }
  }, [])

  const handleAuthenticate = useCallback(async (username: string, password: string, agreementAccepted: boolean) => {
    const signedIn = await authenticate(authMode, username, password, agreementAccepted)
    setUser(signedIn)
  }, [authMode])

  const handleLogout = useCallback(async () => {
    await logout()
    setUser(null)
    setTransitionOrigin(null)
    setView('auth')
    setAuthMode('login')
  }, [])

  const handleValidSubmit = useCallback(
    (buttonOrigin: ButtonRect) => {
      if (view !== 'auth') return

      const card = cardRef.current
      if (!card) return

      const cardRect = card.getBoundingClientRect()
      const carouselRect = card
        .querySelector<HTMLElement>('.travel-carousel')
        ?.getBoundingClientRect()
      const isStacked = window.matchMedia?.('(max-width: 880px)').matches
      const dividerX = isStacked
        ? cardRect.left + cardRect.width / 2
        : (carouselRect?.left ?? cardRect.left + cardRect.width / 2)

      setTransitionOrigin({
        ...buttonOrigin,
        dividerX,
        cardTop: cardRect.top,
        cardHeight: cardRect.height,
      })
      setView('transitioning')
    },
    [view],
  )

  const handleTransitionComplete = useCallback(() => {
    setView('home')
  }, [])

  if (view === 'home') {
    return <HomePlaceholder username={user?.username} onLogout={handleLogout} />
  }

  return (
    <main className="app-shell">
      <div
        ref={cardRef}
        className={`journey-card ${view === 'transitioning' ? 'is-transitioning' : ''}`}
        data-testid="auth-journey"
      >
        <section className="auth-shell" aria-labelledby="auth-title">
          <AuthPanel
            key={authMode}
            mode={authMode}
            disabled={view === 'transitioning'}
            onModeChange={setAuthMode}
            onAuthenticate={handleAuthenticate}
            onValidSubmit={handleValidSubmit}
          />
        </section>
        <TravelCarousel paused={view === 'transitioning'} />
      </div>
      {view === 'transitioning' && transitionOrigin ? (
        <RunwayTransition
          origin={transitionOrigin}
          onComplete={handleTransitionComplete}
        />
      ) : null}
    </main>
  )
}
