import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getBenchmarkBoards, getBenchmarkBoard } from "@/lib/data/benchmarks";
import { benchmarkHome } from "@/lib/data/benchmark-links";
import { fmtPerM } from "@/lib/format";
import { getCatalog, groupContext } from "@/lib/data";
import { BenchmarkEntriesTable } from "@/components/catalog-tables";

export async function generateStaticParams() {
  const boards = await getBenchmarkBoards();
  return boards.map((b) => ({ slug: b.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const board = await getBenchmarkBoard(slug);
  return { title: board ? `${board.name} leaderboard` : "Benchmark" };
}

export default async function BenchmarkPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [board, catalog] = await Promise.all([getBenchmarkBoard(slug), getCatalog()]);
  if (!board) notFound();
  const maxScore = board.entries[0]?.score ?? 1;
  const priced = board.entries.filter((e) => e.bestInput != null);
  const home = benchmarkHome(board.name);
  const reportSources = [...new Set(board.entries.map((e) => e.source).filter((s): s is string => s != null))].slice(0, 6);
  const host = (u: string): string => {
    try {
      return new URL(u).hostname.replace(/^www\./, "");
    } catch {
      return u;
    }
  };
  const valueSorted = [...board.entries]
    .filter((e) => e.pointsPerDollar != null)
    .sort((a, b) => (b.pointsPerDollar ?? 0) - (a.pointsPerDollar ?? 0));
  const valueLeaders = valueSorted.slice(0, 5);
  const fmtPpd = (v: number | null): string => {
    if (v == null) return "—";
    if (!Number.isFinite(v)) return "free";
    return v >= 100 ? Math.round(v).toLocaleString("en-US") : v.toFixed(1);
  };

  return (
    <div className="space-y-6">
      <nav className="text-sm text-black/60">
        <Link href="/benchmarks" className="transition-colors hover:text-accent">
          Benchmarks
        </Link>
        <span className="mx-1.5">/</span>
        <span className="font-medium text-black">{board.name}</span>
      </nav>

      <header className="page-intro">
        <p className="mono-label">Leaderboard</p>
        <h1 className="text-3xl font-bold tracking-tight text-black sm:text-4xl">
          {board.name}
          {home && (
            <a
              href={home}
              target="_blank"
              rel="noreferrer"
              title={`Official ${board.name} benchmark`}
              className="ml-3 align-middle font-sans text-sm font-semibold text-accent hover:text-accent-strong"
            >
              official site ↗
            </a>
          )}
        </h1>
        <p className="max-w-2xl text-sm leading-relaxed text-black/60">
          {board.entries.length} models scored{board.metric ? ` · metric: ${board.metric}` : ""}. Prices are the
          cheapest listed across all serving providers. Cost/run and Pts/$ are priced for the{" "}
          <b className="font-semibold text-black">{board.workload.name.toLowerCase()}</b> token profile —{" "}
          {board.workload.description.toLowerCase()}
        </p>
        <p className="max-w-2xl text-xs leading-relaxed text-black/60">
          {board.calibrated ? (
            <>
              A benchmark is priced for the workload it exercises, not a fixed input:output blend: an
              agent loop and a single hard question bill very differently on the same rate card.
            </>
          ) : (
            <>
              This benchmark has not been calibrated to a token profile, so the figures use the site
              default. Treat the ordering as indicative rather than tuned to {board.name}.
            </>
          )}{" "}
          Profile: {compact(board.workload.inputTokens)} in · {compact(board.workload.outputTokens)} out
          {board.workload.reasoningTokens > 0 && <> · {compact(board.workload.reasoningTokens)} reasoning</>}
          {" · "}{Math.round(board.workload.cacheHitRate * 100)}% cache hit ·{" "}
          {compact(board.workload.contextTokens)} context.
        </p>
        <p className="max-w-2xl text-xs leading-relaxed text-black/60">
          Scores are facts as publicly reported by labs (see report links below and on each model page) and
          aggregated via models.dev. {board.name} is maintained by its own project — Model Pulse is not
          affiliated with or endorsed by it.
        </p>
      </header>

      {valueLeaders.length > 1 && (
        <section className="card-flat p-4">
          <div className="mono-label mb-3">
            Best value · top {valueLeaders.length} by pts per dollar · {board.workload.name.toLowerCase()} profile
          </div>
          <ol className="grid gap-x-6 gap-y-2 sm:grid-cols-2 lg:grid-cols-3">
            {valueLeaders.map((e, i) => (
              <li key={e.groupId} className="flex items-baseline justify-between gap-2 text-sm">
                <span className="truncate">
                  <span className="mr-1.5 tabular-nums text-black/60">{i + 1}.</span>
                  <Link href={`/m/${e.groupId}`} className="font-medium transition-colors hover:text-accent">
                    {e.groupName}
                  </Link>
                </span>
                <span className="shrink-0 font-mono font-semibold tabular-nums text-pos">
                  {fmtPpd(e.pointsPerDollar)}
                </span>
              </li>
            ))}
          </ol>
        </section>
      )}

      <BenchmarkEntriesTable maxScore={maxScore} rows={board.entries.map((entry) => ({ groupId: entry.groupId, groupName: entry.groupName, labId: entry.labId, score: entry.score, bestInput: entry.bestInput, bestOutput: entry.bestOutput, pointsPerDollar: entry.pointsPerDollar, costPerRun: entry.costPerRun, context: catalog.groupById.get(entry.groupId) ? groupContext(catalog.groupById.get(entry.groupId)!) : null }))} />

      {reportSources.length > 0 && (
        <p className="text-xs leading-relaxed text-black/60">
          Score reports:{" "}
          {reportSources.map((src, i) => (
            <span key={src}>
              {i > 0 && " · "}
              <a
                href={src}
                target="_blank"
                rel="noreferrer"
                className="font-medium text-accent underline decoration-wavy underline-offset-4 hover:text-accent-strong"
              >
                {host(src)}
              </a>
            </span>
          ))}
          {" "}— full source URLs are linked on each model page.
        </p>
      )}

      {priced.length > 0 && (
        <p className="text-xs leading-relaxed text-black/60">
          Cheapest scorer: <span className="font-medium text-black/70">{priced.reduce((a, b) => (b.bestInput! < a.bestInput!) ? b : a).groupName}</span>{" "}
          at {fmtPerM(priced.reduce((a, b) => (b.bestInput! < a.bestInput!) ? b : a).bestInput)} input /M.
        </p>
      )}
    </div>
  );
}

function compact(n: number): string {
  if (n >= 1_000_000) return `${Number((n / 1_000_000).toFixed(1))}M`;
  if (n >= 1_000) return `${Number((n / 1_000).toFixed(1))}k`;
  return String(n);
}
