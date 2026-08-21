import Link from "next/link";
import { getCatalog, getEvents, getNews } from "@/lib/data";
import { EventCard } from "@/components/event-card";
import { fmtPerM, fmtTokens, fmtAgo } from "@/lib/format";
import type { Event, NewsItem } from "@/lib/pipeline/types";

function SectionHead({ title, href, label = "View all" }: { title: string; href?: string; label?: string }) {
  return (
    <div className="mb-3 flex items-baseline justify-between">
      <h2 className="flex items-center gap-2.5 text-lg font-semibold text-zinc-100">
        <span className="inline-block h-4 w-1 rounded-full bg-emerald-400" />
        {title}
      </h2>
      {href && (
        <Link href={href} className="text-sm text-emerald-400 transition-colors hover:text-emerald-300">
          {label} →
        </Link>
      )}
    </div>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <div className="text-2xl font-semibold tabular-nums text-zinc-50">{value}</div>
      <div className="mt-0.5 text-[11px] uppercase tracking-wider text-zinc-500">{label}</div>
    </div>
  );
}

function NewsCard({ item, modelId, modelName }: { item: NewsItem; modelId?: string; modelName?: string }) {
  return (
    <article className="card flex flex-col gap-2 p-4 transition-colors hover:border-zinc-700">
      <div className="flex items-center gap-1.5 text-xs text-zinc-500">
        {item.favicon && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={item.favicon} alt="" width={12} height={12} className="h-3 w-3 rounded-sm" />
        )}
        <span className="truncate">{item.source}</span>
        {item.publishedAt && <span className="shrink-0">· {fmtAgo(item.publishedAt)}</span>}
      </div>
      <a
        href={item.url}
        target="_blank"
        rel="noopener noreferrer"
        className="line-clamp-2 font-medium leading-snug text-zinc-100 transition-colors hover:text-emerald-400"
      >
        {item.title}
      </a>
      {modelId && (
        <div className="mt-auto pt-1">
          <Link
            href={`/m/${modelId}`}
            className="inline-flex items-center rounded-md bg-emerald-500/10 px-1.5 py-0.5 text-[11px] font-medium text-emerald-400 transition-colors hover:bg-emerald-500/20"
          >
            {modelName ?? modelId}
          </Link>
        </div>
      )}
    </article>
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
  const modelNameOf = (id: string) => catalog.groupById.get(id)?.name;

  return (
    <div className="space-y-12">
      <section className="space-y-5">
        <h1 className="max-w-3xl text-4xl font-semibold leading-tight tracking-tight text-zinc-50">
          Every AI model. Every provider.{" "}
          <span className="bg-gradient-to-r from-emerald-300 to-teal-500 bg-clip-text text-transparent">
            Every change.
          </span>
        </h1>
        <p className="max-w-2xl text-zinc-400">
          Live comparison of model prices across inference providers, plus a changelog of releases, price
          moves and deprecations — diffed hourly from open data.
        </p>
        <div className="grid grid-cols-3 gap-x-6 gap-y-5 border-y border-zinc-800/60 py-5 sm:grid-cols-6">
          <Stat value={String(s.models)} label="models" />
          <Stat value={String(s.providers)} label="providers" />
          <Stat value={String(s.listings)} label="listings" />
          <Stat value={String(s.labs)} label="labs" />
          <Stat value={String(s.openWeights)} label="open weights" />
          <Stat value={String(s.deprecated)} label="deprecated" />
        </div>
      </section>

      {news.length > 0 && (
        <section>
          <SectionHead title="In the news" href="/news" />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {news.slice(0, 6).map((n) => {
              const modelId = n.modelIds.find((id) => catalog.groupById.has(id));
              return <NewsCard key={n.id} item={n} modelId={modelId} modelName={modelId ? modelNameOf(modelId) : undefined} />;
            })}
          </div>
        </section>
      )}

      <section className="grid gap-8 lg:grid-cols-[1fr_320px]">
        <div>
          <SectionHead title="Latest activity" href="/changelog" />
          {events.length === 0 ? (
            <p className="card p-6 text-sm text-zinc-500">
              Baseline snapshot captured — changes will appear here after the next sync detects a diff.
            </p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {events.slice(0, 8).map((e) => (
                <EventCard key={e.id} event={e} />
              ))}
            </div>
          )}
        </div>

        <aside className="space-y-8">
          <div>
            <SectionHead title="Freshest models" />
            <ul className="card divide-y divide-zinc-800/60 text-sm">
              {fresh.map((g) => (
                <li key={g.id} className="flex items-center justify-between gap-2 px-4 py-2.5">
                  <Link href={`/m/${g.id}`} className="truncate transition-colors hover:text-emerald-400">
                    {g.name}
                  </Link>
                  <span className="shrink-0 text-xs tabular-nums text-zinc-500">
                    {g.best ? `${fmtPerM(g.best.input)}/${fmtPerM(g.best.output)}` : "—"}
                  </span>
                </li>
              ))}
            </ul>
          </div>
          {drops.length > 0 && (
            <div>
              <SectionHead title="Biggest price drops" />
              <ul className="card divide-y divide-zinc-800/60 text-sm">
                {drops.map((d) => (
                  <li key={d.key} className="flex items-center justify-between gap-2 px-4 py-2.5">
                    <span className="truncate">
                      {d.name} <span className="text-xs text-zinc-500">via {d.providerId}</span>
                    </span>
                    <span className="shrink-0 font-mono text-xs tabular-nums text-emerald-400">
                      ${d.oldV} → ${d.newV}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </aside>
      </section>

      <section>
        <SectionHead title="Cheapest frontier context" href="/browse" label="Browse all" />
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-zinc-800 text-left text-xs uppercase tracking-wide text-zinc-500">
                <th className="px-4 py-3 font-medium">Model</th>
                <th className="px-4 py-3 text-right font-medium">Best input /M</th>
                <th className="px-4 py-3 text-right font-medium">Best output /M</th>
                <th className="px-4 py-3 text-right font-medium">Context</th>
                <th className="px-4 py-3 text-right font-medium">Providers</th>
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
                        <Link href={`/m/${g.id}`} className="transition-colors hover:text-emerald-400">
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
