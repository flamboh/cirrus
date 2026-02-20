import { createFileRoute } from '@tanstack/react-router'
import { useMutation } from 'convex/react'
import { useEffect, useState } from 'react'
import { api } from '../../convex/_generated/api'

export const Route = createFileRoute('/play')({ component: PlayPage })

const runtimeApi = api as any
const PLAYER_KEY = 'wc_player'

type PlayerSession = {
  sessionId: string
  playerId: string
  playerToken: string
  code: string
  name: string
}

function PlayPage() {
  const [joinCode, setJoinCode] = useState('')
  const [word, setWord] = useState('')
  const [playerError, setPlayerError] = useState('')
  const [message, setMessage] = useState('')
  const [playerSession, setPlayerSession] = useState<PlayerSession | null>(null)

  const joinSession = useMutation(runtimeApi.sessions.joinSession)
  const submitWord = useMutation(runtimeApi.sessions.submitWord)

  useEffect(() => {
    const rawPlayer = localStorage.getItem(PLAYER_KEY)
    if (!rawPlayer) {
      return
    }

    try {
      const parsed = JSON.parse(rawPlayer) as PlayerSession
      setPlayerSession(parsed)
      setJoinCode(parsed.code)
    } catch {
      localStorage.removeItem(PLAYER_KEY)
    }
  }, [])

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!playerSession) {
      return
    }

    try {
      await submitWord({
        sessionId: playerSession.sessionId,
        playerId: playerSession.playerId,
        playerToken: playerSession.playerToken,
        word,
      })
      setWord('')
      setPlayerError('')
      setMessage('Word sent')
    } catch (error: any) {
      setPlayerError(error?.data ?? error?.message ?? 'Submit failed')
    }
  }

  return (
    <main className="app-shell">
      <div className="app-frame app-frame-player">
        <header className="hero">
          <p className="hero-kicker">Join Session</p>
          <h1>Cirrus</h1>
        </header>

        <article className="panel player-panel player-panel-single">
          {!playerSession ? (
            <>
              <h2>Enter Code</h2>
              <form
                className="stack"
                onSubmit={async (event) => {
                  event.preventDefault()
                  setPlayerError('')
                  setMessage('')

                  const generatedName = `Player ${Math.floor(1000 + Math.random() * 9000)}`

                  try {
                    const joined = await joinSession({
                      code: joinCode,
                      name: generatedName,
                    })
                    const next: PlayerSession = {
                      sessionId: joined.sessionId,
                      playerId: joined.playerId,
                      playerToken: joined.playerToken,
                      code: joined.code,
                      name: generatedName,
                    }
                    setPlayerSession(next)
                    setJoinCode(next.code)
                    localStorage.setItem(PLAYER_KEY, JSON.stringify(next))
                    setMessage(`Joined ${next.code}`)
                  } catch (error: any) {
                    setPlayerError(error?.data ?? error?.message ?? 'Join failed')
                  }
                }}
              >
                <input
                  required
                  value={joinCode}
                  onChange={(event) => setJoinCode(event.target.value.toUpperCase())}
                  placeholder="Session code"
                  maxLength={6}
                />
                <button className="button-accent" type="submit">
                  Join
                </button>
              </form>
            </>
          ) : (
            <>
              <h2>Session {playerSession.code}</h2>
              <form className="stack" onSubmit={submit}>
                <input
                  required
                  value={word}
                  onChange={(event) => setWord(event.target.value)}
                  placeholder="Enter word"
                  maxLength={24}
                />
                <button className="button-accent" type="submit">
                  Send
                </button>
              </form>
            </>
          )}
          {message ? <p className="success-text">{message}</p> : null}
          {playerError ? <p className="error-text">{playerError}</p> : null}
        </article>
      </div>
    </main>
  )
}
