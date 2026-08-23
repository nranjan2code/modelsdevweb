import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getCatalog, getProvider } from "@/lib/data";
import { ProviderListingsTable } from "@/components/catalog-tables";

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
      <nav className="text-sm text-black/60">
        <Link href="/browse" className="transition-colors hover:text-accent">
          Browse
        </Link>
        <span className="mx-1.5">/</span>
        <span className="font-medium text-black">{provider.name}</span>
      </nav>

      <header className="page-intro">
        <p className="mono-label">Provider</p>
        <h1 className="text-3xl font-bold tracking-tight text-black sm:text-4xl">{provider.name}</h1>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-black/60">
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
              className="font-medium text-accent underline decoration-wavy underline-offset-4 hover:text-accent-strong"
            >
              docs ↗
            </a>
          )}
        </div>
      </header>

      <ProviderListingsTable rows={rows.map(({ listing, groupId, groupName }) => ({ key: listing.key, groupId, groupName, modelId: listing.modelId, input: listing.cost.input, output: listing.cost.output, cacheRead: listing.cost.cacheRead, cacheWrite: listing.cost.cacheWrite, context: listing.limit.context, status: listing.status ?? null, lastUpdated: listing.lastUpdated ?? null }))} />
    </div>
  );
}
