import Link from "next/link";
import { EventTypeBadge, changeText, eventTarget } from "@/components/event-card";
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
  { number: "01", title: "Find the right model", body: "Price, context, capability and evidence.", href: "/browse", cta: "Explore models" },
  { number: "02", title: "Compare a shortlist", body: "Two to four models, row by row.", href: "/compare", cta: "Start comparing" },
  { number: "03", title: "Price a workload", body: "Tokens in, tokens out, monthly bill.", href: "/calculator", cta: "Run the numbers" },
] as const;

function DailyBrief({
  story, syncedAgo, models, trackedModels, providers, weekEvents,
}: {
  story: Lede;
  syncedAgo: string;
  models: { id: string; name: string; lab: string }[];
  trackedModels: number;
  providers: number;
  weekEvents: number;
}) {
  return (
    <section className="hero-shell" aria-labelledby="daily-lede">
      <div className="hero-grid" aria-hidden="true" />
      <span className={`absolute inset-y-0 left-0 w-1.5 ${LEDE_RAIL[story.kind]}`} aria-hidden="true" />

      <div className="relative grid gap-8 lg:grid-cols-[minmax(0,1.2fr)_minmax(20rem,0.8fr)] lg:items-center">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={LEDE_TONE[story.kind]} bold>{LEDE_EYEBROW[story.kind]}</Badge>
            <span className="pill bg-white/70">
              <span className="h-2 w-2 rounded-full bg-pos-bright" aria-hidden="true" />
              Live{syncedAgo ? ` · synced ${syncedAgo}` : ""}
            </span>
          </div>
          <p className="mono-label mt-6 text-accent">What the AI model market did today</p>
          <h1 id="daily-lede" className="mt-2 max-w-3xl text-3xl font-bold leading-[1.08] tracking-tight text-black sm:text-5xl">
            {story.headline}
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-black/70 sm:text-lg">{story.body}</p>
          <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-3">
            <Link href={story.href} className="button-primary">{story.cta} →</Link>
            <Link href="/changelog" className="text-sm font-semibold text-accent hover:text-accent-strong">Today&rsquo;s changes →</Link>
          </div>
          <p className="micro-label mt-4">selected by: {story.rule}</p>
        </div>

        <aside className="card-flat bg-white/80 p-5 sm:p-6" aria-label="Model lookup and market coverage">
          <p className="mono-label text-accent">Check before you choose</p>
          <h2 className="mt-2 text-xl font-bold tracking-tight text-black">One model. Every provider.</h2>
          <p className="mt-2 text-sm leading-relaxed text-black/60">Published prices, context catches, evidence and recent changes in one place.</p>
          <div className="mt-4"><ModelSearch variant="hero" models={models} /></div>
          <dl className="mt-5 grid grid-cols-3 divide-x divide-black/10 border-t border-black/10 pt-4">
            <div className="pr-3">
              <dt className="micro-label">tracked</dt>
              <dd className="mt-1 font-mono text-xl font-bold tabular-nums text-black">{trackedModels}</dd>
              <dd className="text-xs text-black/45">models</dd>
            </div>
            <div className="px-3">
              <dt className="micro-label">coverage</dt>
              <dd className="mt-1 font-mono text-xl font-bold tabular-nums text-black">{providers}</dd>
              <dd className="text-xs text-black/45">providers</dd>
            </div>
            <div className="pl-3">
              <dt className="micro-label">7-day tape</dt>
              <dd className="mt-1 font-mono text-xl font-bold tabular-nums text-black">{weekEvents}</dd>
              <dd className="text-xs text-black/45">changes</dd>
            </div>
          </dl>
          <p className="micro-label mt-4 leading-relaxed">A dash means unlisted, not free · verify before purchasing</p>
        </aside>
      </div>
    </section>
  );
}

