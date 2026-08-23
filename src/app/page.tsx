import Link from "next/link";
import { ModelSearch } from "@/components/model-search";
import { Subscribe } from "@/components/subscribe";
import { Badge, DeltaChip, EmptyState, SectionHead } from "@/components/ui";
import { getCatalog, getEvents, getNews, getSnapshotMeta, groupContext, groupReleaseDate, liveListings } from "@/lib/data";
import { retirementOf } from "@/lib/data/retirement";
import { buildBaskets } from "@/lib/economics/instruments";
import { widestMarkups } from "@/lib/economics/basis";
import { onTopic, toStories } from "@/lib/data/stories";
import { getPriceArchive } from "@/lib/data/archive";
import { coverage, observedEvents, windowLabel, type Coverage } from "@/lib/data/coverage";
import { DEFAULT_WORKLOAD, ratePerMillion } from "@/lib/economics/workload";
import {
  collapseByModel,
  labName,
  lede,
  marketMoves,
  type CollapsedMove,
  type Lede,
} from "@/lib/data/brief";
import { getBenchmarkBoards, rankableBoards, valueLeaders } from "@/lib/data/benchmarks";
import { spreadSummary, widestSpreads, type SpreadRow } from "@/lib/data/market";
import { fmtMonthlyUsd, hostableCases } from "@/lib/data/selfhost";
import { getWeights, isFreelyUsable } from "@/lib/data/weights";
import { fmtAgo, fmtDate, fmtPerM, fmtTokens } from "@/lib/format";
import type { Event, NewsItem } from "@/lib/pipeline/types";

const LEDE_TONE: Record<Lede["kind"], "pos" | "neg" | "accent" | "warn" | "special"> = {
  cut: "pos",
  launch: "pos",
  hike: "neg",
  sunset: "neg",
  street: "special",
  quiet: "accent",
};

const LEDE_EYEBROW: Record<Lede["kind"], string> = {
  cut: "Price cut",
  launch: "New release",
  hike: "Price rise",
  sunset: "Deprecations",
  street: "Reseller move",
  quiet: "Quiet week",
};

/*
 * Homepage information architecture — five modules, in this order, for reasons:
 *
 *   1. Lead          the day's story + what this site is + search
 *   2. The gap       the one fact nobody else publishes, at full size
 *   3. The tape      who moved, split first-party vs street
 *   4. Three answers cost / evidence / self-host, each carrying a live number
 *   5. Subscribe     the return mechanism
 *
 * What was removed and why:
 *
 * - **The "Start with a decision" strip.** Three cards reading Find models /
 *   Compare / Calculator, restating the top nav verbatim, in the highest-CTR
 *   band on the page. It carried no information a visitor could not get from
 *   the header, and it occupied the position where the site's strongest claim
 *   should sit. Replaced by module 4, where every card states a live figure.
 * - **"The wire".** A three-item stub of the newest events, beside two other
 *   modules built from the same event log. Three views of one dataset reads as
 *   volume, not as editing. `/changelog` is the wire, and is one click away.
 * - **The hero's vanity stats** (343 models / 193 providers / 170 changes).
 *   Supply-side brags. Nobody returns to a site because it tracks 343 models;
 *   they return because it told them something. The rail now carries the
 *   widest credible price gap in the live market instead.
 */

