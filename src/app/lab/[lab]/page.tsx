import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getCatalog } from "@/lib/data";
import { fmtPerM, fmtTokens, fmtDate } from "@/lib/format";

export async function generateStaticParams() {
  const catalog = await getCatalog();
  return catalog.labs.map((l) => ({ lab: l.id }));
}

export async function generateMetadata({ params }: { params: Promise<{ lab: string }> }): Promise<Metadata> {
  const { lab } = await params;
  return { title: `${lab} models` };
}

export default async function LabPage({ params }: { params: Promise<{ lab: string }> }) {
  const { lab } = await params;
  const catalog = await getCatalog();
  const groups = catalog.groups.filter((g) => g.labId === lab);
  if (groups.length === 0) notFound();

  return (
    <div className="space-y-6">
      <nav className="text-sm text-zinc-500">
        <Link href="/browse" className="hover:text-zinc-300">
          Browse
        </Link>
        <span className="mx-1.5">/</span>
        <span className="text-zinc-300">{lab}</span>
      </nav>
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-50">{lab}</h1>
        <p className="text-sm text-zinc-500">{groups.length} canonical models tracked</p>
      </header>

      <div className="card overflow-x-auto">
        <table className="w-full min-w-[680px] text-sm">
          <thead>
            <tr className="border-b border-zinc-800 text-left text-xs uppercase tracking-wide text-zinc-500">
              <th className="px-4 py-3 font-medium">Model</th>
              <th className="px-4 py-3 font-medium text-right">Best in /M</th>
              <th className="px-4 py-3 font-medium text-right">Best out /M</th>
              <th className="px-4 py-3 font-medium text-right">Context</th>
              <th className="px-4 py-3 font-medium text-right">Providers</th>
              <th className="px-4 py-3 font-medium">Released</th>
            </tr>
          </thead>
          <tbody>
            {groups
              .sort((a, b) => (b.canonical?.releaseDate ?? "").localeCompare(a.canonical?.releaseDate ?? ""))
              .map((g) => (
                <tr key={g.id} className="border-b border-zinc-800/60 last:border-0 hover:bg-zinc-900/50">
                  <td className="px-4 py-3">
                    <Link href={`/m/${g.id}`} className="font-medium text-zinc-100 hover:text-emerald-400 transition-colors">
                      {g.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-right font-mono tabular-nums">{fmtPerM(g.best?.input ?? null)}</td>
                  <td className="px-4 py-3 text-right font-mono tabular-nums">{fmtPerM(g.best?.output ?? null)}</td>
                  <td className="px-4 py-3 text-right font-mono tabular-nums">{fmtTokens(g.canonical?.limit?.context ?? null)}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-zinc-400">{g.listings.length}</td>
                  <td className="px-4 py-3 text-xs text-zinc-500 whitespace-nowrap">{fmtDate(g.canonical?.releaseDate)}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
