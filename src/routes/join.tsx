import { createFileRoute } from "@tanstack/react-router";
import { useMutation } from "convex/react";
import { useEffect, useState } from "react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";

export const Route = createFileRoute("/join")({ component: PlayPage });

const PLAYER_KEY = "wc_player";

type PlayerSession = {
  sessionId: Id<"sessions">;
  playerId: Id<"players">;
  playerToken: string;
  code: string;
  name: string;
};

function PlayPage() {
  const [joinCode, setJoinCode] = useState("");
  const [word, setWord] = useState("");
  const [playerError, setPlayerError] = useState("");
  const [message, setMessage] = useState("");
  const [playerSession, setPlayerSession] = useState<PlayerSession | null>(
    null,
  );

  const joinSession = useMutation(api.sessions.joinSession);
  const submitWord = useMutation(api.sessions.submitWord);
  const restorePlayerSession = useMutation(api.sessions.restorePlayerSession);

  useEffect(() => {
    let isMounted = true;
    const bootPlayer = async () => {
      const rawPlayer = localStorage.getItem(PLAYER_KEY);
      if (!rawPlayer) {
        return;
      }

      try {
        const parsed = JSON.parse(rawPlayer) as PlayerSession;
        const restored = await restorePlayerSession({
          sessionId: parsed.sessionId,
          playerId: parsed.playerId,
          playerToken: parsed.playerToken,
        });

        if (restored.ok && isMounted) {
          const next: PlayerSession = {
            sessionId: parsed.sessionId,
            playerId: parsed.playerId,
            playerToken: parsed.playerToken,
            code: restored.code,
            name: restored.name,
          };
          setPlayerSession(next);
          setJoinCode(restored.code);
          localStorage.setItem(PLAYER_KEY, JSON.stringify(next));
          return;
        }
      } catch {
        localStorage.removeItem(PLAYER_KEY);
      }

      localStorage.removeItem(PLAYER_KEY);
      if (isMounted) {
        setPlayerSession(null);
      }
    };

    void bootPlayer();
    return () => {
      isMounted = false;
    };
  }, [restorePlayerSession]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!playerSession) {
      return;
    }

    try {
      await submitWord({
        sessionId: playerSession.sessionId,
        playerId: playerSession.playerId,
        playerToken: playerSession.playerToken,
        word,
      });
      setWord("");
      setPlayerError("");
      setMessage("Word sent");
    } catch (error: any) {
      setPlayerError(error?.data ?? error?.message ?? "Submit failed");
    }
  };

  const leaveSession = () => {
    localStorage.removeItem(PLAYER_KEY);
    setPlayerSession(null);
    setWord("");
    setMessage("");
    setPlayerError("");
  };

  return (
    <main className="grid min-h-screen place-items-center p-4 sm:p-8">
      <div className="grid w-full max-w-xl gap-4">
        <header className="animate-rise-in grid justify-items-center gap-2 text-center">
          <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-zinc-400">
            Join Session
          </p>
          <h1 className="text-6xl font-extrabold uppercase leading-[0.88] tracking-tight sm:text-7xl">
            Cirrus
          </h1>
        </header>

        <article className="mx-auto grid w-full max-w-xl gap-3 rounded-2xl border border-zinc-700 bg-zinc-800 p-4 sm:p-5">
          {!playerSession ? (
            <>
              <h2 className="text-lg font-extrabold uppercase tracking-wide text-zinc-100">
                Enter Code
              </h2>
              <form
                className="grid gap-3"
                onSubmit={async (event) => {
                  event.preventDefault();
                  setPlayerError("");
                  setMessage("");

                  const generatedName = `Player ${Math.floor(1000 + Math.random() * 9000)}`;

                  try {
                    const joined = await joinSession({
                      code: joinCode,
                      name: generatedName,
                    });
                    const next: PlayerSession = {
                      sessionId: joined.sessionId,
                      playerId: joined.playerId,
                      playerToken: joined.playerToken,
                      code: joined.code,
                      name: generatedName,
                    };
                    setPlayerSession(next);
                    setJoinCode(next.code);
                    localStorage.setItem(PLAYER_KEY, JSON.stringify(next));
                    setMessage(`Joined ${next.code}`);
                  } catch (error: any) {
                    setPlayerError(
                      error?.data ?? error?.message ?? "Join failed",
                    );
                  }
                }}
              >
                <input
                  required
                  value={joinCode}
                  onChange={(event) =>
                    setJoinCode(event.target.value.toUpperCase())
                  }
                  placeholder="Session code"
                  maxLength={6}
                  className="h-11 w-full rounded-xl border border-zinc-600 bg-zinc-900 px-3 text-zinc-100 placeholder:text-zinc-500 focus-visible:outline focus-visible:outline-offset-1 focus-visible:outline-emerald-400 sm:w-auto"
                />
                <button
                  className="inline-flex h-11 items-center justify-center rounded-xl border border-emerald-500 bg-emerald-400 px-4 text-sm font-extrabold text-zinc-950 transition cursor-pointer hover:bg-emerald-300"
                  type="submit"
                >
                  Join
                </button>
              </form>
            </>
          ) : (
            <>
              <h2 className="text-lg font-extrabold uppercase tracking-wide text-zinc-100">
                Session {playerSession.code}
              </h2>
              <form className="grid gap-3" onSubmit={submit}>
                <input
                  required
                  value={word}
                  onChange={(event) => setWord(event.target.value)}
                  placeholder="Enter word"
                  maxLength={24}
                  className="h-11 w-full rounded-xl border border-zinc-600 bg-zinc-900 px-3 text-zinc-100 placeholder:text-zinc-500 focus-visible:outline focus-visible:outline-offset-1 focus-visible:outline-emerald-400 sm:w-auto"
                />
                <button
                  className="inline-flex h-11 items-center justify-center rounded-xl border border-emerald-500 bg-emerald-400 px-4 text-sm font-extrabold text-zinc-950 transition cursor-pointer hover:bg-emerald-300"
                  type="submit"
                >
                  Send
                </button>
                <button
                  className="inline-flex h-11 items-center justify-center rounded-xl border border-zinc-600 bg-zinc-900 px-4 text-sm font-bold text-zinc-100 transition hover:bg-zinc-700"
                  type="button"
                  onClick={leaveSession}
                >
                  Leave Session
                </button>
              </form>
            </>
          )}
          {message ? (
            <p className="mt-1 text-sm font-bold text-emerald-400">{message}</p>
          ) : null}
          {playerError ? (
            <p className="mt-1 text-sm font-bold text-rose-400">
              {playerError}
            </p>
          ) : null}
        </article>
      </div>
    </main>
  );
}
