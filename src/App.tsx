import { useCallback, useEffect, useReducer, useRef, useState } from 'react'
import { AuthPanel } from './features/auth/AuthPanel'
import {
  authenticate,
  beginSocialLogin,
  currentUser,
  logout,
  type SocialProvider,
} from './features/auth/authApi'
import type {
  AuthMode,
  ButtonRect,
  TransitionOrigin,
} from './features/auth/types'
import { TravelCarousel } from './features/carousel/TravelCarousel'
import { HomePage } from './features/home/HomePage'
import {
  HOME_GALLERY_MS,
  HOME_LIFT_MS,
  homeIntroSlides,
  preloadHomeImage,
  type HomePhase,
} from './features/home/homeIntro'
import { RunwayTransition } from './features/transition/RunwayTransition'

type ActiveHomePhase = Exclude<HomePhase, 'primed'>

type AppScreenState =
  | {
      view: 'auth'
      homePhase: null
      transitionOrigin: null
      transitionActionLabel: null
    }
  | {
      view: 'transitioning'
      homePhase: 'primed'
      transitionOrigin: TransitionOrigin
      transitionActionLabel: 'Sign Up' | 'Login'
    }
  | {
      view: 'home'
      homePhase: ActiveHomePhase
      transitionOrigin: null
      transitionActionLabel: null
    }

type AppScreenAction =
  | {
      type: 'start-transition'
      origin: TransitionOrigin
      actionLabel: 'Sign Up' | 'Login'
    }
  | { type: 'complete-transition'; reducedMotion: boolean }
  | { type: 'advance-home'; phase: Extract<HomePhase, 'lifting' | 'ready'> }
  | { type: 'restore-oauth'; reducedMotion: boolean }
  | { type: 'return-to-auth' }

const initialScreenState: AppScreenState = {
  view: 'auth',
  homePhase: null,
  transitionOrigin: null,
  transitionActionLabel: null,
}

function screenReducer(
  state: AppScreenState,
  action: AppScreenAction,
): AppScreenState {
  switch (action.type) {
    case 'start-transition':
      if (state.view !== 'auth') return state
      return {
        view: 'transitioning',
        homePhase: 'primed',
        transitionOrigin: action.origin,
        transitionActionLabel: action.actionLabel,
      }
    case 'complete-transition':
      if (state.view !== 'transitioning') return state
      return {
        view: 'home',
        homePhase: action.reducedMotion ? 'ready' : 'gallery',
        transitionOrigin: null,
        transitionActionLabel: null,
      }
    case 'advance-home':
      if (state.view !== 'home') return state
      if (action.phase === 'lifting' && state.homePhase !== 'gallery') return state
      if (action.phase === 'ready' && state.homePhase !== 'lifting') return state
      return { ...state, homePhase: action.phase }
    case 'restore-oauth':
      return {
        view: 'home',
        homePhase: action.reducedMotion ? 'ready' : 'gallery',
        transitionOrigin: null,
        transitionActionLabel: null,
      }
    case 'return-to-auth':
      return initialScreenState
  }
}

function prefersReducedMotion() {
  return Boolean(
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches,
  )
}

