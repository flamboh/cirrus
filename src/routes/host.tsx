import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery } from "convex/react";
import { useEffect, useState } from "react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { WordCloud } from "../components/app/word-cloud";

export const Route = createFileRoute("/host")({ component: HostPage });

const HOST_KEY = "wc_host";

type HostSession = {
  sessionId: Id<"sessions">;
  hostToken: string;
  code: string;
};

function HostPage() {
  const [hostError, setHostError] = useState("");
  const [hostSession, setHostSession] = useState<HostSession | null>(null);
  const [isEnding, setIsEnding] = useState(false);
  const navigate = useNavigate();

  const createSession = useMutation(api.sessions.createSession);
  const closeSession = useMutation(api.sessions.closeSession);
  const restoreHostSession = useMutation(api.sessions.restoreHostSession);

  const createSessionRecord = async () => {
    const next = await createSession({});
    return {
      sessionId: next.sessionId,
      hostToken: next.hostToken,
      code: next.code,
    };
  };

  useEffect(() => {
    let isMounted = true;
    const bootSession = async () => {
      setHostError("");
      const rawHost = localStorage.getItem(HOST_KEY);
      if (rawHost) {
        try {
          const parsed = JSON.parse(rawHost) as HostSession;
          const restored = await restoreHostSession({
            sessionId: parsed.sessionId,
            hostToken: parsed.hostToken,
          });
          if (restored.ok && isMounted) {
            setHostSession({
              sessionId: parsed.sessionId,
              hostToken: parsed.hostToken,
              code: restored.code,
            });
            localStorage.setItem(
              HOST_KEY,
              JSON.stringify({
                sessionId: parsed.sessionId,
                hostToken: parsed.hostToken,
                code: restored.code,
              }),
            );
            return;
          }
        } catch {
          localStorage.removeItem(HOST_KEY);
        }
        localStorage.removeItem(HOST_KEY);
      }

      try {
        const host = await createSessionRecord();
        if (!isMounted) {
          return;
        }
        setHostSession(host);
        localStorage.setItem(HOST_KEY, JSON.stringify(host));
      } catch (error: any) {
        if (isMounted) {
          setHostError(
            error?.data ?? error?.message ?? "Session create failed",
          );
        }
      }
    };
    void bootSession();
    return () => {
      isMounted = false;
    };
  }, [createSession, restoreHostSession]);

  const snapshot = useQuery(
    api.sessions.sessionSnapshot,
    hostSession?.code ? { code: hostSession.code } : "skip",
  );

  const endSession = async () => {
    if (!hostSession || isEnding) {
      return;
    }

    setIsEnding(true);
    setHostError("");
    try {
      await closeSession({
        sessionId: hostSession.sessionId,
        hostToken: hostSession.hostToken,
      });
      localStorage.removeItem(HOST_KEY);
      setHostSession(null);
      await navigate({ to: "/" });
    } catch (error: any) {
      setHostError(error?.data ?? error?.message ?? "Session end failed");
    } finally {
      setIsEnding(false);
    }
  };

  return (
    <main className="grid min-h-screen place-items-center p-4 sm:p-8">
      <div className="flex min-h-[calc(100vh-4rem)] w-full max-w-7xl flex-col gap-3">
        <section
          className="mx-auto grid w-full max-w-4xl place-items-center gap-1 rounded-xl border border-zinc-300 bg-zinc-100 px-4 py-3 text-zinc-900"
          aria-live="polite"
        >
          <span className="text-sm font-bold uppercase tracking-[0.07em]">
            Session Code
          </span>
          <span className="text-5xl font-extrabold leading-[0.9] tracking-[0.06em] sm:text-7xl">
            {hostSession?.code ?? "......"}
          </span>
          <span className="text-xl font-semibold">Join at cirrus.oli.boo</span>
        </section>

        <section className="min-h-0 flex-1" aria-label="Live word cloud canvas">
          <WordCloud
            words={snapshot?.words ?? []}
            blankWhenEmpty
            className="h-full min-h-0"
            minSize={[1400, 800]}
          />
        </section>

        <button
          className="mt-1 inline-flex h-10 w-fit self-center items-center justify-center rounded-xl border border-zinc-400 bg-zinc-200 px-4 text-sm font-bold text-zinc-900 transition hover:bg-zinc-300 disabled:cursor-not-allowed disabled:opacity-60 cursor-pointer"
          type="button"
          onClick={endSession}
          disabled={!hostSession || isEnding}
        >
          {isEnding ? "Ending..." : "End Session"}
        </button>

        {hostError ? (
          <div className="grid justify-items-center gap-2">
            <p className="text-sm font-bold text-rose-400">{hostError}</p>
            <button
              className="inline-flex h-10 items-center justify-center rounded-xl border border-emerald-500 bg-emerald-400 px-4 text-sm font-extrabold text-zinc-950 transition hover:bg-emerald-300"
              onClick={async () => {
                setHostError("");
                try {
                  const host = await createSessionRecord();
                  setHostSession(host);
                  localStorage.setItem(HOST_KEY, JSON.stringify(host));
                } catch (error: any) {
                  setHostError(
                    error?.data ?? error?.message ?? "Session create failed",
                  );
                }
              }}
            >
              Retry
            </button>
          </div>
        ) : null}
      </div>
    </main>
  );
}
