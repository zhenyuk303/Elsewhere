import { useState } from 'react'
import { AuthPanel } from './features/auth/AuthPanel'
import type { AuthMode, TransitionOrigin } from './features/auth/types'

export function App() {
  const [authMode, setAuthMode] = useState<AuthMode>('signup')
  const [, setTransitionOrigin] = useState<TransitionOrigin | null>(null)

  return (
    <main className="app-shell">
      <div className="journey-card">
        <section className="auth-shell" aria-labelledby="auth-title">
          <AuthPanel
            key={authMode}
            mode={authMode}
            disabled={false}
            onModeChange={setAuthMode}
            onValidSubmit={setTransitionOrigin}
          />
        </section>
        <aside className="visual-placeholder" aria-label="Travel inspiration">
          <span>Barcelona</span>
        </aside>
      </div>
    </main>
  )
}