export function App() {
  const cardRef = useRef<HTMLDivElement>(null)
  const [authMode, setAuthMode] = useState<AuthMode>('login')
  const [screen, dispatch] = useReducer(screenReducer, initialScreenState)
  const [isLogoutPending, setIsLogoutPending] = useState(false)
  const [oauthError] = useState(() => {
    const error = new URLSearchParams(window.location.search).get('oauthError')
    return error === 'cancelled' ? 'Third-party login was cancelled.'
      : error === 'invalid' ? 'Third-party login expired. Please try again.'
      : error === 'failed' ? 'Third-party login failed. Please try again.' : ''
  })
  const [oauthSucceeded] = useState(
    () => new URLSearchParams(window.location.search).get('oauth') === 'success',
  )

  useEffect(() => {
    const prepareFirstImage = () => {
      void preloadHomeImage(homeIntroSlides[0].src)
    }

    if (typeof window.requestIdleCallback === 'function') {
      const idleId = window.requestIdleCallback(prepareFirstImage)
      return () => window.cancelIdleCallback(idleId)
    }

    const timer = window.setTimeout(prepareFirstImage, 0)
    return () => window.clearTimeout(timer)
  }, [])

  useEffect(() => {
    if (!oauthSucceeded) return

    let active = true
    currentUser().then((restored) => {
      if (active && restored) {
        dispatch({
          type: 'restore-oauth',
          reducedMotion: prefersReducedMotion(),
        })
      }
    })
    return () => { active = false }
  }, [oauthSucceeded])

  useEffect(() => {
    if (!oauthError && !oauthSucceeded) return

    const url = new URL(window.location.href)
    url.searchParams.delete('oauthError')
    url.searchParams.delete('oauth')
    window.history.replaceState(null, '', url.pathname + url.search + url.hash)
  }, [oauthError, oauthSucceeded])

  useEffect(() => {
    if (screen.view !== 'home') return

    const next = screen.homePhase === 'gallery'
      ? { delay: HOME_GALLERY_MS, phase: 'lifting' as const }
      : screen.homePhase === 'lifting'
        ? { delay: HOME_LIFT_MS, phase: 'ready' as const }
        : null
    if (!next) return

    const timer = window.setTimeout(() => {
      dispatch({ type: 'advance-home', phase: next.phase })
    }, next.delay)
    return () => window.clearTimeout(timer)
  }, [screen])

  const handleAuthenticate = useCallback(async (username: string, password: string, agreementAccepted: boolean) => {
    await authenticate(authMode, username, password, agreementAccepted)
  }, [authMode])

  const handleSocialLogin = useCallback(async (provider: SocialProvider) => {
    const url = await beginSocialLogin(provider)
    window.location.assign(url)
  }, [])

  const handleValidSubmit = useCallback(
    (buttonOrigin: ButtonRect, submittedMode: AuthMode) => {
      if (screen.view !== 'auth') return

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

      dispatch({
        type: 'start-transition',
        origin: {
          ...buttonOrigin,
          dividerX,
          cardTop: cardRect.top,
          cardHeight: cardRect.height,
        },
        actionLabel: submittedMode === 'signup' ? 'Sign Up' : 'Login',
      })
    },
    [screen.view],
  )

  const handleTransitionComplete = useCallback(() => {
    dispatch({
      type: 'complete-transition',
      reducedMotion: prefersReducedMotion(),
    })
  }, [])

  const handleLogout = useCallback(async () => {
    setIsLogoutPending(true)
    setAuthMode('login')
    dispatch({ type: 'return-to-auth' })
    try {
      await logout()
    } catch {
      // The client must still return to Login when cleanup is unavailable.
    } finally {
      setIsLogoutPending(false)
    }
  }, [])

  return (
    <>
      {screen.view !== 'auth' ? (
        <HomePage phase={screen.homePhase} onLogout={handleLogout} />
      ) : null}

      {screen.view !== 'home' ? (
        <main className="app-shell auth-layer">
          <div
            ref={cardRef}
            className={`journey-card ${screen.view === 'transitioning' ? 'is-transitioning' : ''}`}
            data-testid="auth-journey"
          >
            <section className="auth-shell" aria-labelledby="auth-title">
              <AuthPanel
                key={authMode}
                mode={authMode}
                disabled={screen.view === 'transitioning' || isLogoutPending}
                onModeChange={setAuthMode}
                onAuthenticate={handleAuthenticate}
                onSocialLogin={handleSocialLogin}
                initialError={oauthError}
                onValidSubmit={handleValidSubmit}
              />
            </section>
            <TravelCarousel paused={screen.view === 'transitioning'} />
          </div>
          {screen.view === 'transitioning' ? (
            <RunwayTransition
              origin={screen.transitionOrigin}
              actionLabel={screen.transitionActionLabel}
              onComplete={handleTransitionComplete}
            />
          ) : null}
        </main>
      ) : null}
    </>
  )
}