function DecisionStrip() {
  return (
    <section aria-labelledby="decision-heading">
      <h2 id="decision-heading" className="sr-only">Start with a decision</h2>
      <div className="card-flat grid overflow-hidden md:grid-cols-3">
        {DECISIONS.map((decision, index) => (
          <Link
            key={decision.number}
            href={decision.href}
            className={`group flex items-center gap-4 p-4 transition-colors hover:bg-accent-soft sm:p-5 ${index > 0 ? "border-t border-black/10 md:border-l md:border-t-0" : ""}`}
          >
            <span className="font-mono text-sm font-bold tabular-nums text-accent">{decision.number}</span>
            <span className="min-w-0 flex-1">
              <span className="block font-bold text-black group-hover:text-accent">{decision.title}</span>
              <span className="mt-0.5 block text-xs text-black/45">{decision.body}</span>
            </span>
            <span className="shrink-0 text-sm font-semibold text-accent" aria-hidden="true">→</span>
            <span className="sr-only">{decision.cta}</span>
          </Link>
        ))}
      </div>
    </section>
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

function WireList({ events, eventHref }: { events: Event[]; eventHref: (event: Event) => string | null }) {
  if (events.length === 0) return <EmptyState>Baseline captured — the next detected change appears here.</EmptyState>;
  return (
    <ol className="divide-y divide-black/10">
      {events.slice(0, 3).map((event) => {
        const href = eventHref(event);
        const content = (
          <div className="group py-3">
            <div className="flex flex-wrap items-center gap-2">
              <EventTypeBadge type={event.type} />
              <span className="min-w-0 flex-1 truncate text-sm font-medium text-black group-hover:text-accent">{event.modelName}</span>
              <time className="font-mono text-xs tabular-nums text-black/35" dateTime={event.date}>{event.date.slice(5)}</time>
            </div>
            {event.changes[0] && <p className="mt-1 truncate font-mono text-xs text-black/45">{changeText(event.changes[0])}</p>}
          </div>
        );
        return <li key={event.id}>{href ? <Link href={href}>{content}</Link> : content}</li>;
      })}
    </ol>
  );
}

function MarketBoard({ labMoves, streetMoves, events, eventHref }: {
  labMoves: CollapsedMove[];
  streetMoves: CollapsedMove[];
  events: Event[];
  eventHref: (event: Event) => string | null;
}) {
  return (
    <section>
      <SectionHead title="The market, without the noise" eyebrow="Who moved · last 7 days" href="/changelog" label="Full changelog" />
      <div className="card grid overflow-hidden lg:grid-cols-3">
        <article className="p-5 sm:p-6">
          <div className="flex items-center justify-between gap-3"><h3 className="text-lg font-bold text-black">The labs</h3><Badge tone="pos">First party</Badge></div>
          <p className="mt-1 text-xs text-black/45">The model itself got cheaper or dearer.</p>
          <div className="mt-3"><MoveList items={labMoves} empty="No lab changed its own pricing this week — the tape is quiet." /></div>
        </article>
        <article className="border-t border-black/10 bg-special-soft p-5 sm:p-6 lg:border-l lg:border-t-0">
          <div className="flex items-center justify-between gap-3"><h3 className="text-lg font-bold text-black">The street</h3><Badge tone="special">Resellers</Badge></div>
          <p className="mt-1 text-xs text-black/45">Gateway markup moved. The model&rsquo;s price did not.</p>
          <div className="mt-3"><MoveList items={streetMoves} empty="No reseller changed its listing this week." /></div>
        </article>
        <article className="border-t border-black/10 p-5 sm:p-6 lg:border-l lg:border-t-0">
          <div className="flex items-center justify-between gap-3"><h3 className="text-lg font-bold text-black">The wire</h3><Badge tone="accent">Latest</Badge></div>
          <p className="mt-1 text-xs text-black/45">The newest changes across the catalog.</p>
          <div className="mt-3"><WireList events={events} eventHref={eventHref} /></div>
        </article>
      </div>
    </section>
  );
}

function spreadPrices(row: SpreadRow) {
  const pick = row.spread.cheapestFullContext ?? row.spread.cheapest;
  return { pick, low: blendPrice(pick.cost.input!, pick.cost.output!), high: blendPrice(row.spread.dearest.cost.input!, row.spread.dearest.cost.output!) };
}

function SpreadFeature({ row }: { row: SpreadRow }) {
  const { pick, low, high } = spreadPrices(row);
  return (
    <Link href={`/m/${row.group.id}`} className="card lift group block h-full overflow-hidden">
      <div className="border-b border-black/10 bg-warn-soft p-5 sm:p-7">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <Badge tone="warn">Widest credible spread</Badge>
            <h3 className="mt-3 truncate text-2xl font-bold tracking-tight text-black">{row.group.name}</h3>
            <p className="mono-label mt-1">{labName(row.group.labId)} · {row.spread.ranked.length} priced listings</p>
          </div>
          <div className="shrink-0 text-right"><p className="font-mono text-4xl font-bold tabular-nums text-warn">{row.spread.ratio.toFixed(1)}×</p><p className="micro-label mt-1">same weights</p></div>
        </div>
      </div>
      <div className="p-5 sm:p-7">
        <p className="text-sm leading-relaxed text-black/60">{spreadSummary(row.group, row.spread)}</p>
        <dl className="mt-5 grid grid-cols-[1fr_auto_1fr] items-end gap-3 border-t border-black/10 pt-5 font-mono tabular-nums">
          <div><dt className="micro-label">lowest full-context</dt><dd className="mt-1 text-xl font-bold text-black">{fmtPerM(low)}</dd><dd className="truncate text-xs text-black/45">{pick.providerName}</dd></div>
          <div className="pb-4 text-black/35">→</div>
          <div className="text-right"><dt className="micro-label">highest in range</dt><dd className="mt-1 text-xl font-bold text-black">{fmtPerM(high)}</dd><dd className="truncate text-xs text-black/45">{row.spread.dearest.providerName}</dd></div>
        </dl>
        <span className="mt-5 block text-sm font-semibold text-accent group-hover:text-accent-strong">Compare providers →</span>
      </div>
    </Link>
  );
}

function SpreadShortlist({ rows }: { rows: SpreadRow[] }) {
  return (
    <div className="card-flat h-full overflow-hidden">
      <div className="border-b border-black/10 bg-surface-tint p-5"><p className="mono-label text-warn">Also worth shopping around</p><p className="mt-1 text-sm text-black/60">Credible blended-price spreads, with extreme listings removed.</p></div>
      <ol className="divide-y divide-black/10">
        {rows.map((row, index) => {
          const { pick, low, high } = spreadPrices(row);
          return (
            <li key={row.group.id}>
              <Link href={`/m/${row.group.id}`} className="group block p-5 transition-colors hover:bg-accent-soft">
                <div className="flex items-center gap-3"><span className="font-mono text-xs tabular-nums text-black/35">0{index + 2}</span><span className="min-w-0 flex-1 truncate font-bold text-black group-hover:text-accent">{row.group.name}</span><Badge tone="warn" mono bold>{row.spread.ratio.toFixed(1)}×</Badge></div>
                <div className="mt-3 flex items-center justify-between gap-3 font-mono text-xs tabular-nums text-black/45"><span className="truncate">{pick.providerName}</span><span className="shrink-0 text-black">{fmtPerM(low)} → {fmtPerM(high)}</span></div>
              </Link>
            </li>
          );
        })}
      </ol>
      <div className="border-t border-black/10 p-5"><Link href="/browse" className="text-sm font-semibold text-accent hover:text-accent-strong">Check every model →</Link></div>
    </div>
  );
}

function ValueSpotlight({ board }: { board: ReturnType<typeof rankableBoards>[number] }) {
  const leaders = valueLeaders(board).slice(0, 3);
  const home = benchmarkHome(board.name);
  return (
    <section>
      <SectionHead title="What a dollar buys" eyebrow="Evidence, not claims" eyebrowTone="pos" href="/benchmarks" label="All benchmarks" />
      <div className="card overflow-hidden">
        <div className="grid lg:grid-cols-[minmax(0,0.75fr)_minmax(0,1.25fr)]">
          <div className="border-b border-black/10 p-5 sm:p-7 lg:border-b-0 lg:border-r">
            <Badge tone="pos">Independent measurement</Badge>
            <h3 className="mt-3 text-2xl font-bold tracking-tight text-black">Coding value on {board.name}</h3>
            <p className="mt-2 text-sm leading-relaxed text-black/60">Benchmark score per blended dollar. {board.independent.length} independently measured scores; self-reported claims never enter this ranking.</p>
            <div className="mt-5 flex gap-4 text-sm font-semibold">{home && <a href={home} target="_blank" rel="noreferrer" className="text-black/60 hover:text-black">Source ↗</a>}<Link href={`/benchmarks/${board.slug}`} className="text-accent hover:text-accent-strong">Full board →</Link></div>
          </div>
          <ol className="divide-y divide-black/10">
            {leaders.map((entry, index) => (
              <li key={entry.groupId} className="grid grid-cols-[2rem_minmax(0,1fr)_auto] items-center gap-3 px-5 py-4 sm:px-7">
                <span className="font-mono text-xs font-bold tabular-nums text-black/35">0{index + 1}</span>
                <span className="min-w-0"><Link href={`/m/${entry.groupId}`} className="block truncate font-bold text-black hover:text-accent">{entry.groupName}</Link><span className="font-mono text-xs tabular-nums text-black/45">score {entry.score}</span></span>
                <strong className="font-mono text-lg tabular-nums text-pos">{Math.round(entry.pointsPerDollar!).toLocaleString("en-US")} pts/$</strong>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}

function weeklyCount(events: Event[]): number {
  const cutoff = Date.now() - 7 * 86_400_000;
  return events.filter((event) => Date.parse(`${event.date}T00:00:00Z`) >= cutoff).length;
}

export default async function HomePage() {
  const [catalog, events, boards, weights, meta] = await Promise.all([getCatalog(), getEvents(), getBenchmarkBoards(), getWeights(), getSnapshotMeta()]);
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
    <div className="space-y-12 lg:space-y-14">
      <DailyBrief story={story} syncedAgo={syncedAgo} models={searchModels} trackedModels={catalog.stats.models} providers={catalog.stats.providers} weekEvents={weekEvents} />
      <DecisionStrip />
      <MarketBoard labMoves={labMoves} streetMoves={streetMoves} events={events} eventHref={eventHref} />

      {spreads.length > 0 && (
        <section>
          <SectionHead title="Shop the model, not the markup" eyebrow="Same weights · different bill" eyebrowTone="warn" />
          <p className="-mt-2 mb-5 max-w-3xl text-sm leading-relaxed text-black/60">The widest credible gaps in today&rsquo;s market, compared on blended price and full context. Extreme listings are excluded before anything reaches this board.</p>
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1.25fr)_minmax(20rem,0.75fr)]"><SpreadFeature row={spreads[0]} />{spreads.length > 1 && <SpreadShortlist rows={spreads.slice(1)} />}</div>
        </section>
      )}

      {valueBoard && <ValueSpotlight board={valueBoard} />}

      <section>
        <div className="card overflow-hidden">
          <div className="grid lg:grid-cols-[minmax(0,1.25fr)_minmax(18rem,0.75fr)]">
            <div className="p-5 sm:p-7"><Badge tone="special">Open weights</Badge><h2 className="mt-3 text-2xl font-bold tracking-tight text-black">Self-hosting starts with the rent.</h2><p className="mt-2 max-w-2xl text-sm leading-relaxed text-black/60">{freelyUsable} tracked models are permissively licensed and downloadable without approval. We calculate the minimum GPU-rent floor; we do not pretend throughput is knowable from a model name.</p><Link href="/self-host" className="mt-5 inline-block text-sm font-semibold text-accent hover:text-accent-strong">Price out self-hosting →</Link></div>
            <aside className="border-t border-black/10 bg-special-soft p-5 sm:p-7 lg:border-l lg:border-t-0"><p className="mono-label text-special">The honest verdict</p><p className="mt-2 text-lg font-bold leading-snug text-black">Worth pricing out—or keep buying the API.</p><p className="mt-2 text-sm leading-relaxed text-black/60">Every break-even is a lower bound that assumes a permanently saturated GPU.</p></aside>
          </div>
        </div>
      </section>

      <section>
        <div className="card relative overflow-hidden p-5 sm:p-7">
          <div className="absolute inset-y-0 left-0 w-1.5 bg-accent" aria-hidden="true" />
          <div className="grid items-center gap-6 lg:grid-cols-[1fr_auto]">
            <div><Badge tone="accent">Weekly edition</Badge><h2 className="mt-3 text-2xl font-bold tracking-tight text-black">The consequential changes, once a week.</h2><p className="mt-2 max-w-3xl text-sm leading-relaxed text-black/60">{weekEvents} catalog changes landed in the last 7 days. The digest separates launches, lab price moves and retirements from reseller noise—and says when the week was quiet.</p><p className="micro-label mt-3">Auto-written from the auditable diff log · no manufactured story</p></div>
            <div className="flex flex-wrap gap-x-5 gap-y-2 lg:justify-end"><Link href="/digest" className="text-sm font-semibold text-accent hover:text-accent-strong">Read the digest →</Link><a href="/rss.xml" className="text-sm font-semibold text-black/60 hover:text-black">Subscribe via RSS →</a></div>
          </div>
        </div>
      </section>
    </div>
  );
}
