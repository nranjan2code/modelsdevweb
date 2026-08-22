import type { Metadata } from "next";
import Link from "next/link";
import { getBenchmarkBoards } from "@/lib/data/benchmarks";
import { benchmarkHome } from "@/lib/data/benchmark-links";

export const metadata: Metadata = {
  title: "Benchmarks",
  description:
    "AI benchmark leaderboards paired with real prices — score per dollar across SWE-Bench, Terminal-Bench, ARC-AGI and more.",
  alternates: { canonical: "/benchmarks" },
};

export default async function BenchmarksPage() {
  const boards = await getBenchmarkBoards();
  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <p className="mono-label">Leaderboards</p>
        <h1 className="text-3xl font-bold tracking-tight text-black sm:text-4xl">Benchmark leaderboards</h1>
        <p className="max-w-2xl text-sm leading-relaxed text-black/60">
          {boards.length} benchmarks across {boards.reduce((n, b) => n + b.entries.length, 0)} scored entries —
          each leaderboard pairs scores with current best prices and links back to the official benchmark.
          Also available as{" "}
          <a href="/api/benchmarks.json" className="font-medium text-accent underline decoration-wavy underline-offset-4 hover:text-accent-strong">
            JSON
          </a>
          .
        </p>
      </header>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {boards.map((b) => {
          const home = benchmarkHome(b.name);
          return (
            <div key={b.slug} className="card lift relative p-4">
              <Link href={`/benchmarks/${b.slug}`} className="absolute inset-0 z-10" aria-label={`View ${b.name} leaderboard`}>
                <span className="sr-only">View {b.name}</span>
              </Link>
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0 truncate font-medium text-black">{b.name}</div>
                {home && (
                  <a
                    href={home}
                    target="_blank"
                    rel="noreferrer"
                    title={`Official ${b.name} benchmark`}
                    className="relative z-20 shrink-0 text-xs font-semibold text-accent transition-colors hover:text-accent-strong"
                  >
                    official ↗
                  </a>
                )}
              </div>
              <div className="mt-1 flex items-baseline justify-between text-xs text-black/45">
                <span>{b.entries.length} models scored</span>
                <span className="font-semibold text-accent">view →</span>
              </div>
              <div className="mt-2 truncate text-xs text-black/60">
                🥇 {b.entries[0]?.groupName} ({b.entries[0]?.score})
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}