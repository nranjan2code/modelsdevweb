import type { Metadata } from "next";
import Link from "next/link";
import { getBenchmarkBoards } from "@/lib/data/benchmarks";
import { benchmarkHome } from "@/lib/data/benchmark-links";
import { labName } from "@/lib/data/brief";
import { PROVENANCE_LABEL } from "@/lib/data/provenance";
import { fmtPerM } from "@/lib/format";
import { Badge } from "@/components/ui";

export const metadata: Metadata = {
  title: "Benchmarks",
  description:
    "AI benchmark leaderboards paired with real prices — score per dollar across SWE-Bench, Terminal-Bench, ARC-AGI and more.",
  alternates: { canonical: "/benchmarks" },
};

function fmtScore(score: number): string {
  return score.toLocaleString("en-US", { maximumFractionDigits: 2 });
}

function fmtPointsPerDollar(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return value >= 100 ? Math.round(value).toLocaleString("en-US") : value.toFixed(1);
}

function fmtPricePair(input: number | null, output: number | null): string {
  if (input == null || output == null) return "—";
  return `${fmtPerM(input)}/${fmtPerM(output)} /M`;
}

function sourceHost(source: string | null): string | null {
  if (!source) return null;
  try {
    return new URL(source).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

export default async function BenchmarksPage() {
  const boards = await getBenchmarkBoards();
  return (
    <div className="space-y-6">
      <header className="page-intro page-intro-split">
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
      <div className="overflow-hidden rounded-lg border border-black/15 bg-surface">
        <div className="mono-label hidden grid-cols-12 gap-5 border-b border-black/15 bg-surface-tint px-5 py-3 lg:grid">
          <span className="col-span-4">Benchmark</span>
          <span className="col-span-3">Measured leader</span>
          <span className="col-span-2">Score</span>
          <span className="col-span-2">Current API price</span>
          <span className="text-right">Source</span>
        </div>
        <div className="divide-y divide-black/10">
        {boards.map((b) => {
          const home = benchmarkHome(b.name);
          const independentLeader = b.independent[0] ?? null;
          const result = independentLeader ?? b.entries[0] ?? null;
          const runnerUp = independentLeader ? b.independent[1] ?? null : null;
          const lead = independentLeader && runnerUp ? independentLeader.score - runnerUp.score : null;
          const host = sourceHost(result?.source ?? null);
          return (
            <article
              key={b.slug}
              className="grid gap-5 px-5 py-5 transition-colors hover:bg-accent-soft/40 sm:grid-cols-2 lg:grid-cols-12 lg:items-center"
            >
              <div className="min-w-0 sm:col-span-2 lg:col-span-4">
                <Link
                  href={`/benchmarks/${b.slug}`}
                  className="text-base font-bold text-black transition-colors hover:text-accent"
                >
                  {b.name} →
                </Link>
                <p className="mt-1.5 text-sm text-black/60">
                  {b.entries.length} scored · {b.independent.length} independently measured
                  {b.metric ? ` · ${b.metric}` : ""}
                </p>
              </div>

              <div className="min-w-0 lg:col-span-3">
                <p className="mono-label mb-1 lg:hidden">{independentLeader ? "Measured leader" : "Top reported"}</p>
                <div className="mb-1.5">
                  <Badge tone={independentLeader ? "pos" : "muted"}>
                    {independentLeader ? "Independent" : "No independent ranking"}
                  </Badge>
                </div>
                {result ? (
                  <>
                    <Link
                      href={`/m/${result.groupId}`}
                      className="block truncate font-semibold text-black transition-colors hover:text-accent"
                    >
                      {result.groupName}
                    </Link>
                    <p className="mt-1 truncate text-xs text-black/60">
                      {labName(result.labId)} · {PROVENANCE_LABEL[result.provenance]}
                      {host ? ` · ${host}` : ""}
                    </p>
                  </>
                ) : (
                  <span className="text-sm text-black/60">No scores published</span>
                )}
              </div>

              <div className="lg:col-span-2">
                <p className="mono-label mb-1 lg:hidden">Score</p>
                <p className="font-mono text-xl font-bold tabular-nums text-black">
                  {result ? fmtScore(result.score) : "—"}
                </p>
                <p className="mt-1 text-xs text-black/60">
                  {lead != null
                    ? `${lead > 0 ? "+" : ""}${fmtScore(lead)} vs. #2`
                    : independentLeader
                      ? "Only independent score"
                      : "Reported, not ranked"}
                </p>
              </div>

              <div className="lg:col-span-2">
                <p className="mono-label mb-1 lg:hidden">Current API price</p>
                <p className="font-mono text-sm font-semibold tabular-nums text-black">
                  {result ? fmtPricePair(result.bestInput, result.bestOutput) : "—"}
                </p>
                <p className="mt-1 text-xs text-black/60">
                  {result && result.pointsPerDollar != null
                    ? `${fmtPointsPerDollar(result.pointsPerDollar)} pts/$`
                    : "No published price"}
                </p>
              </div>

              <div className="flex items-center lg:justify-end">
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
    </div>
  );
}
