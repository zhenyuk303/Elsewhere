import './home.css'

export function HomePlaceholder({ username, onLogout }: { username?: string; onLogout?: () => Promise<void> }) {
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
      {username ? <p className="home-note">Signed in as {username}</p> : null}
      {onLogout ? <button className="home-logout" onClick={onLogout}>Log out</button> : null}
    </main>
  )
}
