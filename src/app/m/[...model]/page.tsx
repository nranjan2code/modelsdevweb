import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { existsSync } from "node:fs";
import path from "node:path";
import {
  getModel,
  getCatalog,
  getEvents,
  getNews,
  groupContext,
  groupReleaseDate,
  lowestInputListing,
  lowestOutputListing,
  providerCount,
} from "@/lib/data";
import { SITE_URL } from "@/lib/site";
import { getPriceHistory } from "@/lib/data/history";
import { slugify } from "@/lib/data/benchmarks";
import { priceSpread, spreadSummary } from "@/lib/data/market";
import {
  ACCESS_NOTE,
  fmtParams,
  getWeights,
  LICENCE_LABEL,
  LICENCE_NOTE,
} from "@/lib/data/weights";
import { PROVENANCE_LABEL, PROVENANCE_NOTE, provenanceOf } from "@/lib/data/provenance";
import { benchmarkHome } from "@/lib/data/benchmark-links";
import { PriceTable } from "@/components/price-table";
import { PriceHistory } from "@/components/price-history";
import { EventTypeBadge, changeText } from "@/components/event-card";
import { StatusBadge } from "@/components/price-table";
import { CopyField } from "@/components/copy-field";
import { JsonLd } from "@/components/jsonld";
import { Badge } from "@/components/ui";
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
  const metaCtx = groupContext(group);
  const providers = providerCount(group);
  const description =
    `${group.name} pricing across ${providers} providers` +
    (group.best
      ? ` — from ${fmtPerM(group.best.input)} input / ${fmtPerM(group.best.output)} per 1M tokens at its cheapest listed provider.`
      : group.free
        ? " — available for free at its cheapest listed provider."
        : ".") +
    (metaCtx ? ` ${Math.round(metaCtx / 1000)}K token context window.` : "");
  return {
    title: `${group.name} — prices across ${providers} providers`,
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
  const spread = priceSpread(group);
  const facts = (await getWeights()).models[group.id] ?? null;
  const [events, news] = await Promise.all([getEvents(), getNews()]);
  const listingKeys = new Set(group.listings.map((l) => l.key));
  const modelEvents = events
    .filter((e) => e.canonicalId === id || listingKeys.has(e.modelKey))
    .slice(0, 6);
  const modelNews = news.filter((n) => n.modelIds.includes(id)).slice(0, 4);
  const liveListings = group.listings.filter((l) => l.status !== "deprecated");
  const statuses = [...new Set(liveListings.map((l) => l.status).filter((s): s is "alpha" | "beta" => s != null))];
  const experimental = liveListings.some((l) => l.experimental);

  const pricedOffers = liveListings
    .filter((l) => l.cost.input != null)
    .sort((a, b) => (a.cost.input ?? Infinity) - (b.cost.input ?? Infinity));
  const ctx = groupContext(group);
  const maxOut = (() => {
    let m = c?.limit?.output ?? null;
    for (const l of group.listings) {
      if (l.limit.output != null && (m == null || l.limit.output > m)) m = l.limit.output;
    }
    return m;
  })();
  const releaseDate = groupReleaseDate(group);
  const providers = providerCount(group);
  const lowestInput = lowestInputListing(group);
  const lowestOutput = lowestOutputListing(group);
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
        `AI model pricing comparison across ${providers} inference providers. Prices are USD per 1M tokens.`,
      category: "AI language model",
      ...(releaseDate ? { releaseDate } : {}),
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
      <nav className="text-sm text-black/60">
        <Link href="/browse" className="transition-colors hover:text-accent">
          Browse
        </Link>
        <span className="mx-1.5">/</span>
        <Link href={`/lab/${group.labId}`} className="transition-colors hover:text-accent">
          {group.labId}
        </Link>
      </nav>

      <header className="page-intro">
        <p className="mono-label">Model</p>
        <h1 className="text-3xl font-bold tracking-tight text-black sm:text-4xl">{group.name}</h1>
        {c?.description && <p className="max-w-3xl leading-relaxed text-black/60">{c.description}</p>}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-black/60">
          <span>{providers} providers · {liveListings.length} listings</span>
          {releaseDate && (
            <span>
              released <time dateTime={releaseDate}>{fmtDate(releaseDate)}</time>
            </span>
          )}
          {c?.knowledge && <span>knowledge cutoff {c.knowledge}</span>}
          {c?.openWeights != null && (
            <Badge tone={c.openWeights ? "pos" : "muted"} bold={c.openWeights} className={c.openWeights ? "" : "font-normal"}>
              {c.openWeights ? "open weights" : "closed weights"}
            </Badge>
          )}
          {statuses.map((s) => (
            <StatusBadge key={s} status={s} />
          ))}
          {experimental && (
            <Badge tone="special">experimental</Badge>
          )}
        </div>
      </header>

      {(lowestInput || lowestOutput || group.free || ctx) && (
        <section className="metric-strip grid grid-cols-2 sm:grid-cols-4" aria-label="Model summary">
          {lowestInput && lowestOutput ? (
            <>
              <div className="metric-cell">
                <div className="font-mono text-lg font-bold tabular-nums text-black">{fmtPerM(lowestInput.cost.input)}</div>
                <div className="mono-label mt-0.5">lowest input /M · {lowestInput.providerName}</div>
              </div>
              <div className="metric-cell">
                <div className="font-mono text-lg font-bold tabular-nums text-black">{fmtPerM(lowestOutput.cost.output)}</div>
                <div className="mono-label mt-0.5">lowest output /M · {lowestOutput.providerName}</div>
              </div>
            </>
          ) : (
            <div className="metric-cell">
              <div className="font-mono text-lg font-bold tabular-nums text-pos">{group.free ? "Free" : "—"}</div>
              <div className="mono-label mt-0.5">{group.free ? "cheapest listed tier" : "no listed price"}</div>
            </div>
          )}
          <div className="metric-cell">
            <div className="font-mono text-lg font-bold tabular-nums text-black">{fmtTokens(ctx)}</div>
            <div className="mono-label mt-0.5">context window</div>
          </div>
          <div className="metric-cell">
            <div className="font-mono text-lg font-bold tabular-nums text-black">{fmtTokens(maxOut)}</div>
            <div className="mono-label mt-0.5">max output</div>
          </div>
        </section>
      )}

      <section className="space-y-4">
        <h2 className="font-hand text-3xl font-bold tracking-tight text-black">
          Compare providers{" "}
          <span className="align-middle font-sans text-sm font-normal text-black/60">
            (sorted by listed input price)
          </span>
        </h2>
        {spread && (
          <p className="card-flat p-4 text-sm leading-relaxed text-black/70">
            {spreadSummary(group, spread)}
          </p>
        )}
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
            <p className="text-xs leading-relaxed text-black/60">
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
                  className="control-button shrink-0"
                >
                  Changelog →
                </Link>
              </div>
              <ul className="space-y-2">
                {modelEvents.map((e) => (
                  <li key={e.id} className="card-flat flex flex-col gap-1 p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <EventTypeBadge type={e.type} />
                      <span className="text-xs text-black/60">
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
                  className="control-button shrink-0"
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
                      className="text-sm font-medium leading-snug text-black transition-colors hover:text-accent"
                    >
                      {n.title}
                    </a>
                    <div className="mt-0.5 flex items-center gap-1.5 text-xs text-black/60">
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

      {(c?.benchmarks.length || c?.weights.length || facts) ? (
        <section className="grid gap-6 md:grid-cols-2">
          {c != null && c.benchmarks.length > 0 && (
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
                            className="font-medium underline decoration-wavy decoration-black/25 underline-offset-4 transition-colors hover:text-accent hover:decoration-accent"
                          >
                            {b.name} ↗
                          </a>
                        ) : (
                          <Link href={`/benchmarks/${slugify(b.name)}`} className="transition-colors hover:text-accent">
                            {b.name}
                          </Link>
                        )}
                        {b.metric ? <span className="ml-1 text-xs text-black/60">({b.metric})</span> : null}
                        {b.source && (
                          <a
                            href={b.source}
                            target="_blank"
                            rel="noreferrer"
                            title="Score as reported here"
                            className="ml-1.5 whitespace-nowrap text-xs font-medium text-accent hover:text-accent-strong"
                          >
                            report ↗
                          </a>
                        )}
                      </span>
                      <span className="flex shrink-0 items-center gap-2">
                        <span title={PROVENANCE_NOTE[provenanceOf(b.source)]}>
                          <Badge tone={provenanceOf(b.source) === "independent" ? "pos" : "muted"}>
                            {PROVENANCE_LABEL[provenanceOf(b.source)]}
                          </Badge>
                        </span>
                        <span className="font-mono font-semibold tabular-nums text-black">{b.score}</span>
                      </span>
                    </li>
                  );
                })}
              </ul>
              <p className="text-xs leading-relaxed text-black/60">
                Scores a lab published about its own model are claims, not measurements. Rankings
                elsewhere on this site use independently measured scores only.
              </p>
            </div>
          )}
          {((c?.weights.length ?? 0) > 0 || facts) && (
            <div className="space-y-4">
              <h2 className="font-hand text-3xl font-bold tracking-tight text-black">Weights</h2>
              {facts && (
                <div className="card space-y-3 p-4 text-sm">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge
                      tone={
                        facts.licenceClass === "permissive"
                          ? "pos"
                          : facts.licenceClass === "non-commercial"
                            ? "neg"
                            : facts.licenceClass === "community"
                              ? "warn"
                              : "muted"
                      }
                      bold
                    >
                      {LICENCE_LABEL[facts.licenceClass]}
                    </Badge>
                    {facts.licence && <Badge tone="muted" mono>{facts.licence}</Badge>}
                    {facts.access === "gated" && <Badge tone="warn">Access request</Badge>}
                    {fmtParams(facts.parameters) && (
                      <Badge tone="neutral" mono>{fmtParams(facts.parameters)} params</Badge>
                    )}
                  </div>
                  <p className="leading-relaxed text-black/70">
                    {LICENCE_NOTE[facts.licenceClass]}{" "}
                    {facts.access === "gated" ? ACCESS_NOTE.gated : ACCESS_NOTE.open}
                  </p>
                  {facts.baseModel && (
                    <p className="text-xs text-black/60">
                      Derived from <span className="font-mono">{facts.baseModel}</span>.
                    </p>
                  )}
                  <p className="micro-label tracking-wider">
                    licence and gating from the{" "}
                    <a
                      href={facts.cardUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-accent hover:text-accent-strong"
                    >
                      Hugging Face model card ↗
                    </a>{" "}
                    — the card is authoritative, this is a summary
                  </p>
                </div>
              )}
              {c != null && c.weights.length > 0 && (
              <ul className="card divide-y divide-black/10 text-sm">
                {c.weights.map((w, i) => (
                  <li key={i} className="px-4 py-2.5">
                    <a
                      href={w.url}
                      target="_blank"
                      rel="noreferrer"
                      className="font-medium text-accent underline decoration-wavy underline-offset-4 hover:text-accent-strong"
                    >
                      {w.label}
                    </a>
                  </li>
                ))}
              </ul>
              )}
            </div>
          )}
        </section>
      ) : null}

      <p className="text-xs leading-relaxed text-black/60">
        Prices are per million tokens (USD). “—” means the provider does not publicly list a price for this
        model. Data from models.dev; verify with the provider before purchasing.
      </p>
    </div>
  );
}
