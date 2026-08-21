import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getCatalog, getProvider } from "@/lib/data";
import { fmtDate, fmtPerM, fmtTokens } from "@/lib/format";
import { StatusBadge } from "@/components/price-table";

export async function generateStaticParams() {
  const catalog = await getCatalog();
  return catalog.providers.map((p) => ({ id: p.id }));
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  return { title: `${id} — models & prices` };
}

export default async function ProviderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await getProvider(id);
  if (!data) notFound();
  const { provider, rows } = data;
  const live = rows.filter((r) => r.listing.status !== "deprecated").length;

  return (
    <div className="space-y-6">
      <nav className="text-sm text-zinc-500">
        <Link href="/browse" className="hover:text-zinc-300">
          Browse
        </Link>
        <span className="mx-1.5">/</span>
        <span className="text-zinc-300">{provider.name}</span>
      </nav>

      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-50">{provider.name}</h1>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-zinc-500">
          <span>{rows.length} listings ({live} live)</span>
          {provider.npm && <span className="font-mono">{provider.npm}</span>}
          {provider.env.length > 0 && (
            <span>
              auth: <span className="font-mono text-zinc-400">{provider.env.join(", ")}</span>
            </span>
          )}
          {provider.doc && (
            <a href={provider.doc} target="_blank" rel="noreferrer" className="text-emerald-400 hover:text-emerald-300">
              docs ↗
            </a>
          )}
        </div>
      </header>

      <div className="card overflow-x-auto">
        <table className="w-full min-w-[760px] text-sm">
          <thead>
            <tr className="border-b border-zinc-800 text-left text-xs uppercase tracking-wide text-zinc-500">
              <th className="px-4 py-3 font-medium">Model</th>
              <th className="px-4 py-3 font-medium text-right">Input /M</th>
              <th className="px-4 py-3 font-medium text-right">Output /M</th>
              <th className="px-4 py-3 font-medium text-right">Cache read /M</th>
              <th className="px-4 py-3 font-medium text-right">Context</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Updated</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ listing: l, groupId, groupName }) => (
              <tr key={l.key} className="border-b border-zinc-800/60 last:border-0 hover:bg-zinc-900/50">
                <td className="px-4 py-3">
                  <Link href={`/m/${groupId}`} className="font-medium text-zinc-100 hover:text-emerald-400 transition-colors">
                    {groupName}
                  </Link>
                  {l.modelId !== groupId && <span className="ml-2 text-xs text-zinc-500">{l.modelId}</span>}
                </td>
                <td className="px-4 py-3 text-right font-mono tabular-nums">{fmtPerM(l.cost.input)}</td>
                <td className="px-4 py-3 text-right font-mono tabular-nums">{fmtPerM(l.cost.output)}</td>
                <td className="px-4 py-3 text-right font-mono tabular-nums">{fmtPerM(l.cost.cacheRead)}</td>
                <td className="px-4 py-3 text-right font-mono tabular-nums">{fmtTokens(l.limit.context)}</td>
                <td className="px-4 py-3">
                  <StatusBadge status={l.status} />
                </td>
                <td className="px-4 py-3 text-xs text-zinc-500 whitespace-nowrap">{fmtDate(l.lastUpdated)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
