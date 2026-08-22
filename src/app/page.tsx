import Link from "next/link";
import {
  getCatalog,
  getEvents,
  getNews,
  getSnapshotMeta,
  groupContext,
  groupReleaseDate,
  getTrendingExternalModels,
  type ModelGroup,
} from "@/lib/data";
import { getAllPriceHistory } from "@/lib/data/history";
import {
  activityCalendar,
  headToHeads,
  labName,
  labScorecards,
  modelOfWeek,
  moversLosers,
  pulseSeries,
  records,
  type HeadToHead,
  type LabScorecard,
  type Mover,
} from "@/lib/data/story";
import { getBenchmarkBoards } from "@/lib/data/benchmarks";
import { benchmarkHome } from "@/lib/data/benchmark-links";
import { capabilityAdoption, priceBuckets } from "@/lib/data/stats";
import { EventCard, eventTarget } from "@/components/event-card";
import { Sparkline } from "@/components/price-history";
import { Badge, Bar, DeltaChip, EmptyState, SectionHead } from "@/components/ui";
import { fmtPerM, fmtTokens, fmtAgo, fmtDate } from "@/lib/format";
import type { Event, NewsItem } from "@/lib/pipeline/types";
import type { CompositeScore } from "@/lib/pipeline/external-types";

function Stat({ value, label, href }: { value: string; label: string; href?: string }) {
  const inner = (
    <>
      <div className="text-xl font-bold tabular-nums text-black">{value}</div>
      <div className="micro-label mt-0.5">{label}</div>
    </>
  );
  return href ? (
    <Link
      href={href}
      className="card-flat lift block px-3 py-2 transition-colors hover:border-accent"
    >
      {inner}
    </Link>
  ) : (
    <div className="card-flat px-3 py-2">{inner}</div>
  );
}

interface MarketBriefProps {
  series: ReturnType<typeof pulseSeries>;
  cut: Mover | null;
  launch: ModelGroup | null;
  hot: { group: ModelGroup; priceLabel: string; score: number } | null;
  moves: number;
  syncedAgo: string;
}

/**
 * The homepage's prime slot: a market-level briefing assembled from the
 * freshest data views — frontier index, steepest weekly move, newest launch,
 * momentum leader. Always meaningful regardless of whether a single event
 * qualifies as "news".
 */
