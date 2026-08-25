import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getCatalog, getProvider, type ProviderRow } from "@/lib/data";
import { ProviderListingsTable } from "@/components/catalog-tables";
import { Badge } from "@/components/ui";

export async function generateStaticParams() {
  const catalog = await getCatalog();
  return catalog.providers.map((p) => ({ id: p.id }));
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  return { title: `${id} — models & prices` };
}

const toTableRow = ({ listing, groupId, groupName }: ProviderRow) => ({
  key: listing.key,
  groupId,
  groupName,
  modelId: listing.modelId,
  input: listing.cost.input,
  output: listing.cost.output,
  cacheRead: listing.cost.cacheRead,
  cacheWrite: listing.cost.cacheWrite,
  context: listing.limit.context,
  status: listing.status ?? null,
  lastUpdated: listing.lastUpdated ?? null,
});

export default async function ProviderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await getProvider(id);
  if (!data) notFound();
  const { provider, rows } = data;

  // Withdrawn endpoints are kept off the price-sorted table entirely: mixed in,
  // a deprecated listing can head the list as this venue's cheapest offer.
  const live = rows.filter((r) => r.listing.status !== "deprecated");
  const retired = rows.filter((r) => r.listing.status === "deprecated");
  const migratable = retired.filter((r) => r.availableElsewhere).length;

  return (
    <div className="space-y-6">
      <nav className="text-sm text-black/60">
        <Link href="/browse" className="transition-colors hover:text-accent">
          Browse
        </Link>
        <span className="mx-1.5">/</span>
        <span className="font-medium text-black">{provider.name}</span>
      </nav>

      <header className="page-intro page-intro-split">
        <p className="mono-label">Provider</p>
        <h1 className="text-3xl font-bold tracking-tight text-black sm:text-4xl">{provider.name}</h1>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-black/60">
          <span>
            {live.length} live listing{live.length === 1 ? "" : "s"}
            {retired.length > 0 && <> · {retired.length} withdrawn</>}
          </span>
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

      <ProviderListingsTable rows={live.map(toTableRow)} />

      {retired.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <Badge tone="neg">Withdrawn</Badge>
            <h2 className="text-lg font-bold tracking-tight text-black">
              No longer served by {provider.name}
            </h2>
          </div>
          <p className="max-w-2xl text-sm leading-relaxed text-black/60">
            {migratable > 0 ? (
              <>
                {migratable} of these {migratable === 1 ? "is" : "are"} still available from another
                provider, so a pinned endpoint here can be re-pointed rather than replaced. Prices
                shown are the last published before withdrawal and are not purchasable.
              </>
            ) : (
              <>
                Prices shown are the last published before withdrawal and are not purchasable.
              </>
            )}
          </p>
          <ProviderListingsTable rows={retired.map(toTableRow)} />
        </section>
      )}
    </div>
  );
}
