import { createFileRoute } from '@tanstack/react-router'
import { useMutation, useQuery } from 'convex/react'
import { useEffect, useState } from 'react'
import { api } from '../../convex/_generated/api'
import { WordCloud } from '../components/app/word-cloud'

export const Route = createFileRoute('/host')({ component: HostPage })

const runtimeApi = api as any
const HOST_KEY = 'wc_host'

type HostSession = {
  sessionId: string
  hostToken: string
  code: string
}

function HostPage() {
  const [hostError, setHostError] = useState('')
  const [hostSession, setHostSession] = useState<HostSession | null>(null)

  const createSession = useMutation(runtimeApi.sessions.createSession)

  useEffect(() => {
    let isMounted = true
    const bootSession = async () => {
      setHostError('')
      try {
        const next = await createSession({})
        if (!isMounted) {
          return
        }
        const host: HostSession = {
          sessionId: next.sessionId,
          hostToken: next.hostToken,
          code: next.code,
        }
        setHostSession(host)
        localStorage.setItem(HOST_KEY, JSON.stringify(host))
      } catch (error: any) {
        if (isMounted) {
          setHostError(error?.data ?? error?.message ?? 'Session create failed')
        }
      }
    }
    void bootSession()
    return () => {
      isMounted = false
    }
  }, [createSession])

  const snapshot = useQuery(
    runtimeApi.sessions.sessionSnapshot,
    hostSession?.code ? { code: hostSession.code } : 'skip',
  )

  return (
    <main className="app-shell host-shell">
      <div className="host-stage">
        <section className="host-pin-banner" aria-live="polite">
          <span className="host-pin-label">Session Code</span>
          <span className="host-pin-code">{hostSession?.code ?? '......'}</span>
        </section>

        <section className="host-canvas-shell" aria-label="Live word cloud canvas">
          <WordCloud
            words={snapshot?.words ?? []}
            blankWhenEmpty
            className="host-cloud-canvas"
            minSize={[1400, 800]}
          />
        </section>

        {hostError ? (
          <div className="host-error">
            <p className="error-text">{hostError}</p>
            <button
              className="button-accent"
              onClick={async () => {
                setHostError('')
                try {
                  const next = await createSession({})
                  const host: HostSession = {
                    sessionId: next.sessionId,
                    hostToken: next.hostToken,
                    code: next.code,
                  }
                  setHostSession(host)
                  localStorage.setItem(HOST_KEY, JSON.stringify(host))
                } catch (error: any) {
                  setHostError(error?.data ?? error?.message ?? 'Session create failed')
                }
              }}
            >
              Retry
            </button>
          </div>
        ) : null}
      </div>
    </main>
  )
}
