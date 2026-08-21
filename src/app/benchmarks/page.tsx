import type { Metadata } from "next";
import Link from "next/link";
import { getBenchmarkBoards } from "@/lib/data/benchmarks";

export const metadata: Metadata = {
  title: "Benchmarks",
  description: "AI benchmark leaderboards paired with real prices — score per dollar across SWE-Bench, Terminal-Bench, ARC-AGI and more.",
  alternates: { canonical: "/benchmarks" },
};

export default async function BenchmarksPage() {
  const boards = await getBenchmarkBoards();
  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <p className="mono-label">Leaderboards</p>
        <h1 className="text-3xl font-bold tracking-tight text-black sm:text-4xl">Benchmark leaderboards</h1>
        <p className="max-w-2xl text-sm leading-relaxed text-black/55">
          {boards.length} benchmarks across {boards.reduce((n, b) => n + b.entries.length, 0)} scored entries —
          each leaderboard pairs scores with current best prices. Also available as{" "}
          <a href="/api/benchmarks.json" className="font-medium text-blue-600 underline decoration-wavy underline-offset-4 hover:text-blue-700">
            JSON
          </a>
          .
        </p>
      </header>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {boards.map((b) => (
          <Link key={b.slug} href={`/benchmarks/${b.slug}`} className="card lift p-4">
            <div className="font-medium text-black">{b.name}</div>
            <div className="mt-1 flex items-baseline justify-between text-xs text-black/45">
              <span>{b.entries.length} models scored</span>
              <span className="font-semibold text-blue-600">view →</span>
            </div>
            <div className="mt-2 truncate text-xs text-black/55">
              🥇 {b.entries[0]?.groupName} ({b.entries[0]?.score})
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