function Lead({
  story,
  syncedAgo,
  models,
  glance,
}: {
  story: Lede;
  syncedAgo: string | null;
  models: { id: string; name: string; lab: string }[];
  glance: GlanceStat[];
}) {
  return (
    <section className="hero-shell" aria-labelledby="daily-lede">
      <div className="relative grid lg:grid-cols-[minmax(0,1.25fr)_minmax(20rem,0.75fr)]">
        <div className="p-6 sm:p-9 lg:p-12">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={LEDE_TONE[story.kind]} bold>{LEDE_EYEBROW[story.kind]}</Badge>
            <span className="pill bg-white/70">
              <span className="h-2 w-2 rounded-full bg-pos-bright" aria-hidden="true" />
              Live{syncedAgo ? ` · synced ${syncedAgo}` : ""}
            </span>
          </div>

          {/*
            A cold visitor arriving from a shared link sees a news headline and
            no idea what the publication is. One standfirst line fixes that
            without displacing the story.
          */}
          <p className="mt-6 max-w-xl text-sm leading-relaxed text-black/60">
            Independent price and benchmark analysis for AI models — what a workload actually costs,
            and where to buy it.
          </p>

          <h1 id="daily-lede" className="mt-3 max-w-3xl text-3xl font-bold leading-[1.08] tracking-[-0.03em] text-black sm:text-4xl">
            {story.headline}
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-black/70 sm:text-lg">{story.body}</p>
          <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-3">
            <Link href={story.href} className="button-primary">{story.cta} →</Link>
            <Link href="/changelog" className="text-sm font-semibold text-accent hover:text-accent-strong">Today&rsquo;s changes →</Link>
          </div>
          <p className="micro-label mt-4">selected by: {story.rule}</p>
        </div>

        <aside className="border-t border-black/15 bg-surface-tint p-6 sm:p-9 lg:border-l lg:border-t-0 lg:p-10" aria-label="Market at a glance and model lookup">
          <p className="mono-label text-accent">Market at a glance</p>
          <dl className="mt-4 divide-y divide-black/10 border-y border-black/10">
            {glance.map((g) => (
              <div key={g.label} className="flex items-baseline justify-between gap-3 py-2.5">
                <dt className="min-w-0">
                  <span className="block text-sm font-medium text-black">{g.label}</span>
                  {g.detail && (
                    <span className="mt-0.5 block truncate text-xs text-black/60">{g.detail}</span>
                  )}
                </dt>
                <dd className="shrink-0 font-mono text-base font-bold tabular-nums text-black">
                  {g.href ? (
                    <Link href={g.href} className="transition-colors hover:text-accent">{g.value}</Link>
                  ) : (
                    g.value
                  )}
                </dd>
              </div>
            ))}
          </dl>
          <Link href="/exchange" className="mt-3 inline-block text-sm font-semibold text-accent hover:text-accent-strong">
            The whole market →
          </Link>

          <div className="mt-6 border-t border-black/10 pt-5">
            <p className="micro-label mb-2">Look up any model</p>
            <ModelSearch variant="hero" models={models} />
            <p className="micro-label mt-3 leading-relaxed">A dash means unlisted, not free · verify before purchasing</p>
          </div>
        </aside>
      </div>
    </section>
  );
}

interface GlanceStat {
  label: string;
  detail: string | null;
  value: string;
  href: string | null;
}

/**
 * The press column.
 *
 * The site collects scored, model-tagged coverage from Reuters, Wired, CNBC and
 * the labs' own announcements every day, and until now the homepage ignored all
 * of it. A market publication that reports price movements but not the news
 * that caused them is reporting half the story — and the outbound link is what
 * makes a front page feel like a front page rather than a database view.
 */
