import { createFileRoute, Link } from '@tanstack/react-router'

export const Route = createFileRoute('/')({ component: HomePage })

function HomePage() {
  return (
    <main className="app-shell">
      <div className="app-frame app-frame-home">
        <header className="hero">
          <h1>Cirrus</h1>
        </header>

        <div className="row row-center" aria-label="Primary flows">
          <Link className="button-accent" to="/host">
            Host
          </Link>
          <Link className="button-ghost" to="/play">
            Join
          </Link>
        </div>
      </div>
    </main>
  )
}
