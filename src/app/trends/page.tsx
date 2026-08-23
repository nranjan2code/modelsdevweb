import type { Metadata } from "next";
import Link from "next/link";
import { getCatalog, getEvents, groupContext, groupRate, providerCount } from "@/lib/data";
import { capabilityAdoption, priceBuckets } from "@/lib/data/stats";
import type { Event } from "@/lib/pipeline/types";
import { EventTypeBadge } from "@/components/event-card";
import { Bar } from "@/components/ui";
import { fmtPerM, fmtTokens } from "@/lib/format";
import { ContextPriceChart, type ContextPricePoint } from "@/components/context-price-chart";

export const metadata: Metadata = {
  title: "Market trends",
  description: "Aggregate market view of AI models: capability adoption, price distributions, median prices by lab and recent repricings.",
  alternates: { canonical: "/trends" },
};

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 === 1 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

export default async function TrendsPage() {
  const [catalog, events] = await Promise.all([getCatalog(), getEvents()]);
  // Aggregates run over lab-attributed models: counting gateway-only variants
  // weights every distribution by how many resellers carry a model.
  const groups = catalog.tracked;

  const caps = capabilityAdoption(groups);

  const buckets = priceBuckets(groups);
  const bucketMax = Math.max(...buckets.map((b) => b.count), 1);

  const labStats = catalog.labs
    .map((lab) => {
      const gs = groups.filter((g) => g.labId === lab.id && g.best != null);
      return {
        labId: lab.id,
        count: gs.length,
        medIn: median(gs.map((g) => g.best!.input)),
        medOut: median(gs.map((g) => g.best!.output)),
      };
    })
    .filter((s) => s.count >= 3)
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);
  const medMax = Math.max(...labStats.map((s) => Math.max(s.medIn ?? 0, s.medOut ?? 0)), 0.001);
  const medScale = (value: number | null) => value == null ? 0 : Math.log10(1 + value) / Math.log10(1 + medMax);

  const priced = groups.filter((g) => g.best != null);
  const scatter: ContextPricePoint[] = priced
    .filter((g) => (groupContext(g) ?? 0) > 0)
    .map((g) => ({
      id: g.id,
      input: g.best!.input,
      output: g.best!.output,
      context: groupContext(g) ?? 0,
      open: g.canonical?.openWeights === true,
      name: g.name,
      lab: g.labId,
      providers: providerCount(g),
      textInput: (g.canonical?.modalities?.input.includes("text") ?? false) || g.listings.some((listing) => listing.modalities.input.includes("text")),
      textOutput: (g.canonical?.modalities?.output.includes("text") ?? false) || g.listings.some((listing) => listing.modalities.output.includes("text")),
    }));
  const blendedMedian = median(priced.map((g) => groupRate(g)).filter(Number.isFinite));
  const contextMedian = median(groups.map((g) => groupContext(g)).filter((value): value is number => value != null));
  const latestEventDate = Math.max(...events.map((event) => Date.parse(`${event.date}T00:00:00Z`)), 0);
  const recentCutoff = latestEventDate - 6 * 86_400_000;
  const recentEvents = events.filter((event) => Date.parse(`${event.date}T00:00:00Z`) >= recentCutoff).length;

  const byType = new Map<string, number>();
  for (const e of events) byType.set(e.type, (byType.get(e.type) ?? 0) + 1);
  const types = [...byType.entries()].sort((a, b) => b[1] - a[1]);
  const typeMax = Math.max(...types.map(([, c]) => c), 1);

  const repricedLabs = new Map<string, number>();
  const repricedModels = new Map<string, { name: string; id: string | null; count: number }>();
  for (const e of events as Event[]) {
    if (e.type !== "repriced") continue;
    if (e.labId) repricedLabs.set(e.labId, (repricedLabs.get(e.labId) ?? 0) + 1);
    if (e.canonicalId) {
      const cur = repricedModels.get(e.canonicalId);
      repricedModels.set(e.canonicalId, { name: e.modelName, id: e.canonicalId, count: (cur?.count ?? 0) + 1 });
    }
  }
  const hotModels = [...repricedModels.values()].sort((a, b) => b.count - a.count).slice(0, 5);

  return (
    <div className="space-y-12">
      <header className="page-intro">
        <p className="mono-label">State of the market</p>
        <h1 className="text-3xl font-bold tracking-tight text-black sm:text-4xl">Trends</h1>
        <p className="max-w-2xl text-sm leading-relaxed text-black/60">
          Aggregate view of the {groups.length}-model catalog: what capabilities are standard, where prices sit,
          which labs charge what, and what has been moving lately. Computed at build time from the same open
          snapshot as every other page.
        </p>
      </header>

      <dl className="metric-strip grid grid-cols-2 lg:grid-cols-4">
        <div className="metric-cell"><dt className="micro-label">Canonical market</dt><dd className="mt-1 font-mono text-2xl font-bold tabular-nums">{groups.length}</dd><dd className="text-xs text-black/60">tracked models</dd></div>
        <div className="metric-cell"><dt className="micro-label">Median blended price</dt><dd className="mt-1 font-mono text-2xl font-bold tabular-nums">{blendedMedian == null ? "—" : fmtPerM(blendedMedian)}</dd><dd className="text-xs text-black/60">per 1M tokens</dd></div>
        <div className="metric-cell"><dt className="micro-label">Median context</dt><dd className="mt-1 font-mono text-2xl font-bold tabular-nums">{fmtTokens(contextMedian)}</dd><dd className="text-xs text-black/60">known windows</dd></div>
        <div className="metric-cell"><dt className="micro-label">Seven-day tape</dt><dd className="mt-1 font-mono text-2xl font-bold tabular-nums">{recentEvents}</dd><dd className="text-xs text-black/60">catalog changes</dd></div>
      </dl>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-3">
          <h2 className="font-hand text-2xl font-bold tracking-tight text-black">Capability adoption</h2>
          <ul className="card space-y-3 p-4">
            {caps.map((c) => (
              <li key={c.label} className="flex items-center gap-2 text-sm sm:gap-3">
                <span className="w-28 shrink-0 truncate text-black/60 sm:w-36">{c.label}</span>
                <Bar pct={c.pct} label={`${c.label}: ${Math.round(c.pct * 100)} percent of tracked models`} />
                <span className="w-16 shrink-0 text-right font-mono text-xs tabular-nums text-black/70 sm:w-20">
                  {c.count} · {Math.round(c.pct * 100)}%
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div className="space-y-3">
          <h2 className="font-hand text-2xl font-bold tracking-tight text-black">Price distribution</h2>
          <div className="card p-4">
            <div className="mono-label mb-3">blended price /M · {priced.length} priced models</div>
            <ul className="space-y-2.5">
              {buckets.map((b) => (
                <li key={b.label} className="flex items-center gap-2 text-sm sm:gap-3">
                  <span className="w-20 shrink-0 font-mono text-xs text-black/60">{b.label}</span>
                  <Bar pct={b.count / bucketMax} label={`${b.label}: ${b.count} priced models`} />
                  <span className="w-8 shrink-0 text-right font-mono tabular-nums text-black/70">{b.count}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="font-hand text-2xl font-bold tracking-tight text-black">Median prices by lab</h2>
        <p className="text-sm text-black/60">Labs with ≥ 3 priced models. Log-scaled bars keep lower-priced labs readable; the printed prices remain authoritative.</p>
        <div className="chart-legend"><span className="inline-flex items-center gap-2"><span className="chart-key" />Input median</span><span className="inline-flex items-center gap-2"><span className="chart-key chart-key-special" />Output median</span></div>
        <ul className="card space-y-3 p-4">
          {labStats.map((s) => (
            <li key={s.labId} className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
              <Link href={`/lab/${s.labId}`} className="w-28 shrink-0 truncate font-medium transition-colors hover:text-accent">
                {s.labId}
              </Link>
              <div className="flex min-w-48 flex-1 items-center gap-2">
                <Bar pct={medScale(s.medIn)} label={`${s.labId} median input price ${s.medIn == null ? "unlisted" : fmtPerM(s.medIn)}`} />
                <span className="shrink-0 font-mono text-xs tabular-nums text-black/70">
                  in {s.medIn != null ? `$${s.medIn.toFixed(2)}` : "—"}
                </span>
              </div>
              <div className="flex min-w-48 flex-1 items-center gap-2">
                <Bar pct={medScale(s.medOut)} tone="special" label={`${s.labId} median output price ${s.medOut == null ? "unlisted" : fmtPerM(s.medOut)}`} />
                <span className="shrink-0 font-mono text-xs tabular-nums text-black/70">
                  out {s.medOut != null ? `$${s.medOut.toFixed(2)}` : "—"}
                </span>
              </div>
              <span className="w-14 shrink-0 text-right font-mono text-xs tabular-nums text-black/60">{s.count} mod.</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="font-hand text-2xl font-bold tracking-tight text-black">Context vs price explorer</h2>
        <p className="text-sm text-black/60">
          Find the models that buy the most context for the least published price. Switch between input, output
          and the site&rsquo;s 75/25 blend; then slice by lab, weight access, price or context. Both axes are logarithmic.
        </p>
        <ContextPriceChart points={scatter} />
      </section>

      <section className="grid gap-6 md:grid-cols-2">
        <div className="space-y-3">
          <h2 className="font-hand text-2xl font-bold tracking-tight text-black">Change pulse</h2>
          <ul className="card space-y-2.5 p-4">
            {events.length === 0 ? (
              <li className="text-sm text-black/60">No events recorded yet — the hourly diff just started collecting.</li>
            ) : (
              types.map(([type, count]) => (
                <li key={type} className="flex items-center gap-3 text-sm">
                  <EventTypeBadge type={type as Event["type"]} />
                  <Bar pct={count / typeMax} tone="neutral" label={`${type}: ${count} changes in the retained event log`} />
                  <span className="w-8 shrink-0 text-right font-mono tabular-nums text-black/70">{count}</span>
                </li>
              ))
            )}
          </ul>
        </div>
        <div className="space-y-3">
          <h2 className="font-hand text-2xl font-bold tracking-tight text-black">Most repriced models</h2>
          <ul className="card divide-y divide-black/10 text-sm">
            {hotModels.length === 0 ? (
              <li className="px-4 py-3 text-black/60">No repricings detected yet.</li>
            ) : (
              hotModels.map((m) => (
                <li key={m.id ?? m.name} className="flex items-center justify-between gap-2 px-4 py-2.5">
                  {m.id ? (
                    <Link href={`/m/${m.id}`} className="truncate font-medium transition-colors hover:text-accent">
                      {m.name}
                    </Link>
                  ) : (
                    <span className="truncate">{m.name}</span>
                  )}
                  <span className="shrink-0 font-mono text-xs tabular-nums text-special">{m.count}×</span>
                </li>
              ))
            )}
          </ul>
        </div>
      </section>
    </div>
  );
}
