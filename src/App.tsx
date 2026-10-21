import { useCallback, useState } from 'react'
import { AuthPanel } from './features/auth/AuthPanel'
import type { AuthMode, TransitionOrigin } from './features/auth/types'
import { TravelCarousel } from './features/carousel/TravelCarousel'
import { HomePlaceholder } from './features/home/HomePlaceholder'
import { RunwayTransition } from './features/transition/RunwayTransition'

type ViewState = 'auth' | 'transitioning' | 'home'

export function App() {
  const [authMode, setAuthMode] = useState<AuthMode>('signup')
  const [view, setView] = useState<ViewState>('auth')
  const [transitionOrigin, setTransitionOrigin] =
    useState<TransitionOrigin | null>(null)

  const handleValidSubmit = useCallback(
    (origin: TransitionOrigin) => {
      if (view !== 'auth') return
      setTransitionOrigin(origin)
      setView('transitioning')
    },
    [view],
  )

  const handleTransitionComplete = useCallback(() => {
    setView('home')
  }, [])

  if (view === 'home') {
    return <HomePlaceholder />
  }

  return (
    <main className="app-shell">
      <div
        className={`journey-card ${view === 'transitioning' ? 'is-transitioning' : ''}`}
        data-testid="auth-journey"
      >
        <section className="auth-shell" aria-labelledby="auth-title">
          <AuthPanel
            key={authMode}
            mode={authMode}
            disabled={view === 'transitioning'}
            onModeChange={setAuthMode}
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
