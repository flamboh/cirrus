import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/")({ component: HomePage });

function HomePage() {
  return (
    <main className="grid min-h-screen place-items-center p-4 sm:p-8">
      <div className="grid w-full max-w-4xl gap-4">
        <header className="animate-rise-in grid justify-items-center gap-3 text-center">
          <h1 className="text-6xl font-extrabold  leading-[0.88] tracking-tight sm:text-8xl">
            Cirrus
          </h1>
          <p className="text-xl font-semibold">Word clouds for live opinions</p>
        </header>

        <div
          className="flex flex-wrap items-center justify-center gap-3"
          aria-label="Primary flows"
        >
          <Link
            className="inline-flex h-10 items-center justify-center rounded-xl border border-emerald-500 bg-emerald-400 px-5 text-sm font-extrabold text-zinc-950 transition hover:bg-emerald-300"
            to="/host"
          >
            Host
          </Link>
          <Link
            className="inline-flex h-10 items-center justify-center rounded-xl border border-zinc-700 bg-zinc-800 px-5 text-sm font-bold text-zinc-100 transition hover:bg-zinc-700"
            to="/join"
          >
            Join
          </Link>
        </div>
      </div>
    </main>
  );
}