function MarketBrief({ series, cut, launch, hot, moves, syncedAgo }: MarketBriefProps) {
  const hasIndex = series.length >= 2;
  const first = series[0];
  const last = series[series.length - 1];
  const deltaPct = hasIndex ? (last.median - first.median) / first.median : 0;
  const down = deltaPct <= 0;

  return (
    <article className="card relative overflow-hidden p-6 pl-7 sm:p-8 sm:pl-9">
      <span className="absolute inset-y-0 left-0 w-2 bg-accent" aria-hidden="true" />
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="mono-label text-accent-strong">Market briefing · synced {syncedAgo || "recently"} ago</p>
        <Link href="/changelog" className="text-xs font-medium text-accent underline decoration-wavy underline-offset-4 hover:text-accent-strong">
          full changelog →
        </Link>
      </div>

      <div className="mt-5 grid gap-6 lg:grid-cols-[1.3fr_1fr_1fr]">
        {hasIndex && (
          <div>
            <p className="mono-label">Frontier price index</p>
            <div className="mt-1.5 flex flex-wrap items-end gap-3">
              <span className="font-mono text-4xl font-bold tabular-nums tracking-tight text-black sm:text-5xl">
                {fmtPerM(last.median)}
              </span>
              <span className="mb-1">
                <DeltaChip down={down} pct={deltaPct} />
              </span>
            </div>
            <div className="mt-3 max-w-sm">
              <Sparkline values={series.map((p) => p.median)} width={320} height={56} />
            </div>
            <p className="mt-2 text-xs leading-snug text-black/45">
              Median blended /M across {last.models} frontier models · since {fmtDate(first.date)}.
            </p>
          </div>
        )}

        <div className={hasIndex ? "" : "lg:col-span-2"}>
          <p className="mono-label text-special">Steepest move · 7 days</p>
          {cut ? (
            <>
              <Link href={`/m/${cut.id ?? ""}`} className="group mt-1.5 block">
                <span className="block truncate text-lg font-bold text-black transition-colors group-hover:text-accent-strong">
                  {cut.name}
                </span>
              </Link>
              <div className="mt-1.5 font-mono text-sm tabular-nums text-black/60">
                {fmtPerM(cut.from)} →{" "}
                <strong className="font-bold text-pos">{fmtPerM(cut.to)}</strong> /M
              </div>
              <div className="mt-2 flex items-center gap-2">
                <Badge tone={down ? "pos" : "neg"} mono bold>
                  {(cut.pct * 100).toFixed(0)}%
                </Badge>
                {cut.providerId && <span className="text-xs text-black/45">via {cut.providerId}</span>}
              </div>
            </>
          ) : (
            <p className="mt-2 text-sm leading-snug text-black/45">
              No input-price cuts this week — the tape is quiet. Watch the{" "}
              <Link href="/changelog?type=repriced&days=14" className="underline decoration-wavy underline-offset-2 hover:text-accent-strong">
                repricing feed
              </Link>
              .
            </p>
          )}
        </div>

        <div>
          <p className="mono-label text-pos">Freshest launch</p>
          {launch ? (
            <>
              <Link href={`/m/${launch.id}`} className="group mt-1.5 block">
                <span className="block truncate text-lg font-bold text-black transition-colors group-hover:text-accent-strong">
                  {launch.name}
                </span>
              </Link>
              <div className="mt-1.5 font-mono text-sm tabular-nums text-black/60">
                {launch.best ? (
                  <>
                    <strong className="font-bold text-black">{fmtPerM(launch.best.input)}</strong> /{" "}
                    {fmtPerM(launch.best.output)} /M
                  </>
                ) : launch.free ? (
                  <strong className="font-bold text-pos">Free</strong>
                ) : (
                  "pricing TBD"
                )}
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-black/45">
                {launch.listings.length > 0 && <span>{launch.listings.length} provider{launch.listings.length === 1 ? "" : "s"}</span>}
                <span>{labName(launch.labId)}</span>
              </div>
            </>
          ) : (
            <p className="mt-2 text-sm text-black/45">Catalog is stable — no new releases this cycle.</p>
          )}
        </div>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-black/10 pt-4 text-xs">
        <Link href="/changelog" className="inline-flex items-center gap-1.5 font-medium text-black transition-colors hover:text-accent-strong">
          <strong className="font-mono tabular-nums">{moves}</strong> moves tracked
        </Link>
        {hot && (
          <Link href={`/m/${hot.group.id}`} className="inline-flex items-center gap-1.5 text-black/70 transition-colors hover:text-accent-strong">
            <Badge tone="pos" mono bold className="uppercase tracking-wide">
              #1 momentum
            </Badge>
            {hot.group.name}
          </Link>
        )}
        <Link href="/trends" className="ml-auto inline-flex items-center gap-1 font-medium text-accent underline decoration-wavy underline-offset-4 hover:text-accent-strong">
          market trends →
        </Link>
      </div>
    </article>
  );
}

function MoverRow({ m, rank }: { m: Mover; rank: number }) {
  const inner = (
    <>
      <span className="w-5 shrink-0 self-start pt-0.5 tabular-nums text-black/35">{rank}.</span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <span className="truncate font-medium">{m.name}</span>
          <span className="shrink-0">
            <DeltaChip down={m.pct < 0} pct={m.pct} digits={0} />
          </span>
        </div>
        <div className="mt-0.5 truncate font-mono text-xs tabular-nums text-black/45">
          {fmtPerM(m.from)} → {fmtPerM(m.to)} /M
          {m.providerId && ` · via ${m.providerId}`}
        </div>
      </div>
    </>
  );
  const cls = "flex items-start gap-2 py-2.5";
  return m.id ? (
    <Link href={`/m/${m.id}`} className={`${cls} transition-colors hover:text-accent-strong`}>
      {inner}
    </Link>
  ) : (
    <div className={cls}>{inner}</div>
  );
}

