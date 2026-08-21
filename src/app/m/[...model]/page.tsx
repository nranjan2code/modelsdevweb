import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { existsSync } from "node:fs";
import path from "node:path";
import { getModel, getCatalog, getEvents, getNews } from "@/lib/data";
import { SITE_URL } from "@/lib/site";
import { getPriceHistory } from "@/lib/data/history";
import { slugify } from "@/lib/data/benchmarks";
import { benchmarkHome } from "@/lib/data/benchmark-links";
import { PriceTable } from "@/components/price-table";
import { PriceHistory } from "@/components/price-history";
import { EventTypeBadge, changeText } from "@/components/event-card";
import { StatusBadge } from "@/components/price-table";
import { CopyField } from "@/components/copy-field";
import { JsonLd } from "@/components/jsonld";
import { fmtDate, fmtPerM, fmtTokens, fmtAgo } from "@/lib/format";

export async function generateStaticParams() {
  const catalog = await getCatalog();
  return catalog.groups.map((g) => ({ model: g.id.split("/") }));
}

export async function generateMetadata({ params }: { params: Promise<{ model: string[] }> }): Promise<Metadata> {
  const { model } = await params;
  const group = await getModel(model.join("/"));
  if (!group) return { title: "Model not found" };
  const ogPath = `/og/m/${group.id}.png`;
  const hasOg = existsSync(path.join(process.cwd(), "public", ogPath));
  const description =
    `${group.name} pricing across ${group.listings.length} providers` +
    (group.best
      ? ` — from ${fmtPerM(group.best.input)} input / ${fmtPerM(group.best.output)} per 1M tokens at its cheapest listed provider.`
      : ".") +
    (group.canonical?.limit?.context ? ` ${Math.round(group.canonical.limit.context / 1000)}K token context window.` : "");
  return {
    title: `${group.name} — prices across ${group.listings.length} providers`,
    description,
    alternates: { canonical: `/m/${group.id}` },
    openGraph: {
      images: [`${SITE_URL}${hasOg ? ogPath : "/og/site.png"}`],
    },
    twitter: { card: "summary_large_image" },
  };
}

