import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getBenchmarkBoards, getBenchmarkBoard } from "@/lib/data/benchmarks";
import { fmtPerM, fmtTokens } from "@/lib/format";
import { getCatalog } from "@/lib/data";

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
        <Link href="/benchmarks" className="transition-colors hover:text-blue-600">
          Benchmarks
        </Link>
        <span className="mx-1.5">/</span>
        <span className="font-medium text-black">{board.name}</span>
      </nav>

      <header className="space-y-2">
        <p className="mono-label">Leaderboard</p>
        <h1 className="text-3xl font-bold tracking-tight text-black sm:text-4xl">{board.name}</h1>
        <p className="max-w-2xl text-sm leading-relaxed text-black/55">
          {board.entries.length} models scored{board.metric ? ` · metric: ${board.metric}` : ""}. Prices are the
          cheapest listed across all serving providers. Pts/$ = score ÷ blended price (3×input + output) / 4 —
          how much score each dollar buys.
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
                  <Link href={`/m/${e.groupId}`} className="font-medium transition-colors hover:text-blue-600">
                    {e.groupName}
                  </Link>
                </span>
                <span className="shrink-0 font-mono font-semibold tabular-nums text-emerald-700">
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
              const ctx =
                catalog.groupById.get(e.groupId)?.canonical?.limit?.context ??
                catalog.groupById.get(e.groupId)?.listings[0]?.limit.context ??
                null;
              return (
                <tr key={e.groupId}>
                  <td className="tabular-nums text-black/40">{i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : i + 1}</td>
                  <td>
                    <Link href={`/m/${e.groupId}`} className="font-medium text-black transition-colors hover:text-blue-600">
                      {e.groupName}
                    </Link>
                    <span className="ml-2 text-xs text-black/45">{e.labId}</span>
                  </td>
                  <td className="w-48">
                    <div className="flex items-center gap-2">
                      <span className="w-12 shrink-0 font-mono font-semibold tabular-nums text-black">{e.score}</span>
                      <div className="h-2 flex-1 overflow-hidden rounded-sm border border-black bg-white">
                        <div
                          className={`h-full ${i === 0 ? "bg-blue-600" : "bg-blue-600/50"}`}
                          style={{ width: `${Math.max(2, (e.score / maxScore) * 100)}%` }}
                        />
                      </div>
                    </div>
                  </td>
                  <td className="text-right font-mono tabular-nums">
                    {e.bestInput != null ? fmtPerM(e.bestInput) : <span className="text-black/30">—</span>}
                  </td>
                  <td className="text-right font-mono tabular-nums">
                    {e.bestOutput != null ? fmtPerM(e.bestOutput) : <span className="text-black/30">—</span>}
                  </td>
                  <td className="text-right font-mono font-semibold tabular-nums text-emerald-700">
                    {fmtPpd(e.pointsPerDollar)}
                  </td>
                  <td className="text-right font-mono tabular-nums text-black/55">{fmtTokens(ctx)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {priced.length > 0 && (
        <p className="text-xs leading-relaxed text-black/45">
          Cheapest scorer: <span className="font-medium text-black/70">{priced.reduce((a, b) => (b.bestInput! < a.bestInput!) ? b : a).groupName}</span>{" "}
          at {fmtPerM(priced.reduce((a, b) => (b.bestInput! < a.bestInput!) ? b : a).bestInput)} input /M.
        </p>
      )}
    </div>
  );
}