function MoversBoard({ title, items, empty }: { title: string; items: Mover[]; empty: string }) {
  return (
    <div className="card p-4">
      <h3 className="mb-1 font-hand text-2xl font-bold text-black">{title}</h3>
      {items.length === 0 ? (
        <EmptyState>{empty}</EmptyState>
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
    <Link href="/trends" className="card lift block p-4 transition-colors hover:border-accent">
      <p className="mono-label">Frontier price index</p>
      <div className="mt-2 flex items-end justify-between gap-2">
        <div className="font-mono text-2xl font-bold tabular-nums text-black">
          {fmtPerM(last.median)}
          <span className="text-xs font-medium text-black/45"> /M</span>
        </div>
        <DeltaChip down={down} pct={deltaPct} />
      </div>
      <div className="mt-3">
        <Sparkline values={series.map((p) => p.median)} width={272} height={36} />
      </div>
      <p className="mt-2 text-xs leading-snug text-black/45">
        Median blended price across {last.models} frontier models · since {fmtDate(first.date)}.
      </p>
    </Link>
  );
}

function HeatStrip({ cal }: { cal: ReturnType<typeof activityCalendar> }) {
  const max = Math.max(...cal.map((d) => d.count), 1);
  const fmtDay = (iso: string) =>
    new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      timeZone: "UTC",
    });
  return (
    <div>
      <div className="flex items-stretch gap-[3px]" role="img" aria-label="Model changes per day over the last two weeks">
        {cal.map((d) => {
          const ratio = d.count / max;
          const tone =
            d.count === 0
              ? "bg-black/5"
              : ratio <= 0.25
                ? "bg-accent/25"
                : ratio <= 0.5
                  ? "bg-accent/55"
                  : ratio <= 0.75
                    ? "bg-accent/85"
                    : "bg-accent";
          return (
            <span
              key={d.date}
              title={`${fmtDay(d.date)}: ${d.count} change${d.count === 1 ? "" : "s"}`}
              className={`h-7 min-w-0 flex-1 rounded-sm border ${
                d.count === 0 ? "border-black/15" : "border-black"
              } ${tone}`}
            />
          );
        })}
      </div>
      <div className="micro-label mt-1.5 flex justify-between tracking-wider">
        <span>{fmtShort(cal[0]?.date)}</span>
        <span>today</span>
      </div>
    </div>
  );
}

