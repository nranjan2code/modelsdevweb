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
      <nav className="text-sm text-black/45">
        <Link href="/browse" className="transition-colors hover:text-blue-600">
          Browse
        </Link>
        <span className="mx-1.5">/</span>
        <span className="font-medium text-black">{provider.name}</span>
      </nav>

      <header className="space-y-2">
        <p className="mono-label">Provider</p>
        <h1 className="text-3xl font-bold tracking-tight text-black sm:text-4xl">{provider.name}</h1>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-black/50">
          <span>{rows.length} listings ({live} live)</span>
          {provider.npm && <span className="font-mono">{provider.npm}</span>}
          {provider.env.length > 0 && (
            <span>
              auth: <span className="font-mono text-black/70">{provider.env.join(", ")}</span>
            </span>
          )}
          {provider.doc && (
            <a
              href={provider.doc}
              target="_blank"
              rel="noreferrer"
              className="font-medium text-blue-600 underline decoration-wavy underline-offset-4 hover:text-blue-700"
            >
              docs ↗
            </a>
          )}
        </div>
      </header>

      <div className="card overflow-x-auto">
          <table className="table-base min-w-[880px]">
            <thead>
              <tr>
                <th>Model</th>
                <th className="text-right">Input /M</th>
                <th className="text-right">Output /M</th>
                <th className="text-right">Cache read /M</th>
                <th className="text-right">Cache write /M</th>
                <th className="text-right">Context</th>
                <th>Status</th>
                <th>Updated</th>
              </tr>
            </thead>
          <tbody>
            {rows.map(({ listing: l, groupId, groupName }) => (
              <tr key={l.key}>
                <td>
                  <Link href={`/m/${groupId}`} className="font-medium text-black transition-colors hover:text-blue-600">
                    {groupName}
                  </Link>
                  {l.modelId !== groupId && <span className="ml-2 font-mono text-xs text-black/45">{l.modelId}</span>}
                </td>
                <td className="text-right font-mono tabular-nums">{fmtPerM(l.cost.input)}</td>
                <td className="text-right font-mono tabular-nums">{fmtPerM(l.cost.output)}</td>
                <td className="text-right font-mono tabular-nums">{fmtPerM(l.cost.cacheRead)}</td>
                <td className="text-right font-mono tabular-nums">{fmtPerM(l.cost.cacheWrite)}</td>
                <td className="text-right font-mono tabular-nums">{fmtTokens(l.limit.context)}</td>
                <td>
                  <StatusBadge status={l.status} />
                </td>
                <td className="whitespace-nowrap text-xs text-black/45">{fmtDate(l.lastUpdated)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
