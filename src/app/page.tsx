import Link from "next/link";
import { EventCard, eventTarget } from "@/components/event-card";
import { ModelSearch } from "@/components/model-search";
import { Badge, DeltaChip, EmptyState, SectionHead } from "@/components/ui";
import { blendPrice, getCatalog, getEvents, getSnapshotMeta } from "@/lib/data";
import {
  collapseByModel,
  labName,
  lede,
  marketMoves,
  type CollapsedMove,
  type Lede,
} from "@/lib/data/brief";
import { benchmarkHome } from "@/lib/data/benchmark-links";
import { getBenchmarkBoards, rankableBoards, valueLeaders } from "@/lib/data/benchmarks";
import { spreadSummary, widestSpreads, type SpreadRow } from "@/lib/data/market";
import { countFreelyUsable } from "@/lib/data/selfhost";
import { getWeights } from "@/lib/data/weights";
import { fmtAgo, fmtPerM } from "@/lib/format";
import type { Event } from "@/lib/pipeline/types";

const LEDE_TONE: Record<Lede["kind"], "pos" | "neg" | "accent" | "warn" | "special"> = {
  cut: "pos",
  launch: "pos",
  hike: "neg",
  sunset: "neg",
  street: "special",
  quiet: "accent",
};

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

const DECISIONS = [
  {
    number: "01",
    title: "Choose a model",
    body: "Filter by price, context, capability and independent evidence—not a popularity list.",
    href: "/browse",
    cta: "Open model explorer",
  },
  {
    number: "02",
    title: "Compare the shortlist",
    body: "Put two to four models side by side and see the winner on every priced or sized row.",
    href: "/compare",
    cta: "Compare models",
  },
  {
    number: "03",
    title: "Price your workload",
    body: "Turn input, output and cache volume into a monthly bill before choosing a provider.",
    href: "/calculator",
    cta: "Calculate cost",
  },
] as const;

function DailyLede({
  story,
  syncedAgo,
  models,
}: {
  story: Lede;
  syncedAgo: string;
  models: { id: string; name: string; lab: string }[];
}) {
  return (
    <section className="hero-shell" aria-labelledby="daily-lede">
      <div className="hero-grid" aria-hidden="true" />
      <span className={`absolute inset-y-0 left-0 w-2 ${LEDE_RAIL[story.kind]}`} aria-hidden="true" />

      <div className="relative grid items-center gap-10 lg:grid-cols-[minmax(0,1.2fr)_minmax(22rem,0.8fr)]">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={LEDE_TONE[story.kind]} bold>
              {LEDE_EYEBROW[story.kind]}
            </Badge>
            <span className="pill bg-white/70">
              <span className="relative flex h-2 w-2" aria-hidden="true">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-pos-bright opacity-60" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-pos-bright" />
              </span>
              Live{syncedAgo ? ` · synced ${syncedAgo}` : ""}
            </span>
          </div>

          <p className="mono-label mt-7 text-accent">The front page of the AI model market</p>
          <h1 id="daily-lede" className="mt-3 max-w-4xl text-4xl font-bold leading-[1.02] tracking-tight text-black sm:text-6xl lg:text-7xl">
            {story.headline}
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-relaxed text-black/70 sm:text-lg">{story.body}</p>

          <div className="mt-7 flex flex-wrap items-center gap-3">
            <Link href={story.href} className="button-primary">{story.cta} →</Link>
            <Link href="/changelog" className="button-secondary">Today&rsquo;s changes →</Link>
          </div>
          <p className="micro-label mt-4 tracking-wider">selected by: {story.rule}</p>
        </div>

        <div className="card-flat hidden bg-white/80 p-6 lg:block">
          <p className="mono-label text-accent">Check a model before you buy</p>
          <h2 className="mt-2 text-2xl font-bold tracking-tight text-black">One model. Every provider.</h2>
          <p className="mt-2 text-sm leading-relaxed text-black/60">
            Search a model to compare published prices, full-context catches, evidence and recent changes.
          </p>
          <div className="mt-5"><ModelSearch variant="hero" models={models} /></div>
          <p className="micro-label mt-4 leading-relaxed">
            A dash means unlisted, not free · extreme prices are excluded · verify before purchasing
          </p>
        </div>
      </div>
    </section>
  );
}

