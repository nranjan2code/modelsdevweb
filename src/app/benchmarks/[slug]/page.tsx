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
          cheapest listed across all serving providers.
        </p>
      </header>

      <div className="card overflow-x-auto">
        <table className="table-base min-w-[760px]">
          <thead>
            <tr>
              <th>#</th>
              <th>Model</th>
              <th>Score</th>
              <th className="text-right">Best in /M</th>
              <th className="text-right">Best out /M</th>
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