function MoveChip({
  n,
  label,
  href,
  tone,
}: {
  n: number;
  label: string;
  href: string;
  tone: string;
}) {
  return (
    <Link
      href={href}
      className={`inline-flex items-baseline gap-1.5 rounded-full border px-3 py-1 text-xs font-medium shadow-hard-sm transition-all hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none ${tone}`}
    >
      <strong className="font-mono tabular-nums">{n}</strong> {label}
    </Link>
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
        className="line-clamp-2 font-medium leading-snug text-black transition-colors hover:text-accent"
      >
        {item.title}
      </a>
      {(modelId || priceChip) && (
        <div className="mt-auto flex flex-wrap items-center gap-1.5 pt-1">
          {modelId && (
            <Link href={`/m/${modelId}`} className="transition-colors hover:opacity-80">
              <Badge tone="accent">{modelName ?? modelId}</Badge>
            </Link>
          )}
          {modelId && priceChip && (
            <Link href={`/m/${modelId}`} className="transition-colors hover:opacity-80">
              <Badge tone="pos" mono>
                {priceChip}
              </Badge>
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
      <span className="absolute right-0 top-0 rounded-bl-lg border-b-2 border-l-2 border-black bg-warn-fill px-3 py-1 font-hand text-sm font-bold">
        this week’s pick
      </span>
      <p className="mono-label text-special">Model of the week</p>
      <Link href={`/m/${spot.id}`} className="group block">
        <h3 className="mt-1.5 text-2xl font-bold tracking-tight text-black transition-colors group-hover:text-accent-strong sm:text-3xl">
          {spot.name}
        </h3>
      </Link>
      <p className="mono-label mt-0.5">{labName(spot.labId)}</p>
      {spot.description && <p className="mt-3 line-clamp-3 text-sm leading-relaxed text-black/60">{spot.description}</p>}
      <div className="mt-4 flex flex-wrap gap-1.5">
        {facts.map((f) => (
          <Badge key={f}>{f}</Badge>
        ))}
      </div>
      <Link
        href={`/m/${spot.id}`}
        className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-accent underline decoration-wavy underline-offset-4 transition-colors hover:text-accent-strong"
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
    cheaper ? "font-mono font-bold tabular-nums text-pos" : "font-mono tabular-nums text-black/70";
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
                className="min-w-0 truncate font-medium text-black transition-colors hover:text-accent"
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
        className="mt-auto pt-3 text-sm font-semibold text-accent underline decoration-wavy underline-offset-4 transition-colors hover:text-accent-strong"
      >
        Compare side by side →
      </Link>
    </div>
  );
}

function windowDigest(events: Event[], days: number) {
  const cutoff = Date.now() - days * 86_400_000;
  const recent = events.filter((e) => new Date(`${e.date}T00:00:00Z`).getTime() >= cutoff);
  const count = (t: Event["type"]) => recent.filter((e) => e.type === t).length;
  return {
    total: recent.length,
    repriced: count("repriced"),
    added: count("model_added"),
    deprecated: count("deprecated"),
  };
}

const fmtShort = (iso: string | null): string =>
  iso
    ? new Date(`${iso.slice(0, 10)}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })
    : "—";

const SOURCE_LABELS: Record<string, string> = { hf: "HF", github: "GitHub" };

function TrendingRow({ score, rank, name, priceLabel }: { score: CompositeScore; rank: number; name: string; priceLabel: string }) {
  const sources = [...new Set(Object.keys(score.breakdown).map((k) => k.split(":")[0]))];
  return (
    <li className="flex items-center gap-3 py-2.5">
      <span className="w-5 shrink-0 tabular-nums text-black/35">{rank}.</span>
      <div className="min-w-0 flex-1">
        <Link href={`/m/${score.groupId}`} className="block truncate font-medium transition-colors hover:text-accent">
          {name}
        </Link>
        <span className="mono-label">{priceLabel}</span>
      </div>
      <div className="hidden w-24 shrink-0 sm:block" title={`composite ${score.score.toFixed(2)} of 1.00`}>
        <Bar pct={score.score} fill="bg-pos-bright" />
      </div>
      <span className="w-10 shrink-0 text-right font-mono text-xs font-semibold tabular-nums text-pos">
        {score.score.toFixed(2)}
      </span>
      <span className="flex w-[5.5rem] shrink-0 justify-end gap-1">
        {sources.map((s) => (
          <span key={s} title={s === "hf" ? "Hugging Face signals" : "GitHub signals"}>
            <Badge tone="muted" mono className="uppercase tracking-wide">
              {SOURCE_LABELS[s] ?? s}
            </Badge>
          </span>
        ))}
      </span>
    </li>
  );
}

export default async function HomePage() {
  const [catalog, events, news, boards, history, meta, trendingExternal] = await Promise.all([
    getCatalog(),
    getEvents(),
    getNews(),
    getBenchmarkBoards(),
    getAllPriceHistory(),
    getSnapshotMeta(),
    getTrendingExternalModels(7, 8),
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

  const digest = windowDigest(events, 14);
  const modelNameOf = (id: string) => catalog.groupById.get(id)?.name;

  const rawMovers = moversLosers(events, 7);
  const demote = (ms: Mover[]): Mover[] =>
    ms.map((m) => (m.id == null || catalog.groupById.has(m.id) ? m : { ...m, id: null }));
  const movers = { fallers: demote(rawMovers.fallers), risers: demote(rawMovers.risers) };
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
  const groupByListingKey = new Map(catalog.groups.flatMap((g) => g.listings.map((l) => [l.key, g.id] as const)));
  const eventHref = (e: Event): string | null => {
    const target = eventTarget(e);
    if (target?.startsWith("/m/") && !catalog.groupById.has(target.slice(3))) {
      return groupByListingKey.get(e.modelKey) ? `/m/${groupByListingKey.get(e.modelKey)}` : "/changelog";
    }
    if (target) return target;
    const viaListing = groupByListingKey.get(e.modelKey);
    return viaListing ? `/m/${viaListing}` : null;
  };

  const trending = trendingExternal
    .map((t) => {
      const group = catalog.groupById.get(t.groupId);
      if (!group) return null;
      return { t, group, priceLabel: group.best ? `${fmtPerM(group.best.input)}/${fmtPerM(group.best.output)} /M` : group.free ? "Free" : "—" };
    })
    .filter((x): x is NonNullable<typeof x> => x != null)
    .slice(0, 5);

  return (
    <div className="space-y-12">
      <section className="relative">
        <div className="grid-paper absolute inset-x-0 top-0 -z-10 h-full [mask-image:radial-gradient(ellipse_at_top,black_20%,transparent_70%)]" />
        <div className="mx-auto max-w-3xl pt-4 text-center sm:pt-6">
          <span className="pill mx-auto">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-pos-bright opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-pos-bright" />
            </span>
            Live{syncedAgo ? ` · synced ${syncedAgo}` : ""} · diffed hourly from models.dev
          </span>
          <h1 className="mt-4 text-3xl font-bold leading-[1.08] tracking-tight text-black sm:text-5xl">
            Every AI model. Every provider.{" "}
            <span className="wavy wavy-accent">Every change.</span>
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-base font-medium text-black/60">
            The front page of the AI model market — prices, releases and repricings, tracked hourly.
          </p>
          <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/browse"
              className="rounded-md border-2 border-black bg-black px-4 py-2 text-sm font-semibold text-white shadow-hard transition-all hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-hard-sm"
            >
              Browse models
            </Link>
            <Link
              href="/changelog"
              className="rounded-md border-2 border-black bg-white px-4 py-2 text-sm font-semibold text-black shadow-hard transition-all hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-hard-sm"
            >
              See what changed
            </Link>
          </div>
        </div>
      </section>

      <section aria-label="Market briefing">
        <MarketBrief
          series={pulse}
          cut={movers.fallers[0] ?? null}
          launch={fresh[0] ?? null}
          hot={trending[0]
            ? { group: trending[0].group, priceLabel: trending[0].priceLabel, score: trending[0].t.score }
            : null}
          moves={digest.total}
          syncedAgo={syncedAgo}
        />
      </section>

      <section className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-8">
<div>
            <SectionHead title="The tape" href="/changelog" eyebrow="Price moves · last 7 days" label="Full changelog" />
            <p className="mb-3 flex flex-wrap items-center gap-2 text-xs">
              <Badge tone="pos">
                <span className="font-bold">▼</span> cheaper
              </Badge>
              <Badge tone="neg">
                <span className="font-bold">▲</span> pricier
              </Badge>
            </p>
            <div className="grid gap-4 md:grid-cols-2">
              <MoversBoard title="Price cuts" items={movers.fallers} empty="No input-price cuts this week." />
              <MoversBoard title="Price hikes" items={movers.risers} empty="No price hikes this week." />
            </div>
          </div>
          <div>
            <SectionHead title="Latest activity" href="/changelog" eyebrow="The wire" />
            {events.length === 0 ? (
              <EmptyState>
                Baseline snapshot captured — changes will appear here after the next sync detects a diff.
              </EmptyState>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                {events.slice(0, 6).map((e) => (
                  <EventCard key={e.id} event={e} href={eventHref(e)} />
                ))}
              </div>
            )}
          </div>
        </div>

        <aside className="space-y-6">
          <PulseCard series={pulse} />

          <div className="card p-4">
            <p className="mono-label mb-3">Freshest models</p>
            <ul className="divide-y divide-black/10 text-sm">
              {fresh.map((g) => {
                const series = history.get(g.id)?.filter((p) => p.input != null).map((p) => p.input!) ?? [];
                return (
                  <li key={g.id} className="flex items-center gap-2 py-2.5">
                    <div className="min-w-0 flex-1">
                      <Link href={`/m/${g.id}`} className="block truncate font-medium transition-colors hover:text-accent">
                        {g.name}
                      </Link>
                      <span className="mono-label">{g.best ? `${fmtPerM(g.best.input)}/${fmtPerM(g.best.output)}` : g.free ? "Free" : "—"}</span>
                    </div>
                    {series.length >= 2 && <Sparkline values={series} width={56} height={20} />}
                  </li>
                );
              })}
            </ul>
            <Link
              href="/browse"
              className="mt-3 inline-block text-xs font-medium text-accent underline decoration-wavy underline-offset-4 transition-colors hover:text-accent-strong"
            >
              browse the catalog →
            </Link>
          </div>
        </aside>
      </section>

      <section>
        <SectionHead title="Two weeks of moves" href="/digest" label="Weekly recap" eyebrow="At a glance" />
        <HeatStrip cal={cal} />
        {digest.total === 0 ? (
          <p className="mt-4 text-sm text-black/45">
            A quiet fortnight — no changes detected. The hourly sync keeps watching.
          </p>
        ) : (
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <MoveChip
              n={digest.total}
              label="moves"
              href="/changelog"
              tone="border-black bg-black text-white hover:opacity-90"
            />
            {digest.repriced > 0 && (
              <MoveChip n={digest.repriced} label="repricings" href="/changelog?type=repriced&days=14" tone="border-special/40 bg-special-soft text-special" />
            )}
            {digest.added > 0 && (
              <MoveChip n={digest.added} label="launches" href="/changelog?type=model_added&days=14" tone="border-pos/40 bg-pos-soft text-pos" />
            )}
            {digest.deprecated > 0 && (
              <MoveChip n={digest.deprecated} label="sunsets" href="/deprecations" tone="border-neg/40 bg-neg-soft text-neg" />
            )}
          </div>
        )}
      </section>

      <section>
        <SectionHead title="Lab scoreboards" href="/providers" label="All providers" eyebrow="The race" eyebrowTone="special" />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {labCards.map((c: LabScorecard) => (
            <Link key={c.id} href={`/lab/${c.id}`} className="card-flat lift block p-4 transition-colors hover:border-accent">
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-semibold text-black">{labName(c.id)}</span>
                {c.weeklyEvents > 0 && (
                  <Badge tone="special">+{c.weeklyEvents} this wk</Badge>
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

      {trending.length > 0 && (
        <section>
          <SectionHead title="Momentum index" eyebrow="Community & research signals · last 7 days" eyebrowTone="pos" />
          <p className="-mt-2 mb-5 max-w-2xl text-sm text-black/60">
            Weighted blend of Hugging&nbsp;Face downloads, likes, trending score, GitHub stars/forks and
            recent paper mentions — normalized, freshness-decayed, then ranked.
          </p>
          <div className="card p-4">
            <ul className="divide-y divide-black/10 text-sm">
              {trending.map(({ t, group, priceLabel }, i) => (
                <TrendingRow key={t.groupId} score={t} rank={i + 1} name={group.name} priceLabel={priceLabel} />
              ))}
            </ul>
            <p className="micro-label mt-3 tracking-wider">
              sources: huggingface.co hub api · api.github.com — per-signal attribution in /api/signals.json
            </p>
          </div>
        </section>
      )}

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
          <p className="-mt-2 mb-5 max-w-2xl text-sm text-black/60">
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
                        className="underline decoration-wavy decoration-black/25 underline-offset-4 transition-colors hover:text-accent hover:decoration-accent"
                      >
                        {board.name} ↗
                      </a>
                    ) : (
                      board.name
                    )}
                  </h3>
                  <Link
                    href={`/benchmarks/${board.slug}`}
                    className="shrink-0 text-xs font-medium text-accent underline decoration-wavy underline-offset-4 hover:text-accent-strong"
                  >
                    board →
                  </Link>
                </div>
                <ol className="divide-y divide-black/10 text-sm">
                  {leaders.map((e, i) => (
                    <li key={e.groupId} className="flex items-center gap-2 py-2">
                      <span className="w-4 shrink-0 tabular-nums text-black/35">{i + 1}.</span>
                      <Link href={`/m/${e.groupId}`} className="min-w-0 flex-1 truncate font-medium transition-colors hover:text-accent">
                        {e.groupName}
                      </Link>
                      <span className="shrink-0 font-mono text-xs tabular-nums text-black/45">{e.score}</span>
                      <span className="w-16 shrink-0 text-right font-mono text-xs font-semibold tabular-nums text-pos">
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
        <SectionHead title="Record watch" eyebrow="Standing superlatives" eyebrowTone="warn" href="/browse" label="Browse all" />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {recs.map((r, i) => (
            <Link
              key={r.title}
              href={r.id ? `/m/${r.id}` : "/browse"}
              className="card p-4 flex flex-col gap-2 transition-colors hover:border-warn"
            >
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-black/35 font-mono tabular-nums">{i + 1}.</span>
                <span className="mono-label text-warn">{r.title}</span>
              </div>
              <div className="flex-1 min-h-0">
                {r.id && (
                  <Link
                    href={`/m/${r.id}`}
                    className="block truncate font-medium text-black transition-colors hover:text-accent"
                  >
                    {r.holder}
                  </Link>
                )}
                {!r.id && <span className="font-medium text-black">{r.holder}</span>}
              </div>
              <div className="font-mono text-lg font-semibold tabular-nums text-black">{r.value}</div>
              {r.detail && (
                <div className="text-xs text-black/45 font-mono truncate">
                  {r.detail}
                </div>
              )}
            </Link>
          ))}
        </div>
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
                  <Bar pct={c.pct} />
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
                  <Bar pct={b.count / bucketMax} fill="bg-special-bright" />
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
                        <Link href={`/m/${g.id}`} className="font-medium transition-colors hover:text-accent">
                          {g.name}
                        </Link>
                        <span className="ml-2 text-xs text-black/45">{g.labId}</span>
                      </td>
                      <td className="text-right font-mono tabular-nums">{fmtPerM(g.best!.input)}</td>
                      <td className="text-right font-mono tabular-nums">{fmtPerM(g.best!.output)}</td>
                      <td className="text-right font-mono tabular-nums">{fmtTokens(ctx)}</td>
                      <td className="text-right tabular-nums text-black/60">{g.listings.length}</td>
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

      <section className="border-t border-black py-8">
        <div className="grid grid-cols-3 gap-2 border-y-2 border-black py-4 sm:grid-cols-3 lg:grid-cols-6">
          <Stat value={String(s.models)} label="models" href="/browse" />
          <Stat value={String(s.providers)} label="providers" href="/providers" />
          <Stat value={String(s.listings)} label="listings" />
          <Stat value={String(s.labs)} label="labs" href="/trends" />
          <Stat value={String(s.openWeights)} label="open weights" href="/trends" />
          <Stat value={String(s.deprecated)} label="deprecated" href="/deprecations" />
        </div>
      </section>
    </div>
  );
}
