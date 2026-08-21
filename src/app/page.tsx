import Link from "next/link";
import { getCatalog, getEvents, getNews } from "@/lib/data";
import { getBenchmarkBoards } from "@/lib/data/benchmarks";
import { capabilityAdoption, priceBuckets } from "@/lib/data/stats";
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

function Stat({ value, label, href }: { value: string; label: string; href?: string }) {
  const inner = (
    <>
      <div className="text-2xl font-bold tabular-nums text-black">{value}</div>
      <div className="mono-label mt-0.5">{label}</div>
    </>
  );
  return href ? (
    <Link
      href={href}
      className="card-flat lift block px-4 py-3 transition-colors hover:border-blue-600"
    >
      {inner}
    </Link>
  ) : (
    <div className="card-flat px-4 py-3">{inner}</div>
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

interface Drop {
  key: string;
  name: string;
  providerId: string;
  oldV: number;
  newV: number;
  date: string;
}

function priceDrops(events: Event[]): Drop[] {
  const drops: Drop[] = [];
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

function weekDigest(events: Event[]) {
  const cutoff = Date.now() - 7 * 86_400_000;
  const recent = events.filter((e) => new Date(`${e.date}T00:00:00Z`).getTime() >= cutoff);
  const count = (t: Event["type"]) => recent.filter((e) => e.type === t).length;
  let biggest: { name: string; id: string | null; oldV: number; newV: number } | null = null;
  for (const e of recent) {
    if (e.type !== "repriced") continue;
    for (const c of e.changes) {
      if (c.field === "cost.input" && typeof c.old === "number" && typeof c.new === "number" && c.new < c.old) {
        if (!biggest || c.old / c.new > biggest.oldV / biggest.newV) {
          biggest = { name: e.modelName, id: e.canonicalId, oldV: c.old, newV: c.new };
        }
      }
    }
  }
  return {
    total: recent.length,
    repriced: count("repriced"),
    added: count("model_added"),
    deprecated: count("deprecated"),
    biggest,
  };
}

function MiniBar({ pct, color = "bg-blue-600" }: { pct: number; color?: string }) {
  return (
    <div className="h-1.5 min-w-10 flex-1 overflow-hidden rounded-sm border border-black bg-white">
      <div className={`h-full ${color}`} style={{ width: `${Math.max(2, Math.min(100, pct * 100))}%` }} />
    </div>
  );
}

export default async function HomePage() {
  const [catalog, events, news, boards] = await Promise.all([
    getCatalog(),
    getEvents(),
    getNews(),
    getBenchmarkBoards(),
  ]);
  const s = catalog.stats;
  const fresh = [...catalog.groups]
    .sort((a, b) => (b.canonical?.releaseDate ?? "").localeCompare(a.canonical?.releaseDate ?? ""))
    .slice(0, 6);
  const drops = priceDrops(events);
  const digest = weekDigest(events);
  const modelNameOf = (id: string) => catalog.groupById.get(id)?.name;

  const valueBoards = boards
    .map((b) => ({
      board: b,
      leaders: [...b.entries]
        .filter((e) => e.pointsPerDollar != null && Number.isFinite(e.pointsPerDollar))
        .sort((a, b) => (b.pointsPerDollar ?? 0) - (a.pointsPerDollar ?? 0))
        .slice(0, 5),
    }))
    .filter((x) => x.leaders.length >= 3)
    .sort((a, b) => b.board.entries.length - a.board.entries.length)
    .slice(0, 2);

  const caps = capabilityAdoption(catalog.groups).slice(0, 6);
  const buckets = priceBuckets(catalog.groups);
  const bucketMax = Math.max(...buckets.map((b) => b.count), 1);

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
          <Stat value={String(s.models)} label="models" href="/browse" />
          <Stat value={String(s.providers)} label="providers" href="/providers" />
          <Stat value={String(s.listings)} label="listings" />
          <Stat value={String(s.labs)} label="labs" href="/trends" />
          <Stat value={String(s.openWeights)} label="open weights" href="/trends" />
          <Stat value={String(s.deprecated)} label="deprecated" href="/deprecations" />
        </div>
      </section>

      <section>
        <SectionHead title="The last 7 days" href="/changelog" label="Full changelog" />
        {digest.total === 0 ? (
          <p className="card-dashed p-6 text-sm text-black/50">
            No diffs recorded in the past week — the hourly sync will populate this as the landscape moves.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Link href="/changelog" className="card-flat lift p-4 transition-colors hover:border-purple-600">
              <div className="font-mono text-2xl font-bold tabular-nums text-purple-700">{digest.repriced}</div>
              <div className="mono-label mt-0.5">repricings</div>
            </Link>
            <Link href="/changelog" className="card-flat lift p-4 transition-colors hover:border-emerald-600">
              <div className="font-mono text-2xl font-bold tabular-nums text-emerald-700">{digest.added}</div>
              <div className="mono-label mt-0.5">new models</div>
            </Link>
            <Link href="/deprecations" className="card-flat lift p-4 transition-colors hover:border-red-500">
              <div className="font-mono text-2xl font-bold tabular-nums text-red-600">{digest.deprecated}</div>
              <div className="mono-label mt-0.5">deprecations</div>
            </Link>
            {digest.biggest ? (
              <Link
                href={digest.biggest.id ? `/m/${digest.biggest.id}` : "/changelog"}
                className="card-flat lift p-4 transition-colors hover:border-blue-600"
              >
                <div className="truncate font-mono text-lg font-bold text-blue-700">
                  −{Math.round((1 - digest.biggest.newV / digest.biggest.oldV) * 100)}% input
                </div>
                <div className="mono-label mt-0.5 truncate">
                  {digest.biggest.name} · ${digest.biggest.oldV}→${digest.biggest.newV}
                </div>
              </Link>
            ) : (
              <div className="card-flat p-4">
                <div className="font-mono text-2xl font-bold text-black/25">—</div>
                <div className="mono-label mt-0.5">no input-price cuts</div>
              </div>
            )}
          </div>
        )}
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

      {valueBoards.length > 0 && (
        <section>
          <SectionHead title="Best value right now" href="/benchmarks" label="All leaderboards" />
          <p className="-mt-2 mb-5 max-w-2xl text-sm text-black/55">
            Benchmark score per blended dollar (3×input + output)⁄4 — what each model actually buys you.
          </p>
          <div className="grid gap-4 md:grid-cols-2">
            {valueBoards.map(({ board, leaders }) => (
              <div key={board.slug} className="card p-4">
                <div className="mb-3 flex items-baseline justify-between gap-2">
                  <h3 className="font-hand text-2xl font-bold text-black">{board.name}</h3>
                  <Link
                    href={`/benchmarks/${board.slug}`}
                    className="shrink-0 text-xs font-medium text-blue-600 underline decoration-wavy underline-offset-4 hover:text-blue-700"
                  >
                    board →
                  </Link>
                </div>
                <ol className="divide-y divide-black/10 text-sm">
                  {leaders.map((e, i) => (
                    <li key={e.groupId} className="flex items-center gap-2 py-2">
                      <span className="w-4 shrink-0 tabular-nums text-black/35">{i + 1}.</span>
                      <Link href={`/m/${e.groupId}`} className="min-w-0 flex-1 truncate font-medium transition-colors hover:text-blue-600">
                        {e.groupName}
                      </Link>
                      <span className="shrink-0 font-mono text-xs tabular-nums text-black/45">{e.score}</span>
                      <span className="w-16 shrink-0 text-right font-mono text-xs font-semibold tabular-nums text-emerald-700">
                        {Math.round(e.pointsPerDollar!).toLocaleString("en-US")} pts/$
                      </span>
                    </li>
                  ))}
                </ol>
              </div>
            ))}
          </div>
        </section>
      )}

      <section>
        <SectionHead title="Market snapshot" href="/trends" label="Full trends" />
        <div className="grid gap-4 md:grid-cols-2">
          <div className="card p-4">
            <div className="mono-label mb-3">capability adoption · {catalog.groups.length} models</div>
            <ul className="space-y-2.5">
              {caps.map((c) => (
                <li key={c.label} className="flex items-center gap-3 text-sm">
                  <span className="w-36 shrink-0 truncate text-black/60">{c.label}</span>
                  <MiniBar pct={c.pct} />
                  <span className="w-14 shrink-0 text-right font-mono text-xs tabular-nums text-black/70">
                    {Math.round(c.pct * 100)}%
                  </span>
                </li>
              ))}
            </ul>
          </div>
          <div className="card p-4">
            <div className="mono-label mb-3">blended price distribution</div>
            <ul className="space-y-2.5">
              {buckets.map((b) => (
                <li key={b.label} className="flex items-center gap-3 text-sm">
                  <span className="w-20 shrink-0 font-mono text-xs text-black/60">{b.label}</span>
                  <MiniBar pct={b.count / bucketMax} color="bg-purple-500" />
                  <span className="w-8 shrink-0 text-right font-mono text-xs tabular-nums text-black/70">{b.count}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
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

      <section>
        <SectionHead title="Built for machines too" href="/llms.txt" label="llms.txt" />
        <div className="grid gap-4 md:grid-cols-3">
          <div className="card-flat p-4">
            <div className="mono-label mb-2">JSON APIs</div>
            <ul className="space-y-1 font-mono text-xs text-black/60">
              <li><a href="/api/models.json" className="underline decoration-black/20 underline-offset-2 hover:text-black">/api/models.json</a> — catalog + best prices</li>
              <li><a href="/api/prices.json" className="underline decoration-black/20 underline-offset-2 hover:text-black">/api/prices.json</a> — every listing</li>
              <li><a href="/api/events.json" className="underline decoration-black/20 underline-offset-2 hover:text-black">/api/events.json</a> — changelog feed</li>
              <li><a href="/api/benchmarks.json" className="underline decoration-black/20 underline-offset-2 hover:text-black">/api/benchmarks.json</a> — scores + pts/$</li>
            </ul>
          </div>
          <div className="card-flat p-4">
            <div className="mono-label mb-2">Feeds</div>
            <ul className="space-y-1 font-mono text-xs text-black/60">
              <li><a href="/rss.xml" className="underline decoration-black/20 underline-offset-2 hover:text-black">/rss.xml</a> — all changes + news</li>
              <li><a href="/feeds/openai/rss.xml" className="underline decoration-black/20 underline-offset-2 hover:text-black">/feeds/&lt;lab&gt;/rss.xml</a> — per lab</li>
              <li><a href="/feed.json" className="underline decoration-black/20 underline-offset-2 hover:text-black">/feed.json</a> — JSON Feed 1.1</li>
            </ul>
          </div>
          <div className="card-flat p-4">
            <div className="mono-label mb-2">Agents & embeds</div>
            <ul className="space-y-1 font-mono text-xs text-black/60">
              <li><a href="/llms.txt" className="underline decoration-black/20 underline-offset-2 hover:text-black">/llms.txt</a> — index for AI agents</li>
              <li><span>/badge/&lt;model&gt;.svg</span> — live price badge</li>
              <li><span>MCP server</span> — see <a href="/about" className="underline decoration-black/20 underline-offset-2 hover:text-black">about</a></li>
            </ul>
          </div>
        </div>
      </section>
    </div>
  );
}
