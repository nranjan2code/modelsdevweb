import type { Metadata } from "next";
import Link from "next/link";
import { getBenchmarkBoards } from "@/lib/data/benchmarks";

export const metadata: Metadata = { title: "Benchmarks" };

export default async function BenchmarksPage() {
  const boards = await getBenchmarkBoards();
  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-50">Benchmark leaderboards</h1>
        <p className="text-sm text-zinc-500">
          {boards.length} benchmarks across {boards.reduce((n, b) => n + b.entries.length, 0)} scored entries —
          each leaderboard pairs scores with current best prices. Also available as{" "}
          <a href="/api/benchmarks.json" className="text-emerald-400 hover:text-emerald-300">
            JSON
          </a>
          .
        </p>
      </header>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {boards.map((b) => (
          <Link
            key={b.slug}
            href={`/benchmarks/${b.slug}`}
            className="card p-4 hover:border-emerald-700/60 transition-colors"
          >
            <div className="font-medium text-zinc-100">{b.name}</div>
            <div className="mt-1 flex items-baseline justify-between text-xs text-zinc-500">
              <span>{b.entries.length} models scored</span>
              <span className="text-emerald-400">view →</span>
            </div>
            <div className="mt-2 truncate text-xs text-zinc-400">
              #1 {b.entries[0]?.groupName} ({b.entries[0]?.score})
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
