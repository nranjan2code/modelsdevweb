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
      <header className="page-intro">
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
      <div className="divide-y divide-black/10 border-y border-black/15">
        {boards.map((b) => {
          const home = benchmarkHome(b.name);
          return (
            <article key={b.slug} className="flex min-h-24 flex-col justify-center gap-2 py-4 sm:flex-row sm:items-center sm:gap-6">
              <div className="min-w-0 flex-1">
                <Link href={`/benchmarks/${b.slug}`} className="font-semibold text-black transition-colors hover:text-accent">
                  {b.name} →
                </Link>
                <p className="mt-1 text-sm text-black/60">
                  {b.entries.length} models scored · leader: {b.entries[0]?.groupName} ({b.entries[0]?.score})
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-4">
                {home && (
                  <a
                    href={home}
                    target="_blank"
                    rel="noreferrer"
                    title={`Official ${b.name} benchmark`}
                    className="inline-flex min-h-11 items-center text-sm font-semibold text-accent transition-colors hover:text-accent-strong"
                  >
                    official ↗
                  </a>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