function Press({ stories }: { stories: { item: NewsItem; modelName: string | null; modelId: string | null }[] }) {
  if (stories.length === 0) {
    return <EmptyState>No model-linked coverage passed today’s relevance checks.</EmptyState>;
  }
  return (
    <ol className="divide-y divide-black/10">
      {stories.map(({ item, modelName, modelId }) => (
        <li key={item.id} className="py-3 first:pt-0">
          <a
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-medium leading-snug text-black transition-colors hover:text-accent"
          >
            {item.title}
          </a>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-black/60">
            <span className="font-medium">{item.source}</span>
            {item.publishedAt && <span>· {fmtAgo(item.publishedAt)}</span>}
            {modelId && modelName && (
              <Link href={`/m/${modelId}`} className="ml-auto transition-opacity hover:opacity-80">
                <Badge tone="accent">{modelName}</Badge>
              </Link>
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}

function MoveList({ items }: { items: CollapsedMove[] }) {
  return (
    <ol className="divide-y divide-black/10">
      {items.map((m, i) => (
        <li key={m.id} className="flex items-center justify-between gap-3 py-2.5">
          <span className="min-w-0">
            <span className="mr-1.5 font-mono text-xs tabular-nums text-black/45">{String(i + 1).padStart(2, "0")}</span>
            {m.id ? (
              <Link href={`/m/${m.id}`} className="font-medium transition-colors hover:text-accent">
                {m.name}
              </Link>
            ) : (
              <span className="font-medium text-black">{m.name}</span>
            )}
            <span className="mt-0.5 block truncate pl-6 font-mono text-xs tabular-nums text-black/60">
              {fmtPerM(m.from)} → {fmtPerM(m.to)} /M ·{" "}
              {m.venues > 1 ? `${m.venues} venues` : m.providerName ?? "—"}
            </span>
          </span>
          <DeltaChip down={m.to < m.from} pct={Math.abs(m.to / m.from - 1)} digits={0} />
        </li>
      ))}
    </ol>
  );
}

/**
 * A block only renders when it has something to say.
 *
 * The homepage used to print "No lab changed its own pricing this week" inside a
 * bordered empty state — a card whose entire content was the absence of content.
 * A reader scanning the page has to stop, read it, and work out that nothing
 * happened. On a front page that is wasted attention: if there is no story, the
 * space belongs to a section that has one.
 *
 * The quiet week still gets said — once, in the lede, where `brief.ts#lede` is
 * built to say it. It does not need repeating in every module that came up empty.
 */
function Wire({
  labMoves,
  streetMoves,
  stories,
}: {
  labMoves: CollapsedMove[];
  streetMoves: CollapsedMove[];
  stories: { item: NewsItem; modelName: string | null; modelId: string | null }[];
}) {
  const hasTape = labMoves.length > 0 || streetMoves.length > 0;
  const hasPress = stories.length > 0;
  if (!hasTape && !hasPress) return null;

  return (
    <section>
      <SectionHead
        title="The wire"
        eyebrow={hasPress && hasTape ? "What was written · what actually changed" : hasPress ? "What was written" : "What actually changed"}
        href="/changelog"
        label="Full changelog"
      />
      <div className={`mt-3 grid gap-6 ${hasPress && hasTape ? "lg:grid-cols-2" : ""}`}>
        {hasPress && (
          <article className="card p-5">
            <div className="flex items-baseline justify-between gap-2">
              <div className="flex items-baseline gap-2">
                <Badge tone="accent" bold>In the press</Badge>
                <span className="micro-label">model-linked coverage</span>
              </div>
              <Link href="/news" className="text-xs font-semibold text-accent hover:text-accent-strong">
                All news →
              </Link>
            </div>
            <div className="mt-3">
              <Press stories={stories} />
            </div>
          </article>
        )}

        {hasTape && (
          <article className="card flex flex-col gap-5 p-5">
            {labMoves.length > 0 && (
              <div>
                <div className="flex items-baseline gap-2">
                  <Badge tone="pos" bold>The labs</Badge>
                  <span className="micro-label">first party · the model itself repriced</span>
                </div>
                <div className="mt-2">
                  <MoveList items={labMoves} />
                </div>
              </div>
            )}
            {streetMoves.length > 0 && (
              <div className={labMoves.length > 0 ? "border-t border-black/10 pt-4" : ""}>
                <div className="flex items-baseline gap-2">
                  <Badge tone="special" bold>The street</Badge>
                  <span className="micro-label">resellers · markup moved, the model did not</span>
                </div>
                <div className="mt-2">
                  <MoveList items={streetMoves} />
                </div>
              </div>
            )}
          </article>
        )}
      </div>
    </section>
  );
}


/**
 * The section deck — the part of a front page that makes it a publication
 * rather than a landing page.
 *
 * A reader who is not here for today's lead story still needs somewhere to go,
 * and the site holds far more than five modules' worth of answers: release
 * dates, licence classes, break-evens, gateway markups, context windows,
 * retirement notices, benchmark value. Each card below is a real leaderboard cut
 * from live data with a route into the page that owns it.
 *
 * A card with no rows does not render. An empty bordered box that says nothing
 * happened costs the reader attention and returns nothing.
 */
const ROW_TONE: Record<NonNullable<DeckRow["tone"]>, string> = {
  pos: "text-pos",
  neg: "text-neg",
  warn: "text-warn",
  special: "text-special",
  accent: "text-accent",
};

interface DeckRow {
  id: string;
  label: string;
  sub: string;
  value: string;
  tone?: "pos" | "neg" | "warn" | "special" | "accent";
  href: string;
}

function DeckCard({
  eyebrow, tone, title, blurb, rows, href, cta,
}: {
  eyebrow: string;
  tone: "accent" | "pos" | "neg" | "warn" | "special";
  title: string;
  blurb: string;
  rows: DeckRow[];
  href: string;
  cta: string;
}) {
  if (rows.length === 0) return null;
  return (
    <article className="card flex flex-col p-5">
      <div className="flex items-baseline gap-2">
        <Badge tone={tone} bold>{eyebrow}</Badge>
      </div>
      <h3 className="mt-2.5 text-lg font-bold leading-snug tracking-tight text-black">{title}</h3>
      <p className="mt-1 text-xs leading-relaxed text-black/60">{blurb}</p>
      <ol className="mt-3 flex-1 divide-y divide-black/10 border-t border-black/10">
        {rows.map((r) => (
          <li key={r.id}>
            <Link
              href={r.href}
              className="flex items-baseline justify-between gap-3 py-2 transition-colors hover:text-accent"
            >
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium text-black">{r.label}</span>
                <span className="mt-0.5 block truncate text-xs text-black/60">{r.sub}</span>
              </span>
              <span className={`shrink-0 font-mono text-sm font-semibold tabular-nums ${r.tone ? ROW_TONE[r.tone] : "text-black"}`}>
                {r.value}
              </span>
            </Link>
          </li>
        ))}
      </ol>
      <Link href={href} className="mt-3 text-sm font-semibold text-accent hover:text-accent-strong">
        {cta} →
      </Link>
    </article>
  );
}

function Deck({ cards }: { cards: React.ReactNode[] }) {
  const live = cards.filter(Boolean);
  if (live.length === 0) return null;
  return (
    <section aria-label="Data boards">
      <SectionHead title="The boards" eyebrow="Every cut of today's data" />
      <div className="mt-3 grid gap-4 md:grid-cols-2 xl:grid-cols-3">{live}</div>
    </section>
  );
}

/**
 * The evidence behind the hero's headline number — deliberately a list, not a
 * second feature card. The lead model already has the largest type on the page;
 * restating it in a hero-sized panel directly underneath was the same fact
 * twice, which is exactly the duplication this layout exists to remove.
 */
function TheGap({ rows, leadSummary }: { rows: SpreadRow[]; leadSummary: string }) {
  return (
    <section>
      <SectionHead
        title="Same weights. Wildly different bill."
        eyebrow="The gap nobody else publishes"
        eyebrowTone="warn"
        href="/exchange"
        label="The exchange"
      />
      <p className="mt-2 max-w-3xl text-sm leading-relaxed text-black/60">
        A model is not one price. It is a spread across every venue that sells it, and the ends of
        that spread are further apart than almost anyone assumes. Listings no second venue comes
        close to are dropped as feed errors before anything reaches this board.
      </p>
      <p className="mt-2 max-w-3xl text-sm leading-relaxed text-black/70">{leadSummary}</p>
      <ul className="card mt-4 divide-y divide-black/10">
        {rows.map((r, i) => {
          const pick = r.spread.cheapestFullContext ?? r.spread.cheapest;
          return (
            <li key={r.group.id}>
              <Link
                href={`/m/${r.group.id}`}
                className="grid grid-cols-[auto_1fr_auto] items-center gap-x-3 gap-y-1 px-4 py-3 transition-colors hover:bg-surface-tint sm:grid-cols-[auto_minmax(0,1fr)_auto_auto]"
              >
                <span className="font-mono text-xs tabular-nums text-black/45">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="min-w-0">
                  <span className="block truncate font-medium text-black">{r.group.name}</span>
                  <span className="mt-0.5 block truncate text-xs text-black/60">
                    {r.spread.ranked.length} priced listings · cheapest full context at{" "}
                    {pick.providerName}
                  </span>
                </span>
                <span className="col-start-2 font-mono text-xs tabular-nums text-black/70 sm:col-start-auto sm:text-right">
                  <span className="text-pos">{fmtPerM(ratePerMillion(pick.cost, DEFAULT_WORKLOAD))}</span>
                  {" → "}
                  <span className="text-neg">{fmtPerM(ratePerMillion(r.spread.dearest.cost, DEFAULT_WORKLOAD))}</span>
                </span>
                <span className="col-start-3 row-start-1 shrink-0 text-right font-mono text-lg font-bold tabular-nums text-warn sm:col-start-auto sm:row-start-auto">
                  {r.spread.ratio.toFixed(1)}×
                </span>
              </Link>
            </li>
          );
        })}
      </ul>

    </section>
  );
}

/**
 * The router. Replaces the generic three-card nav strip: each card answers a
 * question with a number computed today, so the click is a continuation rather
 * than a repeat of the header.
 */
function ThreeAnswers({
  cheapest,
  valueLeader,
  hosting,
  notIndependentPct,
}: {
  cheapest: { name: string; id: string; rate: number } | null;
  valueLeader: { name: string; id: string; board: string; score: number } | null;
  hosting: { name: string; id: string; usdPerMonth: number; gpu: string } | null;
  /** Measured from the live boards, not quoted from a doc that can drift. */
  notIndependentPct: number;
}) {
  return (
    <section aria-labelledby="answers-heading">
      <h2 id="answers-heading" className="sr-only">What we computed today</h2>
      <div className="grid gap-4 md:grid-cols-3">
        <AnswerCard
          eyebrow="What will it cost?"
          tone="accent"
          question="Sticker price is a rate, not a bill."
          body="Pick the shape of your traffic — chat, RAG, agentic, long-context — and get the monthly number, cache writes and context tiers included."
          stat={cheapest ? fmtPerM(cheapest.rate) : null}
          statLabel={cheapest ? `cheapest workhorse · ${cheapest.name}` : null}
          href="/calculator"
          cta="Price a workload"
        />
        <AnswerCard
          eyebrow="Is it any good?"
          tone="pos"
          question={`${notIndependentPct}% of published scores are not independently measured.`}
          body="We rank on independently measured results only, and price each benchmark for the token profile it actually exercises."
          stat={valueLeader ? fmtCompact(valueLeader.score) : null}
          statLabel={valueLeader ? `pts/$ leader · ${valueLeader.name} on ${valueLeader.board}` : null}
          href="/benchmarks"
          cta="See the evidence"
        />
        <AnswerCard
          eyebrow="Should I host it?"
          tone="special"
          question="The rent is the floor, and it is higher than people expect."
          body="We compute the smallest configuration the weights fit on. Throughput is not knowable from a model name, so every break-even here is a lower bound."
          stat={hosting ? fmtMonthlyUsd(hosting.usdPerMonth) : null}
          statLabel={hosting ? `lowest floor · ${hosting.name} on ${hosting.gpu}` : null}
          href="/self-host"
          cta="Price out self-hosting"
        />
      </div>
    </section>
  );
}

function AnswerCard({
  eyebrow, tone, question, body, stat, statLabel, href, cta,
}: {
  eyebrow: string;
  tone: "accent" | "pos" | "special";
  question: string;
  body: string;
  stat: string | null;
  statLabel: string | null;
  href: string;
  cta: string;
}) {
  return (
    <Link href={href} className="card lift group flex flex-col justify-between gap-4 p-5">
      <div>
        <Badge tone={tone} bold>{eyebrow}</Badge>
        <p className="mt-3 text-lg font-bold leading-snug tracking-tight text-black group-hover:text-accent">
          {question}
        </p>
        <p className="mt-2 text-sm leading-relaxed text-black/60">{body}</p>
      </div>
      <div className="border-t border-black/10 pt-3">
        {stat && (
          <>
            <p className="font-mono text-2xl font-bold tabular-nums text-black">{stat}</p>
            <p className="micro-label mt-0.5 truncate">{statLabel}</p>
          </>
        )}
        <p className="mt-2 text-sm font-semibold text-accent">{cta} →</p>
      </div>
    </Link>
  );
}

function fmtCompact(n: number): string {
  return n >= 1000 ? Math.round(n).toLocaleString("en-US") : n.toFixed(1);
}

/** Changes inside the window we can actually cover, cold-start diff excluded. */
function tapeCount(events: Event[], c: Coverage, nowMs: number): number {
  const cutoff = nowMs - 7 * 86_400_000;
  return observedEvents(events, c).filter(
    (event) => Date.parse(`${event.date}T00:00:00Z`) >= cutoff,
  ).length;
}

export default async function HomePage() {
  const [catalog, events, boards, weights, meta, archive, news] = await Promise.all([
    getCatalog(), getEvents(), getBenchmarkBoards(), getWeights(), getSnapshotMeta(), getPriceArchive(),
    getNews(),
  ]);
  const syncedAgo = fmtAgo(meta.fetchedAt);
  const moves = marketMoves(events, catalog, 7);
  const story = lede(moves, catalog, events);
  const labMoves = collapseByModel(moves.firstParty).slice(0, 5);
  const streetMoves = collapseByModel(moves.street).slice(0, 5);
  const spreads = widestSpreads(catalog.tracked, 6, 6);
  const cov = coverage(events, archive);

  const valueBoard = rankableBoards(boards)[0];
  const topValue = valueBoard ? valueLeaders(valueBoard, 1)[0] : undefined;
  const cheapWorkhorse = [...catalog.tracked]
    .filter((g) => g.best != null)
    .map((g) => ({ g, rate: ratePerMillion(g.best!.cost, DEFAULT_WORKLOAD) }))
    .filter((x) => Number.isFinite(x.rate) && x.rate >= 0.3 && x.rate <= 2)
    .sort((a, b) => a.rate - b.rate)[0];
  const topHost = hostableCases(catalog.tracked, weights.models, 1)[0];

  // The share of scored rows nobody independent measured. Computed from the
  // live boards so the claim cannot drift away from the data behind it.
  const scored = boards.flatMap((b) => b.entries);
  const notIndependentPct = scored.length
    ? Math.round((scored.filter((e) => e.provenance !== "independent").length / scored.length) * 100)
    : 0;

  const searchModels = catalog.tracked.map((group) => ({ id: group.id, name: group.name, lab: group.labId }));

  // Coverage the catalog can actually resolve to a model — an untagged story is
  // a link with nowhere to go, which is the whole reason /news tags them.
  const stories = toStories(onTopic(news))
    .slice(0, 6)
    .map(({ lead }) => {
      const modelId = lead.modelIds.find((id) => catalog.groupById.has(id)) ?? null;
      return {
        item: lead,
        modelId,
        modelName: modelId ? (catalog.groupById.get(modelId)?.name ?? null) : null,
      };
    });

  const repricedToday = events.filter(
    (e) => e.type === "repriced" && e.date === (meta.date ?? ""),
  ).length;
  const longContextFloor = [...catalog.tracked]
    .filter((g) => g.best != null && (groupContext(g) ?? 0) >= 1_000_000)
    .map((g) => ({ g, rate: ratePerMillion(g.best!.cost, DEFAULT_WORKLOAD) }))
    .filter((x) => Number.isFinite(x.rate))
    .sort((a, b) => a.rate - b.rate)[0];

  const freelyUsable = new Set(
    Object.values(weights.models).filter(isFreelyUsable).map((f) => f.groupId),
  );
  const rate = (g: (typeof catalog.tracked)[number]) =>
    g.best ? ratePerMillion(g.best.cost, DEFAULT_WORKLOAD) : Number.POSITIVE_INFINITY;
  const DAY = 86_400_000;
  // The build's clock is the snapshot's own date, not wall time. A static export
  // rendered at 03:00 UTC and served all day must not drift its "last 21 days"
  // window away from the data it was built from.
  const now = Date.parse(`${meta.date ?? new Date().toISOString().slice(0, 10)}T00:00:00Z`);

  // Just shipped — release dates come from `groupReleaseDate`, which is also
  // what the new-release-visibility gate watches, so this can never silently
  // disagree with the changelog.
  const justShipped = catalog.tracked
    .map((g) => ({ g, released: groupReleaseDate(g) }))
    .filter((x): x is { g: typeof x.g; released: string } =>
      x.released != null && now - Date.parse(x.released) <= 21 * DAY)
    .sort((a, b) => b.released.localeCompare(a.released))
    .slice(0, 5);

  const baskets = buildBaskets(catalog.tracked, freelyUsable, DEFAULT_WORKLOAD);
  const markups = widestMarkups(catalog.tracked, DEFAULT_WORKLOAD, 5);
  const hostable = hostableCases(catalog.tracked, weights.models, 5);

  const longContext = catalog.tracked
    .map((g) => ({ g, ctx: groupContext(g) ?? 0, r: rate(g) }))
    .filter((x) => x.ctx >= 1_000_000 && Number.isFinite(x.r))
    .sort((a, b) => b.ctx - a.ctx || a.r - b.r)
    .slice(0, 5);

  const freeToTry = catalog.tracked
    .filter((g) => g.free && liveListings(g).length > 0)
    .map((g) => ({ g, providers: liveListings(g).length }))
    .sort((a, b) => b.providers - a.providers)
    .slice(0, 5);

  // Withdrawn at one venue but alive elsewhere — a migration notice, which is
  // the actionable half of the deprecation feed.
  const migrating = catalog.groups
    .map((g) => ({ g, r: retirementOf(g) }))
    .filter((x) => x.r.partiallyRetired)
    .sort((a, b) => b.r.retiredProviders.length - a.r.retiredProviders.length)
    .slice(0, 5);

  const valueRows = valueBoard ? valueLeaders(valueBoard, 5) : [];

  const glance: (GlanceStat | null)[] = [
    spreads[0]
      ? {
          label: "Widest price gap",
          detail: `${spreads[0].group.name} · ${spreads[0].spread.ranked.length} listings`,
          value: `${spreads[0].spread.ratio.toFixed(1)}×`,
          href: `/m/${spreads[0].group.id}`,
        }
      : null,
    longContextFloor
      ? {
          label: "Cheapest 1M context",
          detail: longContextFloor.g.name,
          value: fmtPerM(longContextFloor.rate),
          href: `/m/${longContextFloor.g.id}`,
        }
      : null,
    {
      label: "Repriced today",
      detail: `across ${catalog.stats.providers} providers`,
      value: String(repricedToday),
      href: "/changelog",
    },
    {
      label: "Independently scored",
      detail: `of ${scored.length} published benchmark results`,
      value: `${100 - notIndependentPct}%`,
      href: "/benchmarks",
    },
  ];
  const glanceStats = glance.filter((x): x is GlanceStat => x !== null);

  return (
    <div className="space-y-12 lg:space-y-16">
      <Lead story={story} syncedAgo={syncedAgo} models={searchModels} glance={glanceStats} />

      {spreads.length > 0 && (
        <TheGap rows={spreads} leadSummary={spreadSummary(spreads[0].group, spreads[0].spread)} />
      )}

      <ThreeAnswers
        notIndependentPct={notIndependentPct}
        cheapest={cheapWorkhorse ? { name: cheapWorkhorse.g.name, id: cheapWorkhorse.g.id, rate: cheapWorkhorse.rate } : null}
        valueLeader={
          topValue && valueBoard
            ? { name: topValue.groupName, id: topValue.groupId, board: valueBoard.name, score: topValue.pointsPerDollar ?? 0 }
            : null
        }
        hosting={
          topHost?.floor
            ? { name: topHost.name, id: topHost.groupId, usdPerMonth: topHost.floor.usdPerMonth, gpu: `${topHost.floor.gpus}× ${topHost.floor.tier.name}` }
            : null
        }
      />

      <Wire labMoves={labMoves} streetMoves={streetMoves} stories={stories} />

      <Deck
        cards={[
          <DeckCard
            key="shipped"
            eyebrow="Just shipped"
            tone="pos"
            title="New in the last three weeks"
            blurb="Release dates as the labs published them, priced at the cheapest live listing."
            rows={justShipped.map(({ g, released }) => ({
              id: g.id,
              label: g.name,
              sub: `${labName(g.labId)} · ${fmtDate(released)}`,
              value: g.best ? fmtPerM(rate(g)) : "—",
              href: `/m/${g.id}`,
            }))}
            href="/changelog"
            cta="Full changelog"
          />,

          <DeckCard
            key="value"
            eyebrow="Evidence"
            tone="accent"
            title={valueBoard ? `Value on ${valueBoard.name}` : "Value on evidence"}
            blurb={`Score per dollar, priced for the ${valueBoard?.workload.name.toLowerCase() ?? "default"} profile. Independently measured results only.`}
            rows={valueRows.map((e) => ({
              id: e.groupId,
              label: e.groupName,
              sub: `${labName(e.labId)} · scored ${e.score}`,
              value: fmtCompact(e.pointsPerDollar ?? 0),
              tone: "pos" as const,
              href: `/m/${e.groupId}`,
            }))}
            href={valueBoard ? `/benchmarks/${valueBoard.slug}` : "/benchmarks"}
            cta="Full board"
          />,

          <DeckCard
            key="classes"
            eyebrow="Instruments"
            tone="special"
            title="What each class costs"
            blurb="Models grouped by the kind of purchase they are, with the median rate for the class."
            rows={baskets.map((b) => ({
              id: b.instrument.id,
              label: b.instrument.name,
              sub: `${b.constituents.length} models · cheapest ${b.cheapest!.group.name}`,
              value: fmtPerM(b.median),
              href: "/exchange",
            }))}
            href="/exchange"
            cta="The exchange"
          />,

          <DeckCard
            key="markup"
            eyebrow="Basis"
            tone="neg"
            title="Where the gateway markup is"
            blurb="Median reseller quote against the lab's own counter. Positive means you pay more on the street."
            rows={markups.map((m) => ({
              id: m.groupId,
              label: m.name,
              sub: `${m.quotes.length} quotes vs ${m.referenceProvider}`,
              value: `+${Math.round(m.medianBasis * 100)}%`,
              tone: "neg" as const,
              href: `/m/${m.groupId}`,
            }))}
            href="/exchange"
            cta="All basis"
          />,

          <DeckCard
            key="host"
            eyebrow="Open weights"
            tone="special"
            title="Lowest self-hosting floor"
            blurb="Monthly GPU rent for the smallest configuration the weights fit on. A floor, never a recommendation."
            rows={hostable.map((h) => ({
              id: h.groupId,
              label: h.name,
              sub: h.floor
                ? `${h.floor.gpus}× ${h.floor.tier.name}${h.licence ? ` · ${h.licence}` : ""}${h.gated ? " · gated" : ""}`
                : "—",
              value: h.floor ? fmtMonthlyUsd(h.floor.usdPerMonth) : "—",
              href: `/m/${h.groupId}`,
            }))}
            href="/self-host"
            cta="Price out hosting"
          />,

          <DeckCard
            key="context"
            eyebrow="Long context"
            tone="warn"
            title="Biggest windows, cheapest first"
            blurb="Models carrying a million tokens or more, with what a request actually costs there."
            rows={longContext.map(({ g, ctx, r }) => ({
              id: g.id,
              label: g.name,
              sub: `${labName(g.labId)} · ${fmtTokens(ctx)}`,
              value: fmtPerM(r),
              href: `/m/${g.id}`,
            }))}
            href="/browse"
            cta="Browse by context"
          />,

          <DeckCard
            key="migrating"
            eyebrow="Migration"
            tone="warn"
            title="Dropped by a venue, alive elsewhere"
            blurb="A provider withdrew its endpoint while others still serve the model. Re-point rather than replace."
            rows={migrating.map(({ g, r }) => ({
              id: g.id,
              label: g.name,
              sub: `gone from ${r.retiredProviders.slice(0, 2).join(", ")}${r.retiredProviders.length > 2 ? ` +${r.retiredProviders.length - 2}` : ""}`,
              value: `${r.liveProviders} left`,
              tone: "warn" as const,
              href: `/m/${g.id}`,
            }))}
            href="/deprecations"
            cta="All deprecations"
          />,

          <DeckCard
            key="free"
            eyebrow="Free tier"
            tone="pos"
            title="Genuinely free to try"
            blurb="At least one live listing published at zero for both input and output — not an unlisted price."
            rows={freeToTry.map(({ g, providers }) => ({
              id: g.id,
              label: g.name,
              sub: `${labName(g.labId)} · ${providers} live listing${providers === 1 ? "" : "s"}`,
              value: "$0",
              tone: "pos" as const,
              href: `/m/${g.id}`,
            }))}
            href="/browse"
            cta="Browse all"
          />,
        ]}
      />

      <Subscribe changeCount={tapeCount(events, cov, now)} windowLabel={windowLabel(cov)} />
    </div>
  );
}
