import Link from "next/link";
import { blendPrice, getCatalog, getEvents, getNews, getSnapshotMeta, groupContext } from "@/lib/data";
import { getPriceArchive } from "@/lib/data/archive";
import {
  collapseByModel,
  frontierIndex,
  labName,
  lede,
  marketMoves,
  type CollapsedMove,
  type Lede,
} from "@/lib/data/brief";
import { spreadSummary, widestSpreads, type SpreadRow } from "@/lib/data/market";
import { getBenchmarkBoards, rankableBoards, valueLeaders } from "@/lib/data/benchmarks";
import { benchmarkHome } from "@/lib/data/benchmark-links";
import { toStories, type Story } from "@/lib/data/stories";
import { getWeights } from "@/lib/data/weights";
import {
  apiOnlyCases,
  countFreelyUsable,
  fmtMonthlyUsd,
  fmtTokenCount,
  GPU_PRICES_AS_OF,
  hostableCases,
  type HostingCase,
} from "@/lib/data/selfhost";
import { EventCard, eventTarget } from "@/components/event-card";
import { Sparkline } from "@/components/price-history";
import { Badge, DeltaChip, EmptyState, SectionHead } from "@/components/ui";
import { ModelSearch } from "@/components/model-search";
import { fmtPerM, fmtAgo, fmtDate } from "@/lib/format";
import type { Event } from "@/lib/pipeline/types";

/* ------------------------------------------------------------------ lede -- */

const LEDE_TONE: Record<Lede["kind"], "pos" | "neg" | "accent" | "warn" | "special"> = {
  cut: "pos",
  launch: "pos",
  hike: "neg",
  sunset: "neg",
  street: "special",
  quiet: "accent",
};

/** Written out because Tailwind resolves class names statically. */
const LEDE_RAIL: Record<Lede["kind"], string> = {
  cut: "bg-pos",
  launch: "bg-pos",
  hike: "bg-neg",
  sunset: "bg-neg",
  street: "bg-special",
  quiet: "bg-accent",
};

const LEDE_EYEBROW: Record<Lede["kind"], string> = {
  cut: "Price cut",
  launch: "New release",
  hike: "Price rise",
  sunset: "Deprecations",
  street: "Reseller move",
  quiet: "Quiet week",
};

/**
 * The front page's claim about today. Every other module counts something; this
 * one says what it means — and names the rule that selected it, so the judgment
 * is auditable rather than asserted.
 */
function TheLede({ lede: l, syncedAgo }: { lede: Lede; syncedAgo: string }) {
  const tone = LEDE_TONE[l.kind];
  return (
    <article className="card relative overflow-hidden p-6 pl-7 sm:p-9 sm:pl-10">
      <span className={`absolute inset-y-0 left-0 w-2 ${LEDE_RAIL[l.kind]}`} aria-hidden="true" />
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <Badge tone={tone} bold className="uppercase tracking-wide">
          {LEDE_EYEBROW[l.kind]}
        </Badge>
        <span className="mono-label">{syncedAgo ? `synced ${syncedAgo}` : "synced recently"}</span>
      </div>

      <h2 className="mt-4 max-w-3xl text-3xl font-bold leading-tight tracking-tight text-black sm:text-5xl">
        {l.headline}
      </h2>
      <p className="mt-4 max-w-2xl text-base leading-relaxed text-black/70 sm:text-lg">{l.body}</p>

      <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2">
        <Link
          href={l.href}
          className="rounded-md border-2 border-black bg-black px-4 py-2 text-sm font-semibold text-white shadow-hard transition-all hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-hard-sm"
        >
          {l.cta}
        </Link>
        <span className="micro-label tracking-wider">selected by: {l.rule}</span>
      </div>
    </article>
  );
}

/* ------------------------------------------------------------------ tape -- */

