import type { Metadata } from "next";
import Link from "next/link";
import { getCatalog, getEvents } from "@/lib/data";
import { getPriceArchive } from "@/lib/data/archive";
import { coverage, windowLabel } from "@/lib/data/coverage";
import { getWeights } from "@/lib/data/weights";
import { isFreelyUsable } from "@/lib/data/weights";
import { buildBaskets, MIN_CONSTITUENTS } from "@/lib/economics/instruments";
import { bestDiscounts, widestMarkups, MIN_QUOTES } from "@/lib/economics/basis";
import { MIN_OBSERVATION_DAYS } from "@/lib/economics/volatility";
import { DEFAULT_WORKLOAD } from "@/lib/economics/workload";
import { Badge, Bar, EmptyState, SectionHead } from "@/components/ui";

export const metadata: Metadata = {
  title: "Exchange",
  description:
    "Token prices as a market: instrument baskets, gateway basis over first-party rates, and how much of it we can honestly measure yet.",
  alternates: { canonical: "/exchange" },
};

const pct = (v: number) => `${v > 0 ? "+" : ""}${(v * 100).toFixed(1)}%`;
const perM = (v: number) => (v >= 1 ? `$${v.toFixed(2)}` : `$${v.toFixed(3)}`);

export default async function ExchangePage() {
  const [catalog, events, archive, weights] = await Promise.all([
    getCatalog(),
    getEvents(),
    getPriceArchive(),
    getWeights(),
  ]);

  const freelyUsable = new Set(
    Object.values(weights.models)
      .filter(isFreelyUsable)
      .map((f) => f.groupId),
  );

  const w = DEFAULT_WORKLOAD;
  const baskets = buildBaskets(catalog.tracked, freelyUsable, w);
  const discounts = bestDiscounts(catalog.tracked, w, 6, false);
  const openDiscounts = bestDiscounts(catalog.tracked, w, 6, true);
  const markups = widestMarkups(catalog.tracked, w, 6);
  const cov = coverage(events, archive);
  const canIndex = cov.archiveDays >= MIN_OBSERVATION_DAYS;

  return (
    <div className="space-y-8">
      <header className="page-intro">
        <p className="mono-label">Token economics</p>
        <h1 className="text-3xl font-bold tracking-tight text-black sm:text-4xl">The exchange</h1>
        <p className="max-w-3xl text-sm leading-relaxed text-black/60">
          A catalog is not a market. This page treats it as one: models grouped into the classes a
          buyer actually chooses between, gateway quotes measured against the lab&apos;s own counter,
          and an explicit account of how much history exists behind each number. Everything is priced
          for the <b className="font-semibold text-black">{w.name.toLowerCase()}</b> profile.
        </p>
      </header>

      <section className="space-y-3">
        <SectionHead
          title="Instruments"
          eyebrow={`${baskets.length} classes · median rate per class`}
        />
        <p className="max-w-3xl text-sm leading-relaxed text-black/60">
          Tracking 3,000 listings gives you no index, because most of them are the same weights sold
          twice. A basket is a class of purchase. Membership comes from verified facts — lab
          attribution, effective price, context window, licence — never from a model&apos;s name, and
          a class needs {MIN_CONSTITUENTS} constituents before it gets a median.
        </p>
        {baskets.length === 0 ? (
          <EmptyState>No class has enough priced constituents yet.</EmptyState>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {baskets.map((b) => {
              const span = b.dearest && b.cheapest && b.cheapest.rate > 0
                ? b.dearest.rate / b.cheapest.rate
                : null;
              return (
                <article key={b.instrument.id} className="card space-y-3 p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-bold tracking-tight text-black">
                        {b.instrument.name}
                      </h3>
                      <p className="micro-label mt-1">{b.constituents.length} constituents</p>
                    </div>
                    <div className="text-right">
                      <div className="font-mono text-xl font-bold tabular-nums text-black">
                        {perM(b.median)}
                      </div>
                      <div className="micro-label">median / M</div>
                    </div>
                  </div>
                  <p className="text-xs leading-relaxed text-black/60">{b.instrument.rule}</p>
                  <dl className="grid grid-cols-2 gap-3 border-t border-black/10 pt-3 text-sm">
                    <div>
                      <dt className="micro-label">cheapest</dt>
                      <dd className="mt-0.5 truncate">
                        <Link href={`/m/${b.cheapest!.group.id}`} className="font-medium transition-colors hover:text-accent">
                          {b.cheapest!.group.name}
                        </Link>
                        <span className="ml-1.5 font-mono text-xs tabular-nums text-black/60">
                          {perM(b.cheapest!.rate)}
                        </span>
                      </dd>
                    </div>
                    <div>
                      <dt className="micro-label">dearest</dt>
                      <dd className="mt-0.5 truncate">
                        <Link href={`/m/${b.dearest!.group.id}`} className="font-medium transition-colors hover:text-accent">
                          {b.dearest!.group.name}
                        </Link>
                        <span className="ml-1.5 font-mono text-xs tabular-nums text-black/60">
                          {perM(b.dearest!.rate)}
                        </span>
                      </dd>
                    </div>
                  </dl>
                  {span != null && span >= 2 && (
                    <p className="micro-label">
                      {span.toFixed(1)}× between the ends of this class
                    </p>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <SectionHead
          title="Basis"
          eyebrow="Gateway quotes vs the lab's own counter"
          eyebrowTone="warn"
        />
        <p className="max-w-3xl text-sm leading-relaxed text-black/60">
          When a lab sells its own model, every gateway listing is a quote on identical weights, so
          the gap is pure markup — or a subsidy. Only models with a first-party reference and at
          least {MIN_QUOTES} gateway quotes appear; without a lab counter there is no basis to
          measure, and the cheapest reseller is not a substitute for one. A quote no second venue
          comes close to is treated as a feed error and kept out of the headline figures.
        </p>
        <p className="max-w-3xl text-sm leading-relaxed text-black/60">
          Open-weight models are listed separately below. When the weights are public the
          lab&apos;s API is one host among many, so a host undercutting it is ordinary competition —
          quite unlike a gateway undercutting the only company that has the weights.
        </p>
        <div className="grid gap-6 md:grid-cols-2">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Badge tone="pos">Below the lab</Badge>
              <h3 className="text-sm font-bold text-black">Proprietary models, undercut</h3>
            </div>
            {discounts.length === 0 ? (
              <EmptyState>No gateway is corroborated as undercutting a first-party price.</EmptyState>
            ) : (
              <ul className="card divide-y divide-black/10">
                {discounts.map((r) => (
                  <li key={r.groupId} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                    <span className="min-w-0">
                      <Link href={`/m/${r.groupId}`} className="truncate font-medium transition-colors hover:text-accent">
                        {r.name}
                      </Link>
                      <span className="mt-0.5 block truncate text-xs text-black/60">
                        {r.quotes[0].providerName} vs {r.referenceProvider}
                      </span>
                    </span>
                    <span className="shrink-0 font-mono text-sm font-semibold tabular-nums text-pos">
                      {pct(r.bestBasis)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Badge tone="neg">Above the lab</Badge>
              <h3 className="text-sm font-bold text-black">Fattest typical markups</h3>
            </div>
            {markups.length === 0 ? (
              <EmptyState>No model carries a positive median markup right now.</EmptyState>
            ) : (
              <ul className="card divide-y divide-black/10">
                {markups.map((r) => (
                  <li key={r.groupId} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                    <span className="min-w-0">
                      <Link href={`/m/${r.groupId}`} className="truncate font-medium transition-colors hover:text-accent">
                        {r.name}
                      </Link>
                      <span className="mt-0.5 block truncate text-xs text-black/60">
                        median of {r.quotes.length} quotes vs {r.referenceProvider}
                      </span>
                    </span>
                    <span className="shrink-0 font-mono text-sm font-semibold tabular-nums text-neg">
                      {pct(r.medianBasis)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
        {openDiscounts.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Badge tone="special">Open weights</Badge>
              <h3 className="text-sm font-bold text-black">
                Hosts undercutting the lab that trained it
              </h3>
            </div>
            <ul className="card grid divide-y divide-black/10 sm:grid-cols-2 sm:divide-y-0">
              {openDiscounts.map((r) => (
                <li key={r.groupId} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                  <span className="min-w-0">
                    <Link href={`/m/${r.groupId}`} className="truncate font-medium transition-colors hover:text-accent">
                      {r.name}
                    </Link>
                    <span className="mt-0.5 block truncate text-xs text-black/60">
                      {r.quotes[0].providerName} vs {r.referenceProvider}
                    </span>
                  </span>
                  <span className="shrink-0 font-mono text-sm font-semibold tabular-nums text-special">
                    {pct(r.bestBasis)}
                  </span>
                </li>
              ))}
            </ul>
            <p className="max-w-3xl text-xs leading-relaxed text-black/60">
              These are not markups being competed away — they are the gap between a lab&apos;s
              managed service and a commodity host running the same public weights. Read them as a
              self-host signal, not as evidence the lab is overcharging.
            </p>
          </div>
        )}
      </section>

      <section className="space-y-3">
        <SectionHead title="What we can honestly measure" eyebrow="Coverage" eyebrowTone="accent" />
        <div className="card space-y-4 p-5">
          <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Stat label="archive" value={`${cov.archiveDays}d`} note="permanent price record" />
            <Stat label="observed" value={`${cov.observedDays}d`} note={windowLabel(cov)} />
            <Stat label="instruments" value={String(baskets.length)} note="classes with a median" />
            <Stat
              label="index"
              value={canIndex ? "live" : `${Math.max(0, MIN_OBSERVATION_DAYS - cov.archiveDays)}d`}
              note={canIndex ? "publishing" : "until it publishes"}
            />
          </dl>
          <div className="space-y-2 border-t border-black/10 pt-4">
            <div className="flex items-center gap-3 text-sm">
              <span className="w-28 shrink-0 micro-label">index readiness</span>
              <Bar
                pct={Math.min(1, cov.archiveDays / MIN_OBSERVATION_DAYS)}
                tone={canIndex ? "pos" : "neutral"}
                label={`${cov.archiveDays} of ${MIN_OBSERVATION_DAYS} days needed`}
              />
              <span className="w-16 shrink-0 text-right font-mono text-xs tabular-nums text-black/70">
                {cov.archiveDays}/{MIN_OBSERVATION_DAYS}
              </span>
            </div>
            <p className="max-w-3xl text-xs leading-relaxed text-black/60">
              Levels and spreads above are cross-sectional — they need one day of data and are true
              today. Anything longitudinal (a price index, volatility, a basis trend) needs{" "}
              {MIN_OBSERVATION_DAYS} days of archive, and until then this page says so instead of
              drawing a line through {cov.archiveDays} point{cov.archiveDays === 1 ? "" : "s"}.
              {cov.coldStartDate && (
                <> The first sync on {cov.coldStartDate} diffed against an empty catalog, so its
                  events are excluded from every rate here.</>
              )}
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}

function Stat({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div>
      <dt className="micro-label">{label}</dt>
      <dd className="mt-1 font-mono text-2xl font-bold tabular-nums text-black">{value}</dd>
      <dd className="text-xs text-black/60">{note}</dd>
    </div>
  );
}
