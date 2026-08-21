import Link from "next/link";
import { getCatalog, getEvents, getNews } from "@/lib/data";
import { EventCard } from "@/components/event-card";
import { fmtPerM, fmtTokens, fmtAgo } from "@/lib/format";
import type { Event, NewsItem } from "@/lib/pipeline/types";

function SectionHead({ title, href, label = "View all" }: { title: string; href?: string; label?: string }) {
  return (
    <div className="mb-5 flex items-center justify-between gap-4">
      <h2 className="font-hand text-3xl font-bold tracking-tight text-black sm:text-4xl">{title}</h2>
      {href && (
        <Link
          href={href}
          className="shrink-0 rounded-full border border-black/15 bg-white px-3 py-1 text-xs font-medium text-black/60 transition-colors hover:border-black hover:text-black"
        >
          {label} →
        </Link>
      )}
    </div>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="card-flat px-4 py-3">
      <div className="text-2xl font-bold tabular-nums text-black">{value}</div>
      <div className="mono-label mt-0.5">{label}</div>
    </div>
  );
}

function NewsCard({ item, modelId, modelName }: { item: NewsItem; modelId?: string; modelName?: string }) {
  return (
    <article className="card lift flex flex-col gap-2 p-4">
      <div className="flex items-center gap-1.5 text-xs text-black/45">
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
        className="line-clamp-2 font-medium leading-snug text-black transition-colors hover:text-blue-600"
      >
        {item.title}
      </a>
      {modelId && (
        <div className="mt-auto pt-1">
          <Link
            href={`/m/${modelId}`}
            className="inline-flex items-center rounded-full border border-black/15 bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-700 transition-colors hover:border-blue-600"
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
    <div className="space-y-16">
      <section className="relative">
        <div className="grid-paper absolute inset-x-0 top-0 -z-10 h-full [mask-image:radial-gradient(ellipse_at_top,black_20%,transparent_70%)]" />
        <div className="mx-auto max-w-3xl pt-6 text-center sm:pt-10">
          <span className="pill mx-auto">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            </span>
            Live · diffed hourly from models.dev
          </span>
          <h1 className="mt-6 text-4xl font-bold leading-[1.05] tracking-tight text-black sm:text-6xl">
            Every AI model. Every provider.{" "}
            <span className="wavy wavy-blue">Every change.</span>
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg font-medium text-black/55">
            Live comparison of model prices across inference providers, plus a changelog of releases, price
            moves and deprecations — diffed hourly from open data.
          </p>
          <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/browse"
              className="rounded-md border-2 border-black bg-black px-5 py-2.5 text-sm font-semibold text-white shadow-[4px_4px_0_0_rgba(0,0,0,0.25)] transition-all hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0_0_rgba(0,0,0,0.25)]"
            >
              Browse models
            </Link>
            <Link
              href="/changelog"
              className="rounded-md border-2 border-black bg-white px-5 py-2.5 text-sm font-semibold text-black shadow-[4px_4px_0_0_rgba(0,0,0,1)] transition-all hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0_0_rgba(0,0,0,1)]"
            >
              See what changed
            </Link>
          </div>
          <div className="card-flat mx-auto mt-9 max-w-md p-4 text-left font-mono text-sm">
            <div className="min-h-[24px]">
              <span className="mr-2 text-black/35">$</span>
              llm-pulse watch --all-providers
              <span className="ml-1 inline-block h-4 w-2 animate-pulse bg-black/40 align-middle" />
            </div>
            <div className="my-2 h-px w-full bg-black/10" />
            <div className="flex items-center justify-between text-[10px] uppercase tracking-widest text-black/35">
              <span>LLM PULSE · open data</span>
              <span>{s.models}_models_indexed</span>
            </div>
          </div>
        </div>

        <div className="mt-12 grid grid-cols-2 gap-3 border-y-2 border-black py-6 sm:grid-cols-3 lg:grid-cols-6">
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
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
            <p className="card-dashed p-6 text-sm text-black/50">
              Baseline snapshot captured — changes will appear here after the next sync detects a diff.
            </p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {events.slice(0, 8).map((e) => (
                <EventCard key={e.id} event={e} />
              ))}
            </div>
          )}
        </div>

        <aside className="space-y-8">
          <div>
            <SectionHead title="Freshest models" />
            <ul className="card divide-y divide-black/10 text-sm">
              {fresh.map((g) => (
                <li key={g.id} className="flex items-center justify-between gap-2 px-4 py-2.5">
                  <Link href={`/m/${g.id}`} className="truncate font-medium transition-colors hover:text-blue-600">
                    {g.name}
                  </Link>
                  <span className="shrink-0 font-mono text-xs tabular-nums text-black/50">
                    {g.best ? `${fmtPerM(g.best.input)}/${fmtPerM(g.best.output)}` : "—"}
                  </span>
                </li>
              ))}
            </ul>
          </div>
          {drops.length > 0 && (
            <div>
              <SectionHead title="Biggest price drops" />
              <ul className="card divide-y divide-black/10 text-sm">
                {drops.map((d) => (
                  <li key={d.key} className="flex items-center justify-between gap-2 px-4 py-2.5">
                    <span className="truncate">
                      {d.name} <span className="text-xs text-black/45">via {d.providerId}</span>
                    </span>
                    <span className="shrink-0 font-mono text-xs tabular-nums font-semibold text-emerald-600">
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
          <table className="table-base min-w-[640px]">
            <thead>
              <tr>
                <th>Model</th>
                <th className="text-right">Best input /M</th>
                <th className="text-right">Best output /M</th>
                <th className="text-right">Context</th>
                <th className="text-right">Providers</th>
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
                    <tr key={g.id}>
                      <td>
                        <Link href={`/m/${g.id}`} className="font-medium transition-colors hover:text-blue-600">
                          {g.name}
                        </Link>
                        <span className="ml-2 text-xs text-black/45">{g.labId}</span>
                      </td>
                      <td className="text-right font-mono tabular-nums">{fmtPerM(g.best!.input)}</td>
                      <td className="text-right font-mono tabular-nums">{fmtPerM(g.best!.output)}</td>
                      <td className="text-right font-mono tabular-nums">{fmtTokens(ctx)}</td>
                      <td className="text-right tabular-nums text-black/55">{g.listings.length}</td>
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