function DecisionCard({ decision }: { decision: (typeof DECISIONS)[number] }) {
  return (
    <Link href={decision.href} className="card lift group flex h-full flex-col p-5 sm:p-6">
      <span className="font-mono text-sm font-bold tabular-nums text-accent">{decision.number}</span>
      <h3 className="mt-6 text-2xl font-bold tracking-tight text-black">{decision.title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-black/60">{decision.body}</p>
      <span className="mt-6 text-sm font-semibold text-accent group-hover:text-accent-strong">{decision.cta} →</span>
    </Link>
  );
}

function MoveList({ items, empty }: { items: CollapsedMove[]; empty: string }) {
  if (items.length === 0) return <EmptyState>{empty}</EmptyState>;
  return (
    <ol className="divide-y divide-black/10 text-sm">
      {items.slice(0, 3).map((move, index) => (
        <li key={`${move.id}-${move.providerId}-${index}`}>
          <Link href={move.id ? `/m/${move.id}` : "/changelog"} className="flex items-center gap-3 py-3 transition-colors hover:text-accent">
            <span className="w-5 shrink-0 font-mono text-xs tabular-nums text-black/35">{index + 1}.</span>
            <span className="min-w-0 flex-1">
              <span className="block truncate font-medium">{move.name}</span>
              <span className="block truncate font-mono text-xs tabular-nums text-black/45">
                {fmtPerM(move.from)} → {fmtPerM(move.to)} /M
                {move.venues > 1 ? ` · ${move.venues} venues` : move.providerName ? ` · ${move.providerName}` : ""}
              </span>
            </span>
            <DeltaChip down={move.pct < 0} pct={move.pct} digits={0} />
          </Link>
        </li>
      ))}
    </ol>
  );
}

function SpreadCard({ row }: { row: SpreadRow }) {
  const pick = row.spread.cheapestFullContext ?? row.spread.cheapest;
  const pickBlend = blendPrice(pick.cost.input!, pick.cost.output!);
  const dearBlend = blendPrice(row.spread.dearest.cost.input!, row.spread.dearest.cost.output!);
  return (
    <Link href={`/m/${row.group.id}`} className="card lift flex h-full flex-col p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-lg font-bold text-black">{row.group.name}</h3>
          <p className="mono-label mt-1">{labName(row.group.labId)} · {row.spread.ranked.length} providers</p>
        </div>
        <Badge tone="warn" mono bold>{row.spread.ratio.toFixed(1)}×</Badge>
      </div>
      <div className="mt-7 grid grid-cols-[1fr_auto_1fr] items-end gap-3 font-mono tabular-nums">
        <div>
          <p className="micro-label">lowest full-context</p>
          <p className="mt-1 text-xl font-bold text-black">{fmtPerM(pickBlend)}</p>
          <p className="truncate text-xs text-black/45">{pick.providerName}</p>
        </div>
        <span className="pb-5 text-black/25">→</span>
        <div className="text-right">
          <p className="micro-label">highest in range</p>
          <p className="mt-1 text-xl font-bold text-black">{fmtPerM(dearBlend)}</p>
          <p className="truncate text-xs text-black/45">{row.spread.dearest.providerName}</p>
        </div>
      </div>
      <span className="mt-6 text-sm font-semibold text-accent">Compare providers →</span>
    </Link>
  );
}

function ValueSpotlight({ board }: { board: ReturnType<typeof rankableBoards>[number] }) {
  const leaders = valueLeaders(board).slice(0, 3);
  const home = benchmarkHome(board.name);
  return (
    <div className="card p-5 sm:p-7">
      <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <div>
          <Badge tone="pos">Independent measurement</Badge>
          <h3 className="mt-3 text-2xl font-bold tracking-tight text-black sm:text-3xl">Coding value on {board.name}</h3>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-black/60">
            Benchmark score per blended dollar. {board.independent.length} independently measured scores; self-reported claims never enter this ranking.
          </p>
        </div>
        <div className="flex shrink-0 gap-4 text-sm font-semibold">
          {home && <a href={home} target="_blank" rel="noreferrer" className="text-black/60 hover:text-black">Source ↗</a>}
          <Link href={`/benchmarks/${board.slug}`} className="text-accent hover:text-accent-strong">Full board →</Link>
        </div>
      </div>
      <ol className="no-scrollbar mt-6 grid snap-x snap-mandatory auto-cols-[88%] grid-flow-col gap-3 overflow-x-auto pb-4 md:grid-flow-row md:grid-cols-3 md:overflow-visible md:pb-0">
        {leaders.map((entry, index) => (
          <li key={entry.groupId} className="card-flat snap-start p-4">
            <span className="font-mono text-xs font-bold tabular-nums text-black/35">0{index + 1}</span>
            <Link href={`/m/${entry.groupId}`} className="mt-5 block truncate font-bold text-black hover:text-accent">{entry.groupName}</Link>
            <div className="mt-2 flex items-baseline justify-between gap-2 font-mono tabular-nums">
              <span className="text-xs text-black/45">score {entry.score}</span>
              <strong className="text-pos">{Math.round(entry.pointsPerDollar!).toLocaleString("en-US")} pts/$</strong>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

function weeklyCount(events: Event[]): number {
  const cutoff = Date.now() - 7 * 86_400_000;
  return events.filter((event) => Date.parse(`${event.date}T00:00:00Z`) >= cutoff).length;
}

export default async function HomePage() {
  const [catalog, events, boards, weights, meta] = await Promise.all([
    getCatalog(), getEvents(), getBenchmarkBoards(), getWeights(), getSnapshotMeta(),
  ]);
  const syncedAgo = fmtAgo(meta.fetchedAt);
  const moves = marketMoves(events, catalog, 7);
  const story = lede(moves, catalog, events);
  const labMoves = collapseByModel(moves.firstParty);
  const streetMoves = collapseByModel(moves.street);
  const spreads = widestSpreads(catalog.tracked, 6, 3);
  const valueBoard = rankableBoards(boards)[0];
  const freelyUsable = countFreelyUsable(catalog.tracked, weights.models);
  const weekEvents = weeklyCount(events);
  const searchModels = catalog.tracked.map((group) => ({ id: group.id, name: group.name, lab: group.labId }));
  const groupByListingKey = new Map(catalog.groups.flatMap((group) => group.listings.map((listing) => [listing.key, group.id] as const)));
  const eventHref = (event: Event): string | null => {
    const target = eventTarget(event);
    if (target?.startsWith("/m/") && !catalog.groupById.has(target.slice(3))) {
      const via = groupByListingKey.get(event.modelKey);
      return via ? `/m/${via}` : "/changelog";
    }
    const via = groupByListingKey.get(event.modelKey);
    return target ?? (via ? `/m/${via}` : null);
  };

  return (
    <div className="space-y-16">
      <DailyLede story={story} syncedAgo={syncedAgo} models={searchModels} />

      <section>
        <SectionHead title="What are you here to decide?" eyebrow="Start with the question" />
        <p className="micro-label -mt-2 mb-3 md:hidden">Swipe to inspect all three →</p>
        <div className="no-scrollbar grid snap-x snap-mandatory auto-cols-[88%] grid-flow-col gap-4 overflow-x-auto pb-4 md:grid-flow-row md:grid-cols-3 md:overflow-visible md:pb-0">
          {DECISIONS.map((decision) => <div key={decision.number} className="snap-start"><DecisionCard decision={decision} /></div>)}
        </div>
      </section>

      <section>
        <SectionHead title="Today’s market pulse" eyebrow="Who moved · last 7 days" href="/changelog" label="Full changelog" />
        <p className="micro-label -mt-2 mb-3 lg:hidden">Swipe from labs to street to wire →</p>
        <div className="no-scrollbar grid snap-x snap-mandatory auto-cols-[88%] grid-flow-col gap-4 overflow-x-auto pb-4 lg:grid-flow-row lg:grid-cols-3 lg:overflow-visible lg:pb-0">
          <div className="card snap-start p-5">
            <Badge tone="pos">First party</Badge>
            <h3 className="mt-3 text-2xl font-bold tracking-tight text-black">The labs</h3>
            <p className="mt-1 text-xs leading-relaxed text-black/45">The model itself got cheaper or dearer.</p>
            <div className="mt-3"><MoveList items={labMoves} empty="No lab changed its own pricing this week — the tape is quiet." /></div>
          </div>
          <div className="card-flat snap-start p-5">
            <Badge tone="special">Resellers</Badge>
            <h3 className="mt-3 text-2xl font-bold tracking-tight text-black">The street</h3>
            <p className="mt-1 text-xs leading-relaxed text-black/45">Gateway markup moved. The model&rsquo;s price did not.</p>
            <div className="mt-3"><MoveList items={streetMoves} empty="No reseller changed its listing this week." /></div>
          </div>
          <div className="snap-start">
            <Badge tone="accent">The wire</Badge>
            <h3 className="mt-3 text-2xl font-bold tracking-tight text-black">Latest changes</h3>
            <div className="mt-3 space-y-3">
              {events.length > 0 ? events.slice(0, 3).map((event) => (
                <EventCard key={event.id} event={event} href={eventHref(event)} />
              )) : <EmptyState>Baseline captured — the next detected change appears here.</EmptyState>}
            </div>
          </div>
        </div>
      </section>

      {spreads.length > 0 && (
        <section>
          <SectionHead title={`The same model should not cost ${Math.round(spreads[0].spread.ratio)}× more`} eyebrow="The buyer’s edge" eyebrowTone="warn" href="/browse" label="Check every model" />
          <p className="-mt-2 mb-5 max-w-3xl text-sm leading-relaxed text-black/60">
            {spreadSummary(spreads[0].group, spreads[0].spread)} These comparisons use blended price, require the model&rsquo;s full context where possible, and exclude extreme listings.
          </p>
          <p className="micro-label mb-3 md:hidden">Swipe to compare the widest spreads →</p>
          <div className="no-scrollbar grid snap-x snap-mandatory auto-cols-[88%] grid-flow-col gap-4 overflow-x-auto pb-4 md:grid-flow-row md:grid-cols-3 md:overflow-visible md:pb-0">
            {spreads.map((row) => <div key={row.group.id} className="snap-start"><SpreadCard row={row} /></div>)}
          </div>
        </section>
      )}

      {valueBoard && (
        <section>
          <SectionHead title="What a dollar buys" eyebrow="Evidence, not claims" eyebrowTone="pos" href="/benchmarks" label="All benchmarks" />
          <ValueSpotlight board={valueBoard} />
        </section>
      )}

      <section>
        <div className="card overflow-hidden">
          <div className="grid gap-0 lg:grid-cols-[1fr_20rem]">
            <div className="p-6 sm:p-8">
              <Badge tone="special">Open weights</Badge>
              <h2 className="mt-4 text-3xl font-bold tracking-tight text-black">Self-hosting starts with the rent.</h2>
              <p className="mt-3 max-w-2xl text-base leading-relaxed text-black/60">
                {freelyUsable} tracked models are permissively licensed and downloadable without approval. The site calculates the minimum GPU-rent floor; it never pretends throughput is knowable from a model name.
              </p>
              <Link href="/self-host" className="button-primary mt-6">Price out self-hosting →</Link>
            </div>
            <div className="border-t border-black/10 bg-special-soft p-6 sm:p-8 lg:border-l lg:border-t-0">
              <p className="mono-label text-special">The honest verdict</p>
              <p className="mt-3 text-xl font-bold leading-snug text-black">Worth pricing out—or keep buying the API.</p>
              <p className="mt-3 text-sm leading-relaxed text-black/60">Every break-even is a lower bound that assumes a permanently saturated GPU.</p>
            </div>
          </div>
        </div>
      </section>

      <section>
        <div className="card relative overflow-hidden p-6 sm:p-9">
          <div className="absolute inset-y-0 left-0 w-2 bg-accent" aria-hidden="true" />
          <div className="grid items-end gap-8 lg:grid-cols-[1fr_auto]">
            <div>
              <Badge tone="accent">Weekly edition</Badge>
              <h2 className="mt-4 text-3xl font-bold tracking-tight text-black sm:text-4xl">The consequential changes, once a week.</h2>
              <p className="mt-3 max-w-2xl text-base leading-relaxed text-black/60">
                {weekEvents} catalog changes landed in the last 7 days. The digest separates launches, lab price moves and retirements from reseller noise—and says when the week was quiet.
              </p>
              <p className="micro-label mt-4">Auto-written from the same auditable diff log · no manufactured story</p>
            </div>
            <div className="flex flex-wrap gap-3 lg:justify-end">
              <Link href="/digest" className="button-primary">Read the weekly digest →</Link>
              <a href="/rss.xml" className="button-secondary">Subscribe via RSS →</a>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