export default async function ModelPage({ params }: { params: Promise<{ model: string[] }> }) {
  const { model } = await params;
  const id = model.join("/");
  const group = await getModel(id);
  if (!group) notFound();
  const c = group.canonical;
  const history = await getPriceHistory(id);
  const [events, news] = await Promise.all([getEvents(), getNews()]);
  const modelEvents = events.filter((e) => e.canonicalId === id).slice(0, 6);
  const modelNews = news.filter((n) => n.modelIds.includes(id)).slice(0, 4);
  const liveListings = group.listings.filter((l) => l.status !== "deprecated");
  const statuses = [...new Set(liveListings.map((l) => l.status).filter((s): s is "alpha" | "beta" => s != null))];
  const experimental = liveListings.some((l) => l.experimental);

  const pricedOffers = liveListings
    .filter((l) => l.cost.input != null)
    .sort((a, b) => (a.cost.input ?? Infinity) - (b.cost.input ?? Infinity));
  const jsonLd: object[] = [
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Browse", item: `${SITE_URL}/browse` },
        { "@type": "ListItem", position: 2, name: group.labId, item: `${SITE_URL}/lab/${group.labId}` },
        { "@type": "ListItem", position: 3, name: group.name, item: `${SITE_URL}/m/${group.id}` },
      ],
    },
    {
      "@context": "https://schema.org",
      "@type": "Product",
      name: group.name,
      description:
        c?.description ??
        `AI model pricing comparison across ${group.listings.length} inference providers. Prices are USD per 1M tokens.`,
      category: "AI language model",
      ...(c?.releaseDate ? { releaseDate: c.releaseDate } : {}),
      brand: { "@type": "Brand", name: group.labId },
      offers: {
        "@type": "AggregateOffer",
        priceCurrency: "USD",
        ...(group.best ? { lowPrice: group.best.input } : {}),
        highPrice: pricedOffers[pricedOffers.length - 1]?.cost.input ?? undefined,
        offerCount: pricedOffers.length,
        offers: pricedOffers.slice(0, 12).map((l) => ({
          "@type": "Offer",
          name: `Input tokens via ${l.providerName}`,
          price: l.cost.input,
          priceCurrency: "USD",
          availability: "https://schema.org/InStock",
          url: `${SITE_URL}/provider/${l.providerId}`,
          seller: { "@type": "Organization", name: l.providerName },
        })),
      },
    },
  ];

  return (
    <div className="space-y-8">
      {jsonLd.map((data, i) => (
        <JsonLd key={i} data={data} />
      ))}
      <nav className="text-sm text-black/45">
        <Link href="/browse" className="transition-colors hover:text-blue-600">
          Browse
        </Link>
        <span className="mx-1.5">/</span>
        <Link href={`/lab/${group.labId}`} className="transition-colors hover:text-blue-600">
          {group.labId}
        </Link>
      </nav>

      <header className="space-y-2">
        <p className="mono-label">Model</p>
        <h1 className="text-3xl font-bold tracking-tight text-black sm:text-4xl">{group.name}</h1>
        {c?.description && <p className="max-w-3xl leading-relaxed text-black/60">{c.description}</p>}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-black/50">
          <span>{group.listings.length} providers</span>
          {c?.releaseDate && (
            <span>
              released <time dateTime={c.releaseDate}>{fmtDate(c.releaseDate)}</time>
            </span>
          )}
          {c?.knowledge && <span>knowledge cutoff {c.knowledge}</span>}
          {c?.openWeights != null && (
            <span
              className={
                c.openWeights
                  ? "rounded-full border border-emerald-600/30 bg-emerald-50 px-2 py-0.5 font-medium text-emerald-700"
                  : "rounded-full border border-black/10 bg-black/[0.03] px-2 py-0.5 text-black/45"
              }
            >
              {c.openWeights ? "open weights" : "closed weights"}
            </span>
          )}
          {statuses.map((s) => (
            <StatusBadge key={s} status={s} />
          ))}
          {experimental && (
            <span className="rounded-full border border-purple-600/30 bg-purple-50 px-2 py-0.5 font-medium text-purple-700">
              experimental
            </span>
          )}
        </div>
      </header>

      {group.best && (
        <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="card px-4 py-3">
            <div className="font-mono text-lg font-bold tabular-nums text-blue-700">{fmtPerM(group.best.input)}</div>
            <div className="mono-label mt-0.5">best input /M · {group.best.providerName}</div>
          </div>
          <div className="card px-4 py-3">
            <div className="font-mono text-lg font-bold tabular-nums text-blue-700">{fmtPerM(group.best.output)}</div>
            <div className="mono-label mt-0.5">best output /M</div>
          </div>
          <div className="card-flat px-4 py-3">
            <div className="font-mono text-lg font-bold tabular-nums text-black">
              {fmtTokens(c?.limit?.context ?? Math.max(...group.listings.map((l) => l.limit.context ?? 0)))}
            </div>
            <div className="mono-label mt-0.5">context window</div>
          </div>
          <div className="card-flat px-4 py-3">
            <div className="font-mono text-lg font-bold tabular-nums text-black">
              {fmtTokens(c?.limit?.output ?? Math.max(...group.listings.map((l) => l.limit.output ?? 0)))}
            </div>
            <div className="mono-label mt-0.5">max output</div>
          </div>
        </section>
      )}

      <section className="space-y-4">
        <h2 className="font-hand text-3xl font-bold tracking-tight text-black">
          Compare providers{" "}
          <span className="align-middle font-sans text-sm font-normal text-black/45">
            (sorted by listed input price)
          </span>
        </h2>
        <PriceTable listings={group.listings} />
      </section>

      <PriceHistory points={history} />

      {group.best && (
        <section className="space-y-3">
          <h2 className="font-hand text-3xl font-bold tracking-tight text-black">Price badge</h2>
          <div className="card-flat space-y-3 p-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`/badge/${group.id}.svg`} alt={`Current price badge for ${group.name}`} className="h-5 w-auto" />
            <CopyField label="markdown" value={`![${group.name} price](${SITE_URL}/badge/${group.id}.svg)`} />
            <CopyField label="url" value={`${SITE_URL}/badge/${group.id}.svg`} />
            <p className="text-xs leading-relaxed text-black/45">
              Live SVG, regenerated on every hourly sync — paste it into a README to always show the current
              cheapest listed price. Updates when prices change; no build step needed on your side.
            </p>
          </div>
        </section>
      )}

      {(modelEvents.length > 0 || modelNews.length > 0) && (
        <section className="grid gap-6 md:grid-cols-2">
          {modelEvents.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-4">
                <h2 className="font-hand text-3xl font-bold tracking-tight text-black">Recent changes</h2>
                <Link
                  href="/changelog"
                  className="shrink-0 rounded-full border border-black/15 bg-white px-3 py-1 text-xs font-medium text-black/60 transition-colors hover:border-black hover:text-black"
                >
                  Changelog →
                </Link>
              </div>
              <ul className="space-y-2">
                {modelEvents.map((e) => (
                  <li key={e.id} className="card-flat flex flex-col gap-1 p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <EventTypeBadge type={e.type} />
                      <span className="text-xs text-black/45">
                        {e.providerId ? `via ${e.providerId} · ` : ""}
                        {fmtDate(e.date)}
                      </span>
                    </div>
                    {e.changes.length > 0 && (
                      <ul className="space-y-0.5 font-mono text-xs text-black/60">
                        {e.changes.slice(0, 4).map((ch, i) => (
                          <li key={i}>{changeText(ch)}</li>
                        ))}
                        {e.changes.length > 4 && <li>+{e.changes.length - 4} more</li>}
                      </ul>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {modelNews.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-4">
                <h2 className="font-hand text-3xl font-bold tracking-tight text-black">In the news</h2>
                <Link
                  href="/news"
                  className="shrink-0 rounded-full border border-black/15 bg-white px-3 py-1 text-xs font-medium text-black/60 transition-colors hover:border-black hover:text-black"
                >
                  All news →
                </Link>
              </div>
              <ul className="card divide-y divide-black/10">
                {modelNews.map((n) => (
                  <li key={n.id} className="px-4 py-2.5">
                    <a
                      href={n.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm font-medium leading-snug text-black transition-colors hover:text-blue-600"
                    >
                      {n.title}
                    </a>
                    <div className="mt-0.5 flex items-center gap-1.5 text-xs text-black/45">
                      {n.favicon && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={n.favicon} alt="" width={12} height={12} className="h-3 w-3 rounded-sm" />
                      )}
                      <span className="truncate">{n.source}</span>
                      {n.publishedAt && <span className="shrink-0">· {fmtAgo(n.publishedAt)}</span>}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}

      {(c?.benchmarks.length || c?.weights.length) ? (
        <section className="grid gap-6 md:grid-cols-2">
          {c.benchmarks.length > 0 && (
            <div className="space-y-4">
              <h2 className="font-hand text-3xl font-bold tracking-tight text-black">Benchmarks</h2>
              <ul className="card divide-y divide-black/10 text-sm">
                {c.benchmarks.map((b, i) => {
                  const home = benchmarkHome(b.name);
                  return (
                    <li key={i} className="flex items-center justify-between gap-2 px-4 py-2.5">
                      <span className="min-w-0">
                        {home ? (
                          <a
                            href={home}
                            target="_blank"
                            rel="noreferrer"
                            title={`Official ${b.name} benchmark`}
                            className="font-medium underline decoration-wavy decoration-black/25 underline-offset-4 transition-colors hover:text-blue-600 hover:decoration-blue-600"
                          >
                            {b.name} ↗
                          </a>
                        ) : (
                          <Link href={`/benchmarks/${slugify(b.name)}`} className="transition-colors hover:text-blue-600">
                            {b.name}
                          </Link>
                        )}
                        {b.metric ? <span className="ml-1 text-xs text-black/45">({b.metric})</span> : null}
                        {b.source && (
                          <a
                            href={b.source}
                            target="_blank"
                            rel="noreferrer"
                            title="Score as reported here"
                            className="ml-1.5 whitespace-nowrap text-[11px] font-medium text-blue-600 hover:text-blue-700"
                          >
                            report ↗
                          </a>
                        )}
                      </span>
                      <span className="shrink-0 font-mono font-semibold tabular-nums text-black">{b.score}</span>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
          {c.weights.length > 0 && (
            <div className="space-y-4">
              <h2 className="font-hand text-3xl font-bold tracking-tight text-black">Weights</h2>
              <ul className="card divide-y divide-black/10 text-sm">
                {c.weights.map((w, i) => (
                  <li key={i} className="px-4 py-2.5">
                    <a
                      href={w.url}
                      target="_blank"
                      rel="noreferrer"
                      className="font-medium text-blue-600 underline decoration-wavy underline-offset-4 hover:text-blue-700"
                    >
                      {w.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      ) : null}

      <p className="text-xs leading-relaxed text-black/40">
        Prices are per million tokens (USD). “—” means the provider does not publicly list a price for this
        model. Data from models.dev; verify with the provider before purchasing.
      </p>
    </div>
  );
}
