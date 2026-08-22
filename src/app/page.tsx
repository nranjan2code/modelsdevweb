import Link from "next/link";
import {
  getCatalog,
  getEvents,
  getNews,
  getSnapshotMeta,
  groupContext,
  groupReleaseDate,
} from "@/lib/data";
import { getAllPriceHistory } from "@/lib/data/history";
import {
  activityCalendar,
  headToHeads,
  labName,
  labScorecards,
  leadStory,
  modelOfWeek,
  moversLosers,
  pulseSeries,
  records,
  type HeadToHead,
  type LabScorecard,
  type LeadStory,
  type Mover,
} from "@/lib/data/story";
import { getBenchmarkBoards } from "@/lib/data/benchmarks";
import { benchmarkHome } from "@/lib/data/benchmark-links";
import { capabilityAdoption, priceBuckets } from "@/lib/data/stats";
import { EventCard } from "@/components/event-card";
import { Sparkline } from "@/components/price-history";
import { fmtPerM, fmtTokens, fmtAgo, fmtDate } from "@/lib/format";
import type { Event, NewsItem } from "@/lib/pipeline/types";

function SectionHead({
  title,
  href,
  label = "View all",
  external,
  eyebrow,
  tone = "",
}: {
  title: string;
  href?: string;
  label?: string;
  external?: boolean;
  eyebrow?: string;
  tone?: string;
}) {
  return (
    <div className="mb-5">
      {eyebrow && <p className={`mono-label mb-1 ${tone}`}>{eyebrow}</p>}
      <div className="flex items-center justify-between gap-4">
        <h2 className="font-hand text-3xl font-bold tracking-tight text-black sm:text-4xl">{title}</h2>
        {href &&
          (external ? (
            <a
              href={href}
              className="shrink-0 rounded-full border border-black/15 bg-white px-3 py-1 text-xs font-medium text-black/60 transition-colors hover:border-black hover:text-black"
            >
              {label} →
            </a>
          ) : (
            <Link
              href={href}
              className="shrink-0 rounded-full border border-black/15 bg-white px-3 py-1 text-xs font-medium text-black/60 transition-colors hover:border-black hover:text-black"
            >
              {label} →
            </Link>
          ))}
      </div>
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

const LEAD_TONE: Record<LeadStory["kind"], { bar: string; eyebrow: string }> = {
  cut: { bar: "bg-emerald-500", eyebrow: "text-emerald-700" },
  hike: { bar: "bg-red-500", eyebrow: "text-red-600" },
  launch: { bar: "bg-blue-600", eyebrow: "text-blue-700" },
  context: { bar: "bg-purple-500", eyebrow: "text-purple-700" },
  sunset: { bar: "bg-red-500", eyebrow: "text-red-600" },
  quiet: { bar: "bg-black/30", eyebrow: "text-black/50" },
  baseline: { bar: "bg-black/30", eyebrow: "text-black/50" },
};

function LeadStoryCard({ story }: { story: LeadStory }) {
  const tone = LEAD_TONE[story.kind];
  return (
    <article className="card relative overflow-hidden p-6 pl-7 sm:p-8 sm:pl-9">
      <span className={`absolute inset-y-0 left-0 w-2 ${tone.bar}`} aria-hidden="true" />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_240px]">
        <div>
          <p className={`mono-label ${tone.eyebrow}`}>{story.eyebrow}</p>
          <Link href={story.href} className="group block">
            <h2 className="mt-2 max-w-3xl text-3xl font-bold leading-[1.12] tracking-tight text-black transition-colors group-hover:text-blue-700 sm:text-4xl">
              {story.headline}
            </h2>
          </Link>
          <p className="mt-3 max-w-3xl text-base leading-relaxed text-black/60">{story.dek}</p>
          <div className="mt-5 flex flex-wrap items-center gap-2">
            {story.meta.map((m) => (
              <span
                key={m}
                className="rounded-full border border-black/15 bg-white px-2.5 py-1 font-mono text-xs tabular-nums text-black/70"
              >
                {m}
              </span>
            ))}
          </div>
          <Link
            href={story.href}
            className="mt-5 inline-flex items-center gap-1 text-sm font-semibold text-blue-600 underline decoration-wavy underline-offset-4 transition-colors hover:text-blue-800"
          >
            {story.ctaLabel} →
          </Link>
        </div>
      </div>
    </article>
  );
}

function MoverRow({ m, rank }: { m: Mover; rank: number }) {
  const inner = (
    <>
      <span className="w-5 shrink-0 tabular-nums text-black/35">{rank}.</span>
      <span className="min-w-0 flex-1 truncate">
        {m.name}
        {m.providerId && <span className="ml-1 text-xs text-black/40">via {m.providerId}</span>}
      </span>
      <span className="hidden shrink-0 font-mono text-[11px] tabular-nums text-black/50 sm:inline">
        {fmtPerM(m.from)}→{fmtPerM(m.to)}
      </span>
      <span
        className={`w-14 shrink-0 rounded-full border px-1.5 py-0.5 text-right font-mono text-xs font-bold tabular-nums ${
          m.pct < 0 ? "border-emerald-600/30 bg-emerald-50 text-emerald-700" : "border-red-500/30 bg-red-50 text-red-600"
        }`}
      >
        {m.pct > 0 ? "+" : ""}
        {(m.pct * 100).toFixed(0)}%
      </span>
    </>
  );
  const cls = "flex items-center gap-2 py-2.5";
  return m.id ? (
    <Link href={`/m/${m.id}`} className={`${cls} transition-colors hover:text-blue-700`}>
      {inner}
    </Link>
  ) : (
    <div className={cls}>{inner}</div>
  );
}

function MoversBoard({ title, items, empty }: { title: string; items: Mover[]; empty: string }) {
  return (
    <div className="card p-4">
      <h3 className="mb-1 flex items-baseline justify-between font-hand text-2xl font-bold text-black">
        {title}
        <span className="mono-label">input /M · 7d</span>
      </h3>
      {items.length === 0 ? (
        <p className="py-6 text-center text-sm text-black/40">{empty}</p>
      ) : (
        <ol className="divide-y divide-black/10 text-sm">
          {items.map((m, i) => (
            <li key={`${m.id}-${i}`}>
              <MoverRow m={m} rank={i + 1} />
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function PulseCard({ series }: { series: ReturnType<typeof pulseSeries> }) {
  if (series.length < 2) return null;
  const first = series[0];
  const last = series[series.length - 1];
  const deltaPct = (last.median - first.median) / first.median;
  const down = deltaPct <= 0;
  return (
    <div className="card p-4">
      <p className="mono-label">Frontier price index</p>
      <div className="mt-2 flex items-end justify-between gap-2">
        <div className="font-mono text-2xl font-bold tabular-nums text-black">
          {fmtPerM(last.median)}
          <span className="text-xs font-medium text-black/45"> /M</span>
        </div>
        <span
          className={`rounded-full border px-2 py-0.5 font-mono text-xs font-semibold tabular-nums ${
            down ? "border-emerald-600/30 bg-emerald-50 text-emerald-700" : "border-red-500/30 bg-red-50 text-red-600"
          }`}
        >
          {down ? "▼" : "▲"} {Math.abs(deltaPct * 100).toFixed(1)}%
        </span>
      </div>
      <div className="mt-3">
        <Sparkline values={series.map((p) => p.median)} width={272} height={36} />
      </div>
      <p className="mt-2 text-xs leading-snug text-black/45">
        Median blended price across {last.models} frontier models · since {fmtDate(first.date)}.
      </p>
    </div>
  );
}

function HeatStrip({ cal }: { cal: ReturnType<typeof activityCalendar> }) {
  const max = Math.max(...cal.map((d) => d.count), 1);
  return (
    <div className="flex items-stretch gap-1" role="img" aria-label="Model changes per day over the last two weeks">
      {cal.map((d) => {
        const ratio = d.count / max;
        const tone =
          d.count === 0
            ? "bg-white"
            : ratio <= 0.25
              ? "bg-blue-200"
              : ratio <= 0.5
                ? "bg-blue-400"
                : ratio <= 0.75
                  ? "bg-blue-600"
                  : "bg-blue-900";
        const short = new Date(`${d.date}T00:00:00Z`).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          timeZone: "UTC",
        });
        return (
          <span
            key={d.date}
            title={`${short}: ${d.count} change${d.count === 1 ? "" : "s"}`}
            className={`h-8 min-w-0 flex-1 rounded-sm border border-black ${tone}`}
          />
        );
      })}
    </div>
  );
}

function NewsCard({
  item,
  modelId,
  modelName,
  priceChip,
}: {
  item: NewsItem;
  modelId?: string;
  modelName?: string;
  priceChip?: string | null;
}) {
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
      {(modelId || priceChip) && (
        <div className="mt-auto flex flex-wrap items-center gap-1.5 pt-1">
          {modelId && (
            <Link
              href={`/m/${modelId}`}
              className="inline-flex items-center rounded-full border border-black/15 bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-700 transition-colors hover:border-blue-600"
            >
              {modelName ?? modelId}
            </Link>
          )}
          {modelId && priceChip && (
            <Link
              href={`/m/${modelId}`}
              className="inline-flex items-center rounded-full border border-emerald-600/30 bg-emerald-50 px-2 py-0.5 font-mono text-[11px] tabular-nums text-emerald-700 transition-colors hover:border-emerald-600"
            >
              {priceChip}
            </Link>
          )}
        </div>
      )}
    </article>
  );
}

function Spotlight({ spot }: { spot: NonNullable<ReturnType<typeof modelOfWeek>> }) {
  const facts = [
    spot.releaseDate ? `released ${fmtDate(spot.releaseDate)}` : null,
    spot.openWeights ? "open weights" : null,
    spot.topBenchmark ? `${spot.topBenchmark.name}: ${spot.topBenchmark.score}` : null,
  ].filter(Boolean) as string[];
  return (
    <article className="card lift relative overflow-hidden p-6">
      <span className="absolute right-0 top-0 rounded-bl-lg border-b-2 border-l-2 border-black bg-amber-100 px-3 py-1 font-hand text-sm font-bold">
        this week’s pick
      </span>
      <p className="mono-label !text-purple-600">Model of the week</p>
      <Link href={`/m/${spot.id}`} className="group block">
        <h3 className="mt-1.5 font-hand text-3xl font-bold tracking-tight text-black transition-colors group-hover:text-blue-700">
          {spot.name}
        </h3>
      </Link>
      <p className="mono-label mt-0.5">{labName(spot.labId)}</p>
      {spot.description && <p className="mt-3 line-clamp-3 text-sm leading-relaxed text-black/60">{spot.description}</p>}
      <div className="mt-4 flex flex-wrap gap-1.5">
        {facts.map((f) => (
          <span key={f} className="rounded-full border border-black/15 bg-white px-2.5 py-1 text-xs text-black/70">
            {f}
          </span>
        ))}
      </div>
      <Link
        href={`/m/${spot.id}`}
        className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-blue-600 underline decoration-wavy underline-offset-4 transition-colors hover:text-blue-800"
      >
        Open profile →
      </Link>
    </article>
  );
}

function HeadToHeadCard({ h2h }: { h2h: HeadToHead }) {
  const blendL = (h2h.left.input * 3 + h2h.left.output) / 4;
  const blendR = (h2h.right.input * 3 + h2h.right.output) / 4;
  const rowCls = (cheaper: boolean) =>
    cheaper ? "font-mono font-bold tabular-nums text-emerald-700" : "font-mono tabular-nums text-black/70";
  return (
    <div className="card flex flex-col p-4">
      <p className="mono-label">Head to head</p>
      <div className="mt-3 space-y-2 text-sm">
        {[h2h.left, h2h.right].map((side, i) => {
          const cheaper = i === 0 ? blendL <= blendR : blendR < blendL;
          return (
            <div key={side.id} className="flex items-center justify-between gap-2">
              <Link
                href={`/m/${side.id}`}
                className="min-w-0 truncate font-medium text-black transition-colors hover:text-blue-600"
              >
                {side.name}
              </Link>
              <span className={rowCls(cheaper)}>
                {fmtPerM(side.input)}/{fmtPerM(side.output)}
              </span>
            </div>
          );
        })}
      </div>
      <Link
        href={`/compare?models=${encodeURIComponent(h2h.left.id)},${encodeURIComponent(h2h.right.id)}`}
        className="mt-auto pt-3 text-sm font-semibold text-blue-600 underline decoration-wavy underline-offset-4 transition-colors hover:text-blue-800"
      >
        Compare side by side →
      </Link>
    </div>
  );
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
    <div className="h-1.5 min-w-6 flex-1 overflow-hidden rounded-sm border border-black bg-white">
      <div className={`h-full ${color}`} style={{ width: `${Math.max(2, Math.min(100, pct * 100))}%` }} />
    </div>
  );
}

const fmtShort = (iso: string | null): string =>
  iso
    ? new Date(`${iso.slice(0, 10)}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })
    : "—";

export default async function HomePage() {
  const [catalog, events, news, boards, history, meta] = await Promise.all([
    getCatalog(),
    getEvents(),
    getNews(),
    getBenchmarkBoards(),
    getAllPriceHistory(),
    getSnapshotMeta(),
  ]);
  const s = catalog.stats;
  const syncedAgo = fmtAgo(meta.fetchedAt);

  const seenName = new Set<string>();
  const fresh = [...catalog.groups]
    .sort((a, b) => (groupReleaseDate(b) ?? "").localeCompare(groupReleaseDate(a) ?? ""))
    .filter((g) => {
      const key = g.name.toLowerCase();
      if (seenName.has(key)) return false;
      seenName.add(key);
      return true;
    })
    .slice(0, 6);

  const digest = weekDigest(events);
  const modelNameOf = (id: string) => catalog.groupById.get(id)?.name;

  const lead = leadStory(events, catalog.groupById);
  const movers = moversLosers(events, 7);
  const recs = records(catalog);
  const labCards = labScorecards(catalog, events).slice(0, 8);
  const spot = modelOfWeek(catalog.groups);
  const h2hs = headToHeads(catalog.groups, catalog.labs).slice(0, 2);
  const cal = activityCalendar(events, 14);

  const frontierIds = new Set(
    catalog.groups
      .filter((g) => g.best != null && !g.free && (groupContext(g) ?? 0) >= 200_000)
      .map((g) => g.id),
  );
  const pulse = pulseSeries(history, frontierIds);

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
  const seenFrontier = new Set<string>();

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
            Live{syncedAgo ? ` · synced ${syncedAgo}` : ""} · diffed hourly from models.dev
          </span>
          <h1 className="mt-6 text-4xl font-bold leading-[1.05] tracking-tight text-black sm:text-6xl">
            Every AI model. Every provider.{" "}
            <span className="wavy wavy-blue">Every change.</span>
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg font-medium text-black/55">
            The front page of the AI model market: prices, releases and repricings tracked hourly — with the
            numbers to prove who is cheapest, newest and fastest-moving.
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

      <section aria-label="Top story">
        <LeadStoryCard story={lead} />
      </section>

      <section className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-8">
          <div>
            <SectionHead title="The tape" href="/changelog" eyebrow="Movers & losers · 7 days" label="Full changelog" />            <div className="grid gap-4 md:grid-cols-2">
              <MoversBoard title="Fallers" items={movers.fallers} empty="No input-price cuts this week." />
              <MoversBoard title="Risers" items={movers.risers} empty="No price hikes this week." />
            </div>
          </div>

          <div>
            <SectionHead title="Latest activity" href="/changelog" eyebrow="The wire" />
            {events.length === 0 ? (
              <p className="card-dashed p-6 text-sm text-black/50">
                Baseline snapshot captured — changes will appear here after the next sync detects a diff.
              </p>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                {events.slice(0, 6).map((e) => (
                  <EventCard key={e.id} event={e} />
                ))}
              </div>
            )}
          </div>
        </div>

        <aside className="space-y-6">
          <div className="card-flat p-4">
            <p className="mono-label mb-2">Follow the pulse</p>
            <div className="flex flex-wrap gap-1.5">
              {[
                { href: "/rss.xml", label: "RSS" },
                { href: "/feed.json", label: "JSON Feed" },
                { href: "/news", label: "News" },
              ].map((l) => (
                <a
                  key={l.href}
                  href={l.href}
                  className="inline-flex items-center rounded-full border border-black bg-white px-3 py-1 text-xs font-semibold shadow-[2px_2px_0_0_rgba(0,0,0,1)] transition-all hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[1px_1px_0_0_rgba(0,0,0,1)]"
                >
                  {l.label}
                </a>
              ))}
              <Link
                href="/digest"
                className="inline-flex items-center rounded-full border border-black bg-amber-100 px-3 py-1 text-xs font-semibold shadow-[2px_2px_0_0_rgba(0,0,0,1)] transition-all hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[1px_1px_0_0_rgba(0,0,0,1)]"
              >
                Weekly recap
              </Link>
            </div>
          </div>

          <PulseCard series={pulse} />

          <div>
            <SectionHead title="Freshest models" />
            <ul className="card divide-y divide-black/10 text-sm">
              {fresh.map((g) => {
                const series = history.get(g.id)?.filter((p) => p.input != null).map((p) => p.input!) ?? [];
                return (
                  <li key={g.id} className="flex items-center gap-2 px-4 py-2.5">
                    <div className="min-w-0 flex-1">
                      <Link href={`/m/${g.id}`} className="block truncate font-medium transition-colors hover:text-blue-600">
                        {g.name}
                      </Link>
                      <span className="mono-label">{g.best ? `${fmtPerM(g.best.input)}/${fmtPerM(g.best.output)}` : g.free ? "Free" : "—"}</span>
                    </div>
                    {series.length >= 2 && <Sparkline values={series} width={56} height={20} />}
                  </li>
                );
              })}
            </ul>
          </div>
        </aside>
      </section>

      <section>
        <SectionHead title="Two weeks of moves" href="/digest" label="Weekly recap →" eyebrow="At a glance" />
        <HeatStrip cal={cal} />
        <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-black/55">
          <span>
            <strong className="font-mono tabular-nums text-purple-700">{digest.repriced}</strong> repricings
          </span>
          <span>
            <strong className="font-mono tabular-nums text-emerald-700">{digest.added}</strong> launches
          </span>
          <span>
            <strong className="font-mono tabular-nums text-red-600">{digest.deprecated}</strong> sunsets
          </span>
          <span className="text-black/40">
            in the past 7 days —{" "}
            <Link href="/digest" className="font-medium text-blue-600 underline decoration-wavy underline-offset-4 hover:text-blue-800">
              read the recap
            </Link>
          </span>
        </div>
      </section>

      <section>
        <SectionHead title="Lab scoreboards" href="/providers" label="All providers" eyebrow="The race" tone="!text-purple-600" />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {labCards.map((c: LabScorecard) => (
            <Link key={c.id} href={`/lab/${c.id}`} className="card-flat lift block p-4 transition-colors hover:border-blue-600">
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-semibold text-black">{labName(c.id)}</span>
                {c.weeklyEvents > 0 && (
                  <span className="rounded-full border border-purple-600/30 bg-purple-50 px-2 py-0.5 text-[11px] font-semibold text-purple-700">
                    +{c.weeklyEvents} this wk
                  </span>
                )}
              </div>
              <dl className="mt-2 space-y-1 font-mono text-xs tabular-nums text-black/60">
                <div className="flex justify-between">
                  <dt>models</dt>
                  <dd className="font-semibold text-black">{c.models}</dd>
                </div>
                <div className="flex justify-between">
                  <dt>median /M</dt>
                  <dd>{c.medianBlend != null ? fmtPerM(c.medianBlend) : "—"}</dd>
                </div>
                <div className="flex justify-between">
                  <dt>cheapest in</dt>
                  <dd>{c.cheapestInput != null ? fmtPerM(c.cheapestInput) : "—"}</dd>
                </div>
                <div className="flex justify-between">
                  <dt>newest drop</dt>
                  <dd>{fmtShort(c.lastRelease)}</dd>
                </div>
                {c.openWeights > 0 && (
                  <div className="flex justify-between">
                    <dt>open weights</dt>
                    <dd>{c.openWeights}</dd>
                  </div>
                )}
              </dl>
            </Link>
          ))}
        </div>
      </section>

      {(spot || h2hs.length > 0) && (
        <section className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
          {spot && <Spotlight spot={spot} />}
          {h2hs.length > 0 && (
            <div className="grid content-start gap-4">
              {h2hs.map((h) => (
                <HeadToHeadCard key={`${h.left.id}-vs-${h.right.id}`} h2h={h} />
              ))}
            </div>
          )}
        </section>
      )}

      {news.length > 0 && (
        <section>
          <SectionHead title="In the news" href="/news" eyebrow="Around the web" />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {news.slice(0, 6).map((n) => {
              const modelId = n.modelIds.find((id) => catalog.groupById.has(id));
              const group = modelId ? catalog.groupById.get(modelId) : undefined;
              const chip =
                group?.best != null ? `${fmtPerM(group.best.input)}/${fmtPerM(group.best.output)} · ${fmtTokens(groupContext(group))}` : null;
              return (
                <NewsCard
                  key={n.id}
                  item={n}
                  modelId={modelId}
                  modelName={modelId ? modelNameOf(modelId) : undefined}
                  priceChip={chip}
                />
              );
            })}
          </div>
        </section>
      )}

      {valueBoards.length > 0 && (
        <section>
          <SectionHead title="Best value right now" href="/benchmarks" eyebrow="Points per dollar" label="All leaderboards" />
          <p className="-mt-2 mb-5 max-w-2xl text-sm text-black/55">
            Benchmark score per blended dollar (3×input + output)⁄4 — what each model actually buys you.
          </p>
          <div className="grid gap-4 md:grid-cols-2">
            {valueBoards.map(({ board, leaders }) => (
              <div key={board.slug} className="card p-4">
                <div className="mb-3 flex items-baseline justify-between gap-2">
                  <h3 className="font-hand text-2xl font-bold text-black">
                    {benchmarkHome(board.name) ? (
                      <a
                        href={benchmarkHome(board.name)!}
                        target="_blank"
                        rel="noreferrer"
                        title={`Official ${board.name} benchmark`}
                        className="underline decoration-wavy decoration-black/25 underline-offset-4 transition-colors hover:text-blue-600 hover:decoration-blue-600"
                      >
                        {board.name} ↗
                      </a>
                    ) : (
                      board.name
                    )}
                  </h3>
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
        <SectionHead title="Record watch" eyebrow="Standing superlatives" tone="!text-amber-600" href="/browse" label="Browse all" />
        <ol className="card divide-y divide-black/10">
          {recs.map((r, i) => (
            <li key={r.title} className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 px-4 py-3 text-sm">
              <span className="w-5 shrink-0 tabular-nums text-black/35">{i + 1}.</span>
              <span className="mono-label w-52 shrink-0 pt-0.5">{r.title}</span>
              <span className="min-w-0 flex-1 truncate font-medium">
                {r.id ? (
                  <Link href={`/m/${r.id}`} className="transition-colors hover:text-blue-600">
                    {r.holder}
                  </Link>
                ) : (
                  r.holder
                )}
              </span>
              <span className="font-mono text-xs font-semibold tabular-nums text-blue-700">{r.value}</span>
              {r.detail && <span className="w-full pl-8 text-xs text-black/40 sm:w-auto">{r.detail}</span>}
            </li>
          ))}
        </ol>
      </section>

      <section>
        <SectionHead title="Market snapshot" href="/trends" eyebrow="Where the market sits" label="Full trends" />
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="card p-4">
            <div className="mono-label mb-3">capability adoption · {catalog.groups.length} models</div>
            <ul className="space-y-2.5">
              {caps.map((c) => (
                <li key={c.label} className="flex items-center gap-2 text-sm sm:gap-3">
                  <span className="w-28 shrink-0 truncate text-black/60 sm:w-32">{c.label}</span>
                  <MiniBar pct={c.pct} />
                  <span className="w-12 shrink-0 text-right font-mono text-xs tabular-nums text-black/70">
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
                <li key={b.label} className="flex items-center gap-2 text-sm sm:gap-3">
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
        <SectionHead title="Cheapest frontier context" href="/browse" label="Browse all" eyebrow="Budget picks" />
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
                .filter((g) => g.best && (groupContext(g) ?? 0) >= 200_000)
                .sort((a, b) => a.best!.input - b.best!.input)
                .filter((g) => {
                  // models.dev sometimes carries the same model under several
                  // canonical labs — show each model once at its cheapest.
                  const key = g.name.toLowerCase();
                  if (seenFrontier.has(key)) return false;
                  seenFrontier.add(key);
                  return true;
                })
                .slice(0, 8)
                .map((g) => {
                  const ctx = groupContext(g);
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
        <SectionHead title="Built for machines too" href="/llms.txt" label="llms.txt" external eyebrow="APIs & feeds" />
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
