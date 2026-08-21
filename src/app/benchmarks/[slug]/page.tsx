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
      <nav className="text-sm text-zinc-500">
        <Link href="/benchmarks" className="hover:text-zinc-300">
          Benchmarks
        </Link>
        <span className="mx-1.5">/</span>
        <span className="text-zinc-300">{board.name}</span>
      </nav>

      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-50">{board.name}</h1>
        <p className="text-sm text-zinc-500">
          {board.entries.length} models scored{board.metric ? ` · metric: ${board.metric}` : ""}. Prices are the
          cheapest listed across all serving providers.
        </p>
      </header>

      <div className="card overflow-x-auto">
        <table className="w-full min-w-[760px] text-sm">
          <thead>
            <tr className="border-b border-zinc-800 text-left text-xs uppercase tracking-wide text-zinc-500">
              <th className="px-4 py-3 font-medium">#</th>
              <th className="px-4 py-3 font-medium">Model</th>
              <th className="px-4 py-3 font-medium">Score</th>
              <th className="px-4 py-3 font-medium text-right">Best in /M</th>
              <th className="px-4 py-3 font-medium text-right">Best out /M</th>
              <th className="px-4 py-3 font-medium text-right">Context</th>
            </tr>
          </thead>
          <tbody>
            {board.entries.map((e, i) => {
              const ctx =
                catalog.groupById.get(e.groupId)?.canonical?.limit?.context ??
                catalog.groupById.get(e.groupId)?.listings[0]?.limit.context ??
                null;
              return (
                <tr key={e.groupId} className="border-b border-zinc-800/60 last:border-0 hover:bg-zinc-900/50">
                  <td className="px-4 py-2.5 tabular-nums text-zinc-500">{i + 1}</td>
                  <td className="px-4 py-2.5">
                    <Link href={`/m/${e.groupId}`} className="font-medium text-zinc-100 hover:text-emerald-400 transition-colors">
                      {e.groupName}
                    </Link>
                    <span className="ml-2 text-xs text-zinc-500">{e.labId}</span>
                  </td>
                  <td className="px-4 py-2.5 w-48">
                    <div className="flex items-center gap-2">
                      <span className="w-12 shrink-0 font-mono tabular-nums text-zinc-100">{e.score}</span>
                      <div className="h-1.5 flex-1 rounded bg-zinc-800 overflow-hidden">
                        <div
                          className={`h-full rounded ${i === 0 ? "bg-emerald-400" : "bg-emerald-500/50"}`}
                          style={{ width: `${Math.max(2, (e.score / maxScore) * 100)}%` }}
                        />
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono tabular-nums">
                    {e.bestInput != null ? fmtPerM(e.bestInput) : <span className="text-zinc-600">—</span>}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono tabular-nums">
                    {e.bestOutput != null ? fmtPerM(e.bestOutput) : <span className="text-zinc-600">—</span>}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono tabular-nums text-zinc-400">{fmtTokens(ctx)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {priced.length > 0 && (
        <p className="text-xs text-zinc-600">
          Cheapest scorer: <span className="text-zinc-400">{priced.reduce((a, b) => (b.bestInput! < a.bestInput!) ? b : a).groupName}</span>{" "}
          at {fmtPerM(priced.reduce((a, b) => (b.bestInput! < a.bestInput!) ? b : a).bestInput)} input /M.
        </p>
      )}
    </div>
  );
}
