import { useCallback, useEffect, useRef, useState } from 'react'
import { AuthPanel } from './features/auth/AuthPanel'
import { authenticate, beginSocialLogin, currentUser, type SocialProvider } from './features/auth/authApi'
import type {
  AuthMode,
  ButtonRect,
  TransitionOrigin,
} from './features/auth/types'
import { TravelCarousel } from './features/carousel/TravelCarousel'
import { HomePage } from './features/home/HomePage'
import { RunwayTransition } from './features/transition/RunwayTransition'

type ViewState = 'auth' | 'transitioning' | 'home'

export function App() {
  const cardRef = useRef<HTMLDivElement>(null)
  const [authMode, setAuthMode] = useState<AuthMode>('signup')
  const [view, setView] = useState<ViewState>('auth')
  const [oauthError] = useState(() => {
    const error = new URLSearchParams(window.location.search).get('oauthError')
    return error === 'cancelled' ? 'Third-party login was cancelled.'
      : error === 'invalid' ? 'Third-party login expired. Please try again.'
      : error === 'failed' ? 'Third-party login failed. Please try again.' : ''
  })
  const [transitionOrigin, setTransitionOrigin] =
    useState<TransitionOrigin | null>(null)
  const [transitionActionLabel, setTransitionActionLabel] =
    useState<'Sign Up' | 'Login' | null>(null)

  useEffect(() => {
    let active = true
    currentUser().then((restored) => {
      if (active && restored) {
        setView('home')
      }
    })
    return () => { active = false }
  }, [])

  useEffect(() => {
    if (oauthError) {
      const url = new URL(window.location.href)
      url.searchParams.delete('oauthError')
      window.history.replaceState(null, '', url.pathname + url.search + url.hash)
    }
  }, [oauthError])

  const handleAuthenticate = useCallback(async (username: string, password: string, agreementAccepted: boolean) => {
    await authenticate(authMode, username, password, agreementAccepted)
  }, [authMode])

  const handleSocialLogin = useCallback(async (provider: SocialProvider) => {
    const url = await beginSocialLogin(provider)
    window.location.assign(url)
  }, [])

  const handleValidSubmit = useCallback(
    (buttonOrigin: ButtonRect, submittedMode: AuthMode) => {
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
      setTransitionActionLabel(
        submittedMode === 'signup' ? 'Sign Up' : 'Login',
      )
      setView('transitioning')
    },
    [view],
  )

  const handleTransitionComplete = useCallback(() => {
    setView('home')
  }, [])

  if (view === 'home') {
    return <HomePage />
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
            onSocialLogin={handleSocialLogin}
            initialError={oauthError}
            onValidSubmit={handleValidSubmit}
          />
        </section>
        <TravelCarousel paused={view === 'transitioning'} />
      </div>
      {view === 'transitioning' && transitionOrigin && transitionActionLabel ? (
        <RunwayTransition
          origin={transitionOrigin}
          actionLabel={transitionActionLabel}
          onComplete={handleTransitionComplete}
        />
      ) : null}
    </main>
  )
}
