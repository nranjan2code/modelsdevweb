import Link from "next/link";
import { getCatalog, getEvents, getNews } from "@/lib/data";
import { EventCard } from "@/components/event-card";
import { fmtPerM, fmtTokens, fmtAgo } from "@/lib/format";
import type { Event } from "@/lib/pipeline/types";

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="card px-4 py-3">
      <div className="text-xl font-semibold text-zinc-50 tabular-nums">{value}</div>
      <div className="text-xs text-zinc-500">{label}</div>
    </div>
  );
}

function priceDrops(events: Event[]) {
  const drops: { key: string; name: string; providerId: string; oldV: number; newV: number; date: string }[] = [];
  for (const e of events) {
    if (e.type !== "repriced") continue;
    for (const c of e.changes) {
      if (c.field === "cost.input" && typeof c.old === "number" && typeof c.new === "number" && c.new < c.old) {
        drops.push({
          key: e.id,
          name: e.modelName,
          providerId: e.providerId ?? "",
          oldV: c.old,
          newV: c.new,
          date: e.date,
        });
      }
    }
  }
  return drops.sort((a, b) => a.newV / a.oldV - b.newV / b.oldV).slice(0, 5);
}

export default async function HomePage() {
  const [catalog, events, news] = await Promise.all([getCatalog(), getEvents(), getNews()]);
  const s = catalog.stats;
  const fresh = [...catalog.groups]
    .sort((a, b) => (b.canonical?.releaseDate ?? "").localeCompare(a.canonical?.releaseDate ?? ""))
    .slice(0, 6);
  const drops = priceDrops(events);

  return (
    <div className="space-y-10">
      <section className="space-y-3">
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-50">
          Every AI model. Every provider. Every change.
        </h1>
        <p className="max-w-2xl text-zinc-400">
          Live comparison of model prices across inference providers, plus a changelog of releases, price
          moves and deprecations — diffed hourly from open data.
        </p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <Stat value={String(s.models)} label="canonical models" />
          <Stat value={String(s.providers)} label="providers" />
          <Stat value={String(s.listings)} label="listings tracked" />
          <Stat value={String(s.labs)} label="labs" />
          <Stat value={String(s.openWeights)} label="open weights" />
          <Stat value={String(s.deprecated)} label="deprecated listings" />
        </div>
      </section>

      <section className="grid gap-8 lg:grid-cols-[1fr_360px]">
        <div className="space-y-4">
          <div className="flex items-baseline justify-between">
            <h2 className="text-lg font-semibold text-zinc-100">Latest activity</h2>
            <Link href="/changelog" className="text-sm text-emerald-400 hover:text-emerald-300">
              View all →
            </Link>
          </div>
          {events.length === 0 ? (
            <p className="card p-6 text-sm text-zinc-500">
              Baseline snapshot captured — changes will appear here after the next sync detects a diff.
            </p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {events.slice(0, 12).map((e) => (
                <EventCard key={e.id} event={e} />
              ))}
            </div>
          )}
        </div>

        <aside className="space-y-8">
          <div className="space-y-3">
            <h2 className="text-lg font-semibold text-zinc-100">Freshest models</h2>
            <ul className="card divide-y divide-zinc-800/60 text-sm">
              {fresh.map((g) => (
                <li key={g.id} className="px-4 py-2.5 flex items-center justify-between gap-2">
                  <Link href={`/m/${g.id}`} className="truncate hover:text-emerald-400 transition-colors">
                    {g.name}
                  </Link>
                  <span className="shrink-0 text-xs text-zinc-500">
                    {g.best ? `${fmtPerM(g.best.input)}/${fmtPerM(g.best.output)}` : "—"}
                  </span>
                </li>
              ))}
            </ul>
          </div>
          {news.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-baseline justify-between">
                <h2 className="text-lg font-semibold text-zinc-100">In the news</h2>
                <Link href="/news" className="text-sm text-emerald-400 hover:text-emerald-300">
                  View all →
                </Link>
              </div>
              <ul className="card divide-y divide-zinc-800/60 text-sm">
                {news.slice(0, 6).map((n) => {
                  const modelId = n.modelIds.find((id) => catalog.groupById.has(id));
                  return (
                    <li key={n.id} className="px-4 py-2.5 space-y-1">
                      <a
                        href={n.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="line-clamp-2 text-zinc-200 hover:text-emerald-400 transition-colors"
                      >
                        {n.title}
                      </a>
                      <div className="flex items-center gap-1.5 text-xs text-zinc-500">
                        {n.favicon && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={n.favicon} alt="" width={12} height={12} className="h-3 w-3 rounded-sm" />
                        )}
                        <span className="truncate">{n.source}</span>
                        {n.publishedAt && <span>· {fmtAgo(n.publishedAt)}</span>}
                        {modelId && (
                          <>
                            <span>·</span>
                            <Link href={`/m/${modelId}`} className="shrink-0 hover:text-emerald-400 transition-colors">
                              {catalog.groupById.get(modelId)?.name ?? modelId}
                            </Link>
                          </>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
          {drops.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-lg font-semibold text-zinc-100">Biggest price drops</h2>
              <ul className="card divide-y divide-zinc-800/60 text-sm">
                {drops.map((d) => (
                  <li key={d.key} className="px-4 py-2.5 flex items-center justify-between gap-2">
                    <span className="truncate">
                      {d.name} <span className="text-xs text-zinc-500">via {d.providerId}</span>
                    </span>
                    <span className="shrink-0 font-mono text-xs text-emerald-400 tabular-nums">
                      ${d.oldV} → ${d.newV}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </aside>
      </section>

      <section className="space-y-3">
        <div className="flex items-baseline justify-between">
          <h2 className="text-lg font-semibold text-zinc-100">Cheapest frontier context</h2>
          <Link href="/browse" className="text-sm text-emerald-400 hover:text-emerald-300">
            Browse all →
          </Link>
        </div>
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-zinc-800 text-left text-xs uppercase tracking-wide text-zinc-500">
                <th className="px-4 py-3 font-medium">Model</th>
                <th className="px-4 py-3 font-medium text-right">Best input /M</th>
                <th className="px-4 py-3 font-medium text-right">Best output /M</th>
                <th className="px-4 py-3 font-medium text-right">Context</th>
                <th className="px-4 py-3 font-medium text-right">Providers</th>
              </tr>
            </thead>
            <tbody>
              {[...catalog.groups]
                .filter((g) => g.best && (g.canonical?.limit?.context ?? g.listings[0]?.limit.context ?? 0) >= 200_000)
                .sort((a, b) => a.best!.input - b.best!.input)
                .slice(0, 8)
                .map((g) => {
                  const ctx = g.canonical?.limit?.context ?? Math.max(...g.listings.map((l) => l.limit.context ?? 0));
                  return (
                    <tr key={g.id} className="border-b border-zinc-800/60 last:border-0 hover:bg-zinc-900/50">
                      <td className="px-4 py-3">
                        <Link href={`/m/${g.id}`} className="hover:text-emerald-400 transition-colors">
                          {g.name}
                        </Link>
                        <span className="ml-2 text-xs text-zinc-500">{g.labId}</span>
                      </td>
                      <td className="px-4 py-3 text-right font-mono tabular-nums">{fmtPerM(g.best!.input)}</td>
                      <td className="px-4 py-3 text-right font-mono tabular-nums">{fmtPerM(g.best!.output)}</td>
                      <td className="px-4 py-3 text-right font-mono tabular-nums">{fmtTokens(ctx)}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-zinc-400">{g.listings.length}</td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
