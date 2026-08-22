import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getBenchmarkBoards, getBenchmarkBoard } from "@/lib/data/benchmarks";
import { benchmarkHome } from "@/lib/data/benchmark-links";
import { fmtPerM, fmtTokens } from "@/lib/format";
import { getCatalog, groupContext } from "@/lib/data";
import { Bar } from "@/components/ui";

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
      <nav className="text-sm text-black/45">
        <Link href="/benchmarks" className="transition-colors hover:text-accent">
          Benchmarks
        </Link>
        <span className="mx-1.5">/</span>
        <span className="font-medium text-black">{board.name}</span>
      </nav>

      <header className="space-y-2">
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
          cheapest listed across all serving providers. Pts/$ = score ÷ blended price (3×input + output) / 4 —
          how much score each dollar buys.
        </p>
        <p className="max-w-2xl text-xs leading-relaxed text-black/45">
          Scores are facts as publicly reported by labs (see report links below and on each model page) and
          aggregated via models.dev. {board.name} is maintained by its own project — Model Pulse is not
          affiliated with or endorsed by it.
        </p>
      </header>

      {valueLeaders.length > 1 && (
        <section className="card-flat p-4">
          <div className="mono-label mb-3">Best value · top {valueLeaders.length} by pts per dollar</div>
          <ol className="grid gap-x-6 gap-y-2 sm:grid-cols-2 lg:grid-cols-3">
            {valueLeaders.map((e, i) => (
              <li key={e.groupId} className="flex items-baseline justify-between gap-2 text-sm">
                <span className="truncate">
                  <span className="mr-1.5 tabular-nums text-black/35">{i + 1}.</span>
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

      <div className="card overflow-x-auto">
        <table className="table-base min-w-[880px]">
          <thead>
            <tr>
              <th>#</th>
              <th>Model</th>
              <th>Score</th>
              <th className="text-right">Best in /M</th>
              <th className="text-right">Best out /M</th>
              <th className="text-right">Pts / $</th>
              <th className="text-right">Context</th>
            </tr>
          </thead>
          <tbody>
            {board.entries.map((e, i) => {
              const ctx = catalog.groupById.get(e.groupId)
                ? groupContext(catalog.groupById.get(e.groupId)!)
                : null;
              return (
                <tr key={e.groupId}>
                  <td className="tabular-nums text-black/45">{i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : i + 1}</td>
                  <td>
                    <Link href={`/m/${e.groupId}`} className="font-medium text-black transition-colors hover:text-accent">
                      {e.groupName}
                    </Link>
                    <span className="ml-2 text-xs text-black/45">{e.labId}</span>
                  </td>
                  <td className="w-48">
                    <div className="flex items-center gap-2">
                      <span className="w-12 shrink-0 font-mono font-semibold tabular-nums text-black">{e.score}</span>
                      <Bar pct={e.score / maxScore} fill={i === 0 ? "bg-accent" : "bg-accent/50"} />
                    </div>
                  </td>
                  <td className="text-right font-mono tabular-nums">
                    {e.bestInput != null ? fmtPerM(e.bestInput) : <span className="text-black/35">—</span>}
                  </td>
                  <td className="text-right font-mono tabular-nums">
                    {e.bestOutput != null ? fmtPerM(e.bestOutput) : <span className="text-black/35">—</span>}
                  </td>
                  <td className="text-right font-mono font-semibold tabular-nums text-pos">
                    {fmtPpd(e.pointsPerDollar)}
                  </td>
                  <td className="text-right font-mono tabular-nums text-black/60">{fmtTokens(ctx)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {reportSources.length > 0 && (
        <p className="text-xs leading-relaxed text-black/45">
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
        <p className="text-xs leading-relaxed text-black/45">
          Cheapest scorer: <span className="font-medium text-black/70">{priced.reduce((a, b) => (b.bestInput! < a.bestInput!) ? b : a).groupName}</span>{" "}
          at {fmtPerM(priced.reduce((a, b) => (b.bestInput! < a.bestInput!) ? b : a).bestInput)} input /M.
        </p>
      )}
    </div>
  );
}