function MoveRow({ m, rank }: { m: CollapsedMove; rank: number }) {
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
          {m.venues > 1 ? ` · ${m.venues} venues` : m.providerName ? ` · ${m.providerName}` : ""}
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

function MoveBoard({
  title,
  note,
  items,
  empty,
  tone,
}: {
  title: string;
  note: string;
  items: CollapsedMove[];
  empty: string;
  tone: "pos" | "muted";
}) {
  return (
    <div className={tone === "pos" ? "card p-5" : "card-flat p-5"}>
      <h3 className="font-hand text-2xl font-bold text-black">{title}</h3>
      <p className="mb-3 mt-0.5 text-xs leading-snug text-black/45">{note}</p>
      {items.length === 0 ? (
        <EmptyState>{empty}</EmptyState>
      ) : (
        <ol className="divide-y divide-black/10 text-sm">
          {items.slice(0, 5).map((m, i) => (
            <li key={`${m.id}-${m.providerId}-${i}`}>
              <MoveRow m={m} rank={i + 1} />
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

/* ----------------------------------------------------------------- index -- */

/**
 * The frontier price index, or an honest account of why it is not here yet.
 * A two-point line reading "▼ 0.0%" was the least informative thing on the old
 * homepage; saying when it starts is strictly more useful than faking it.
 */
function IndexCard({ index }: { index: ReturnType<typeof frontierIndex> }) {
  if (!index.ready) {
    return (
      <div className="card-dashed p-5">
        <p className="mono-label">Frontier price index</p>
        <p className="mt-2 text-sm leading-relaxed text-black/60">
          Building. The index needs {index.daysNeeded} more day
          {index.daysNeeded === 1 ? "" : "s"} of tape before a trend line means anything — it
          {index.startsOn ? (
            <>
              {" "}
              starts publishing{" "}
              <strong className="font-semibold text-black">{index.startsOn}</strong>.
            </>
          ) : (
            "."
          )}
        </p>
        <p className="micro-label mt-3 tracking-wider">
          {index.daysCovered} day{index.daysCovered === 1 ? "" : "s"} archived so far · every sync
          is kept permanently
        </p>
      </div>
    );
  }
  const first = index.points[0];
  const last = index.points[index.points.length - 1];
  return (
    <Link href="/trends" className="card lift block p-5 transition-colors hover:border-accent">
      <p className="mono-label">Frontier price index</p>
      <div className="mt-2 flex items-end justify-between gap-2">
        <div className="font-mono text-3xl font-bold tabular-nums text-black">
          {fmtPerM(last.median)}
          <span className="text-xs font-medium text-black/45"> /M</span>
        </div>
        {index.changePct != null && <DeltaChip down={index.changePct <= 0} pct={index.changePct} />}
      </div>
      <div className="mt-3">
        <Sparkline values={index.points.map((p) => p.median)} width={272} height={44} />
      </div>
      <p className="mt-2 text-xs leading-snug text-black/45">
        Median blended price across {last.models} frontier models · since {fmtDate(first.date)}.
      </p>
    </Link>
  );
}

/* ---------------------------------------------------------------- spread -- */

/**
 * The arbitrage layer: identical weights, wildly different prices. This is the
 * most directly useful thing the dataset knows and it previously existed only
 * as an unannotated table on individual model pages.
 */
function SpreadRowCard({ row }: { row: SpreadRow }) {
  const { group, spread } = row;
  const pick = spread.cheapestFullContext ?? spread.cheapest;
  // Blended, because that is the basis the ratio is computed on — showing the
  // input rate beside a blended multiple reads as an arithmetic error.
  const pickBlend = blendPrice(pick.cost.input!, pick.cost.output!);
  const dearBlend = blendPrice(spread.dearest.cost.input!, spread.dearest.cost.output!);
  return (
    <li className="flex flex-col gap-2 py-3.5 sm:flex-row sm:items-center sm:gap-4">
      <div className="min-w-0 flex-1">
        <Link
          href={`/m/${group.id}`}
          className="block truncate font-medium text-black transition-colors hover:text-accent"
        >
          {group.name}
        </Link>
        <span className="mono-label">
          {labName(group.labId)} · {spread.ranked.length} providers
        </span>
      </div>
      <div className="flex shrink-0 items-center gap-3 font-mono text-xs tabular-nums">
        <span className="text-pos">
          <strong className="text-sm font-bold">{fmtPerM(pickBlend)}</strong>
          <span className="text-black/45"> {pick.providerName}</span>
        </span>
        <span className="text-black/25">→</span>
        <span className="text-black/45">
          {fmtPerM(dearBlend)} {spread.dearest.providerName}
        </span>
      </div>
      <span className="shrink-0 sm:w-16 sm:text-right">
        <Badge tone="warn" mono bold>
          {spread.ratio.toFixed(1)}×
        </Badge>
      </span>
    </li>
  );
}

/* ----------------------------------------------------------------- value -- */

function ValueBoardCard({
  board,
}: {
  board: ReturnType<typeof rankableBoards>[number];
}) {
  const leaders = valueLeaders(board);
  if (leaders.length === 0) return null;
  const home = benchmarkHome(board.name);
  return (
    <div className="card min-w-0 p-5">
      <div className="mb-1 flex items-baseline justify-between gap-2">
        <h3 className="font-hand text-2xl font-bold text-black">
          {home ? (
            <a
              href={home}
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
      <p className="mb-3 text-xs text-black/45">
        {board.independent.length} independently measured score
        {board.independent.length === 1 ? "" : "s"}
        {board.fullyIndependent ? "" : ` · ${board.entries.length - board.independent.length} self-reported score(s) excluded`}
      </p>
      <ol className="divide-y divide-black/10 text-sm">
        {leaders.map((e, i) => (
          <li key={e.groupId} className="flex items-center gap-2 py-2">
            <span className="w-4 shrink-0 tabular-nums text-black/35">{i + 1}.</span>
            <Link
              href={`/m/${e.groupId}`}
              className="min-w-0 flex-1 truncate font-medium transition-colors hover:text-accent"
            >
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
  );
}

/* -------------------------------------------------------------- self-host -- */

/**
 * The other half of the price question. This site knows a model's API price and
 * whether its weights are licensed for commercial use, which is everything
 * needed to answer "should I run this myself?" — except throughput, which
 * depends on too much to model honestly.
 *
 * So the row states the floor instead: renting the smallest configuration the
 * weights fit on costs the same whether you serve one token or a billion, and
 * the API has no fixed cost. The break-even shown assumes a permanently
 * saturated GPU, which is the best case for self-hosting.
 */
function HostingRow({ c }: { c: HostingCase }) {
  return (
    <li className="flex flex-col gap-1.5 py-3 sm:flex-row sm:items-baseline sm:gap-4">
      <div className="min-w-0 flex-1">
        <Link
          href={`/m/${c.groupId}`}
          className="block truncate font-medium text-black transition-colors hover:text-accent"
        >
          {c.name}
        </Link>
        <span className="mono-label">
          {c.floor!.gpus}× {c.floor!.tier.name} · API {fmtPerM(c.apiBlendedPerM!)}/M ·{" "}
          {fmtTokenCount(c.breakEvenTokens)} tokens
        </span>
      </div>
      <span className="shrink-0 sm:text-right">
        <span className="mono-label">keep buying below </span>
        <span className="font-mono text-base font-bold tabular-nums text-black">
          {fmtMonthlyUsd(c.floor!.usdPerMonth)}
        </span>
        <span className="mono-label">/mo of API</span>
      </span>
    </li>
  );
}

/* ------------------------------------------------------------------ news -- */

function StoryCard({
  story,
  modelName,
  modelId,
}: {
  story: Story;
  modelName?: string;
  modelId?: string;
}) {
  const { lead, alsoCovered } = story;
  return (
    <article className="card lift flex flex-col gap-2 p-4">
      <div className="flex items-center gap-1.5 text-xs text-black/45">
        {lead.favicon && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={lead.favicon} alt="" width={12} height={12} className="h-3 w-3 rounded-sm" />
        )}
        <span className="truncate">{lead.source}</span>
        {lead.publishedAt && <span className="shrink-0">· {fmtAgo(lead.publishedAt)}</span>}
      </div>
      <a
        href={lead.url}
        target="_blank"
        rel="noopener noreferrer"
        className="line-clamp-2 font-medium leading-snug text-black transition-colors hover:text-accent"
      >
        {lead.title}
      </a>
      <div className="mt-auto flex flex-wrap items-center gap-1.5 pt-1">
        {modelId && (
          <Link href={`/m/${modelId}`} className="transition-colors hover:opacity-80">
            <Badge tone="accent">{modelName ?? modelId}</Badge>
          </Link>
        )}
        {alsoCovered.length > 0 && (
          <span className="micro-label tracking-wider">
            +{alsoCovered.length} more outlet{alsoCovered.length === 1 ? "" : "s"}
          </span>
        )}
      </div>
    </article>
  );
}

/* ------------------------------------------------------------------ page -- */

function Stat({ value, label, href }: { value: string; label: string; href?: string }) {
  const inner = (
    <>
      <div className="text-xl font-bold tabular-nums text-black">{value}</div>
      <div className="micro-label mt-0.5">{label}</div>
    </>
  );
  return href ? (
    <Link href={href} className="card-flat lift block px-3 py-2 transition-colors hover:border-accent">
      {inner}
    </Link>
  ) : (
    <div className="card-flat px-3 py-2">{inner}</div>
  );
}

export default async function HomePage() {
  const [catalog, events, news, boards, archive, weights, meta] = await Promise.all([
    getCatalog(),
    getEvents(),
    getNews(),
    getBenchmarkBoards(),
    getPriceArchive(),
    getWeights(),
    getSnapshotMeta(),
  ]);

  const s = catalog.stats;
  const syncedAgo = fmtAgo(meta.fetchedAt);
  const moves = marketMoves(events, catalog, 7);
  const theLede = lede(moves, catalog, events);

  const frontierIds = new Set(
    catalog.tracked
      .filter((g) => g.best != null && !g.free && (groupContext(g) ?? 0) >= 200_000)
      .map((g) => g.id),
  );
  const index = frontierIndex(archive, frontierIds);

  const spreads = widestSpreads(catalog.tracked, 6, 6);

  const hostable = hostableCases(catalog.tracked, weights.models, 5);
  const apiOnly = apiOnlyCases(catalog.tracked, weights.models, 4);
  const freelyUsable = countFreelyUsable(catalog.tracked, weights.models);
  const valueBoards = rankableBoards(boards).slice(0, 2);
  // Stories that name a model we track are the ones this audience came for;
  // generic industry listicles sort below them.
  const stories = toStories(news)
    .map((story) => ({
      story,
      modelId: story.lead.modelIds.find((id) => catalog.groupById.has(id)),
    }))
    .filter((item) => item.modelId != null)
    .slice(0, 6);

  // The lead story already carries the newest launch; the wire shows the rest.
  const groupByListingKey = new Map(
    catalog.groups.flatMap((g) => g.listings.map((l) => [l.key, g.id] as const)),
  );
  const eventHref = (e: Event): string | null => {
    const target = eventTarget(e);
    if (target?.startsWith("/m/") && !catalog.groupById.has(target.slice(3))) {
      const via = groupByListingKey.get(e.modelKey);
      return via ? `/m/${via}` : "/changelog";
    }
    if (target) return target;
    const via = groupByListingKey.get(e.modelKey);
    return via ? `/m/${via}` : null;
  };

  const headline = spreads[0];
  const headlineSummary = headline ? spreadSummary(headline.group, headline.spread) : null;

  return (
    <div className="space-y-16">
      <section className="hero-shell">
        <div className="hero-grid" aria-hidden="true" />
        <div className="relative mx-auto max-w-4xl text-center">
          <span className="pill mx-auto bg-white/70">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-pos-bright opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-pos-bright" />
            </span>
            Live{syncedAgo ? ` · synced ${syncedAgo}` : ""} · diffed hourly from models.dev
          </span>
          <h1 className="mt-6 text-4xl font-bold leading-[1.02] tracking-tight text-black sm:text-6xl lg:text-7xl">
            Know what changed.<br />Choose what works.
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-black/60 sm:text-lg">
            The decision and change layer for the AI model market — {s.models} canonical models,
            {" "}{s.providers} providers, releases, retirements, prices and independent evidence.
          </p>
          <div className="mt-7">
            <ModelSearch
              variant="hero"
              models={catalog.tracked.map((group) => ({ id: group.id, name: group.name, lab: group.labId }))}
            />
          </div>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <Link href="/browse" className="button-primary">Find the right model →</Link>
            <Link href="/changelog" className="button-secondary">See what changed</Link>
          </div>
        </div>
        <div className="relative mt-10 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-black/10 bg-black/10 sm:grid-cols-4">
          <div className="hero-stat"><strong>{s.models}</strong><span>canonical models</span></div>
          <div className="hero-stat"><strong>{s.providers}</strong><span>providers</span></div>
          <div className="hero-stat"><strong>{s.listings.toLocaleString("en-US")}</strong><span>live listings</span></div>
          <div className="hero-stat"><strong>hourly</strong><span>change detection</span></div>
        </div>
      </section>

      <section aria-label="Today's lead story">
        <TheLede lede={theLede} syncedAgo={syncedAgo} />
      </section>

      {/* Who moved: the lab, or someone reselling it. */}
      <section className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-8">
          <div>
            <SectionHead title="Who moved the price" eyebrow="The tape · last 7 days" href="/changelog" label="Full changelog" />
            <div className="grid gap-4 md:grid-cols-2">
              <MoveBoard
                tone="pos"
                title="The labs"
                note="First-party repricing — the model itself got cheaper or dearer."
                items={collapseByModel(moves.firstParty)}
                empty="No lab changed its own pricing this week."
              />
              <MoveBoard
                tone="muted"
                title="The street"
                note="Gateways adjusting their markup. The model's price did not change."
                items={collapseByModel(moves.street)}
                empty="No reseller changed its listing this week."
              />
            </div>
          </div>

          <div>
            <SectionHead title="Latest activity" eyebrow="The wire" href="/changelog" />
            {events.length === 0 ? (
              <EmptyState>
                Baseline snapshot captured — changes appear here once the next sync detects a diff.
              </EmptyState>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                {events.slice(0, 4).map((e) => (
                  <EventCard key={e.id} event={e} href={eventHref(e)} />
                ))}
              </div>
            )}
          </div>
        </div>

        <aside className="space-y-6">
          <IndexCard index={index} />
          <div className="card-flat p-5">
            <p className="mono-label mb-2">How this page decides</p>
            <p className="text-xs leading-relaxed text-black/60">
              A lab repricing its own model is news. A gateway changing its markup is inventory.
              Benchmark rankings use independently measured scores only — self-reported numbers are
              shown on model pages, labelled, and never ranked.
            </p>
            <Link
              href="/about"
              className="mt-3 inline-block text-xs font-medium text-accent underline decoration-wavy underline-offset-4 hover:text-accent-strong"
            >
              method →
            </Link>
          </div>
        </aside>
      </section>

      {/* Arbitrage: the same weights at very different prices. */}
      {spreads.length > 0 && (
        <section>
          <SectionHead
            title="Same model, different price"
            eyebrow="Where to buy"
            eyebrowTone="warn"
            href="/browse"
            label="Browse all"
          />
          {headlineSummary && (
            <p className="-mt-2 mb-5 max-w-2xl text-sm leading-relaxed text-black/60">
              {headlineSummary}
            </p>
          )}
          <div className="card p-5">
            <ul className="divide-y divide-black/10 text-sm">
              {spreads.map((row) => (
                <SpreadRowCard key={row.group.id} row={row} />
              ))}
            </ul>
            <p className="micro-label mt-3 tracking-wider">
              cheapest listing meeting the model&rsquo;s full context window → dearest · blended
              price, outliers excluded
            </p>
          </div>
        </section>
      )}

      {/* Value, ranked only on numbers somebody independent measured. */}
      {valueBoards.length > 0 && (
        <section>
          <SectionHead
            title="What a dollar buys"
            eyebrow="Independent evals only"
            eyebrowTone="pos"
            href="/benchmarks"
            label="All leaderboards"
          />
          <p className="-mt-2 mb-5 max-w-2xl text-sm leading-relaxed text-black/60">
            Benchmark score per blended dollar, ranked using only scores measured by a third party.
            Numbers a lab published about its own model are claims, not measurements, and are
            excluded from every ranking here.
          </p>
          <div className="grid gap-4 md:grid-cols-2">
            {valueBoards.map((board) => (
              <ValueBoardCard key={board.slug} board={board} />
            ))}
          </div>
        </section>
      )}

      {/* Price has a second half: for open weights, you can rent the GPU instead. */}
      {hostable.length > 0 && (
        <section>
          <SectionHead
            title="Self-host or buy?"
            eyebrow="The other half of the price question"
            eyebrowTone="special"
            href="/self-host"
            label="Work it out"
          />
          <p className="-mt-2 mb-5 max-w-2xl text-sm leading-relaxed text-black/60">
            {freelyUsable} of the models here are permissively licensed and download without
            asking, so paying per token is a choice rather than the only option. A rented GPU
            costs the same whether you serve one token or a billion — so self-hosting cannot
            beat the API until your bill clears the rent. So the threshold is just the rent —
            spend less than this on a model and buying wins outright.
          </p>

          <div className="card p-5">
            <ul className="divide-y divide-black/10 text-sm">
              {hostable.map((c) => (
                <HostingRow key={c.groupId} c={c} />
              ))}
            </ul>
            <p className="micro-label mt-3 leading-relaxed tracking-wider">
              smallest configuration that holds the weights at bf16 · representative on-demand
              rates as of {GPU_PRICES_AS_OF}, and reserved capacity runs cheaper · break-even
              assumes a permanently saturated GPU, which is the best case for self-hosting —
              below these figures the API wins outright ·{" "}
              <Link href="/self-host" className="text-accent hover:text-accent-strong">
                set your own volume →
              </Link>
            </p>
          </div>

          {apiOnly.length > 0 && (
            <div className="card-flat mt-4 p-5">
              <p className="mono-label mb-1 text-neg">API only</p>
              <p className="mb-3 text-sm leading-relaxed text-black/60">
                These publish weights, but under a licence that forbids commercial use — buying
                the API is the only route for a product, at any volume.
              </p>
              <ul className="flex flex-wrap gap-x-4 gap-y-1.5 text-sm">
                {apiOnly.map((c) => (
                  <li key={c.groupId}>
                    <Link
                      href={`/m/${c.groupId}`}
                      className="font-medium transition-colors hover:text-accent"
                    >
                      {c.name}
                    </Link>
                    <span className="mono-label"> {c.licence}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}

      {stories.length > 0 && (
        <section>
          <SectionHead title="In the news" eyebrow="Around the web" href="/news" />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {stories.map(({ story, modelId }) => (
              <StoryCard
                key={story.lead.id}
                story={story}
                modelId={modelId}
                modelName={modelId ? catalog.groupById.get(modelId)?.name : undefined}
              />
            ))}
          </div>
        </section>
      )}

      <section className="border-t border-black pt-8">
        <div className="grid grid-cols-3 gap-2 border-y-2 border-black py-4 lg:grid-cols-6">
          <Stat value={String(s.models)} label="tracked models" href="/browse" />
          <Stat value={String(s.labs)} label="labs" href="/trends" />
          <Stat value={String(s.providers)} label="providers" href="/providers" />
          <Stat value={s.listings.toLocaleString("en-US")} label="listings" />
          <Stat value={String(s.openWeights)} label="open weights" href="/trends" />
          <Stat value={String(s.deprecated)} label="deprecated" href="/deprecations" />
        </div>
        <p className="mt-3 text-xs leading-relaxed text-black/45">
          Tracked models are those backed by a canonical lab entry. The catalog also carries{" "}
          {(s.catalogEntries - s.models).toLocaleString("en-US")} gateway-only variants, browsable
          but excluded from every aggregate on this page.
        </p>
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
              <li><a href="/api/benchmarks.json" className="underline decoration-black/20 underline-offset-2 hover:text-black">/api/benchmarks.json</a> — scores + provenance</li>
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
