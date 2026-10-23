import { useEffect } from 'react'
import './home.css'

export function HomePlaceholder() {
  useEffect(() => {
    document.body.classList.add('home-view')

    return () => document.body.classList.remove('home-view')
  }, [])

  return (
    <main className="home-placeholder">
      <div className="home-orbit" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
      <p className="home-brand">ELSEWHERE</p>
      <p className="home-kicker">WELCOME ABOARD</p>
      <h1>Your journey starts here.</h1>
      <p className="home-note">The next destination is yours to choose.</p>
    </main>
  )
}
