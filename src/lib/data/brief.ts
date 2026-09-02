import { groupContext, groupReleaseDate, type Catalog, type ModelGroup } from "./index";
import { DEFAULT_WORKLOAD, flatCost, ratePerMillion, type Workload } from "../economics/workload";
import { isFirstParty } from "./market";
import { archiveDepth, type PriceArchive } from "./archive";
import type { Event, VerifiedOffer } from "../pipeline/types";

/**
 * The editorial layer.
 *
 * Every other module here computes an aggregate; this one makes a claim. A page
 * of aggregates is a dashboard, and nobody subscribes to a dashboard — the
 * difference between this site and a spreadsheet is whether it can say what
 * today means. The rules below are deliberately explicit so the claim is always
 * defensible, and so a quiet day reads as a quiet day rather than as an empty
 * module.
 */

const DAY = 86_400_000;

export interface Move {
  id: string | null;
  name: string;
  labId: string | null;
  providerId: string | null;
  providerName: string | null;
  from: number;
  to: number;
  pct: number;
  date: string;
  /** Sold by the lab that trained the model, rather than a reseller. */
  firstParty: boolean;
}

interface MoveChain {
  name: string;
  id: string | null;
  labId: string | null;
  providerId: string | null;
  providerName: string | null;
  from: number;
  to: number;
  date: string;
  firstParty: boolean;
}

/**
 * Price moves over a window, split by who moved.
 *
 * A lab repricing its model is news. A gateway adjusting its markup is
 * inventory. Ranking them together put "DeepSeek V4 ▲214% via kilo" at the top
 * of the homepage, which is a margin change at a reseller nobody buys from.
 */
export function marketMoves(
  events: Event[],
  catalog: Catalog,
  days = 7,
  now: number = Date.now(),
): { firstParty: Move[]; street: Move[] } {
  const cutoff = now - days * DAY;
  const groupOfListing = new Map<string, ModelGroup>();
  for (const g of catalog.groups) for (const l of g.listings) groupOfListing.set(l.key, g);

  const chains = new Map<string, MoveChain>();
  const ordered = [...events].sort((a, b) =>
    a.date === b.date ? a.id.localeCompare(b.id) : a.date < b.date ? -1 : 1,
  );

  for (const e of ordered) {
    const ts = Date.parse(`${e.date}T00:00:00Z`);
    if (!Number.isFinite(ts) || ts < cutoff || e.type !== "repriced") continue;
    for (const c of e.changes) {
      if (c.field !== "cost.input") continue;
      if (typeof c.old !== "number" || typeof c.new !== "number" || c.old === c.new) continue;
      // Unpublished ($0) endpoints are not prices; a move into or out of one is
      // a listing change, not a repricing.
      if (c.old === 0 || c.new === 0) continue;

      const group =
        (e.canonicalId ? catalog.groupById.get(e.canonicalId) : undefined) ??
        groupOfListing.get(e.modelKey);
      // Chain per model+provider so a series of nudges reads as one move.
      const key = `${group?.id ?? e.canonicalId ?? e.modelKey}::${e.providerId ?? ""}`;
      const prev = chains.get(key);
      const listing = group?.listings.find((l) => l.key === e.modelKey);
      chains.set(key, {
        name: group?.name ?? e.modelName,
        id: group?.id ?? null,
        labId: group?.labKnown ? group.labId : null,
        providerId: e.providerId,
        providerName: listing?.providerName ?? e.providerId,
        from: prev?.from ?? c.old,
        to: c.new,
        date: e.date,
        firstParty:
          group != null && group.labKnown && e.providerId != null
            ? isFirstParty(group.labId, e.providerId)
            : false,
      });
    }
  }

  const moves: Move[] = [];
  for (const ch of chains.values()) {
    if (ch.from <= 0 || ch.from === ch.to) continue;
    moves.push({ ...ch, pct: (ch.to - ch.from) / ch.from });
  }
  const bySize = (a: Move, b: Move) => Math.abs(b.pct) - Math.abs(a.pct);
  return {
    firstParty: moves.filter((m) => m.firstParty).sort(bySize),
    street: moves.filter((m) => !m.firstParty).sort(bySize),
  };
}

/**
 * Days of archive needed before the price index means anything. Below this the
 * line is noise and the percentage is zero, which is what made the old homepage
 * lead with "▼ 0.0%".
 */
export const INDEX_MIN_DAYS = 14;

/**
 * Collapse per-provider moves into one row per model.
 *
 * When three gateways reprice the same model on the same day, listing all three
 * is padding: the reader learns one fact and reads it three times. The row
 * keeps the median move and says how many venues made it.
 */
export interface CollapsedMove extends Move {
  /** Distinct providers that made this move. */
  venues: number;
}

export function collapseByModel(moves: Move[]): CollapsedMove[] {
  const byModel = new Map<string, Move[]>();
  for (const m of moves) {
    const key = m.id ?? m.name;
    const arr = byModel.get(key);
    if (arr) arr.push(m);
    else byModel.set(key, [m]);
  }
  const out: CollapsedMove[] = [];
  for (const group of byModel.values()) {
    const sorted = [...group].sort((a, b) => a.pct - b.pct);
    const rep = sorted[Math.floor(sorted.length / 2)];
    out.push({ ...rep, venues: new Set(group.map((m) => m.providerId)).size });
  }
  return out.sort((a, b) => Math.abs(b.pct) - Math.abs(a.pct));
}

export interface IndexPoint {
  date: string;
  median: number;
  models: number;
}

export interface FrontierIndex {
  points: IndexPoint[];
  /** Enough history for the index to be published at all. */
  ready: boolean;
  daysCovered: number;
  daysNeeded: number;
  changePct: number | null;
  latest: number | null;
  /**
   * Date the index starts publishing, projected from the last archived day.
   * Derived from the data rather than the clock so the page stays deterministic
   * at build time.
   */
  startsOn: string | null;
}

/**
 * Median blended price across frontier models, from the permanent archive.
 * Returns `ready: false` rather than a flat line when history is too short —
 * the homepage says when it will start publishing instead of faking a chart.
 */
export function frontierIndex(
  archive: PriceArchive,
  frontierIds: Set<string>,
  w: Workload = DEFAULT_WORKLOAD,
): FrontierIndex {
  const points: IndexPoint[] = [];
  for (let i = 0; i < archive.dates.length; i++) {
    const blended: number[] = [];
    for (const [id, m] of Object.entries(archive.models)) {
      if (!frontierIds.has(id)) continue;
      const inp = m.in[i];
      const out = m.out[i];
      if (inp == null || out == null || (inp === 0 && out === 0)) continue;
      blended.push(ratePerMillion(flatCost(inp, out), w));
    }
    if (blended.length === 0) continue;
    blended.sort((a, b) => a - b);
    const mid = Math.floor(blended.length / 2);
    points.push({
      date: archive.dates[i],
      median: blended.length % 2 === 1 ? blended[mid] : (blended[mid - 1] + blended[mid]) / 2,
      models: blended.length,
    });
  }
  const daysCovered = archiveDepth(archive);
  const ready = points.length >= INDEX_MIN_DAYS;
  const first = points[0];
  const last = points[points.length - 1];
  const daysNeeded = Math.max(0, INDEX_MIN_DAYS - points.length);
  const anchor = archive.dates[archive.dates.length - 1];
  return {
    points,
    ready,
    daysCovered,
    daysNeeded,
    changePct: ready && first && last && first.median > 0 ? (last.median - first.median) / first.median : null,
    latest: last?.median ?? null,
    startsOn:
      ready || !anchor
        ? null
        : new Date(Date.parse(`${anchor}T00:00:00Z`) + daysNeeded * DAY).toLocaleDateString("en-US", {
            month: "long",
            day: "numeric",
            timeZone: "UTC",
          }),
  };
}

export type LedeKind = "offer" | "cut" | "launch" | "hike" | "sunset" | "street" | "quiet";

export interface Lede {
  kind: LedeKind;
  /** Short, declarative — the claim itself. */
  headline: string;
  /** One or two sentences of substantiation. */
  body: string;
  href: string;
  cta: string;
  /** Named so a reader can check the rule that selected this story. */
  rule: string;
}

const MATERIAL_MOVE = 0.15;
const STREET_MOVE = 0.4;
const LAUNCH_WINDOW_DAYS = 3;
const SUNSET_WAVE = 3;
const OFFER_WINDOW_DAYS = 3;

const pct = (v: number) => `${Math.round(Math.abs(v) * 100)}%`;
const money = (v: number) =>
  v === 0 ? "$0" : v < 1 ? `$${Number(v.toFixed(3))}` : `$${Number(v.toFixed(2))}`;

/**
 * Pick the day's lead story. The newest qualifying story wins; the explicit
 * priority is only a tie-breaker, so an older dramatic move cannot mask newer
 * news. Every Lede carries the name of the rule that chose it.
 */
export function lede(
  moves: { firstParty: Move[]; street: Move[] },
  catalog: Catalog,
  events: Event[],
  now: number = Date.now(),
  offers: VerifiedOffer[] = [],
): Lede {
  const offer = freshOffer(offers, now);
  const cut = newestMove(moves.firstParty, (m) => m.pct <= -MATERIAL_MOVE);
  const launch = freshLaunch(catalog, now);
  const hike = newestMove(moves.firstParty, (m) => m.pct >= MATERIAL_MOVE);
  const sunsets = recentEvents(events, "deprecated", 7, now);
  const street = newestMove(moves.street, (m) => Math.abs(m.pct) >= STREET_MOVE);

  const candidates: Array<{ kind: LedeKind; date: string; priority: number }> = [];
  if (offer) candidates.push({ kind: "offer", date: offer.startsOn ?? offer.verifiedAt.slice(0, 10), priority: -1 });
  if (cut) candidates.push({ kind: "cut", date: cut.date, priority: 0 });
  if (launch) candidates.push({ kind: "launch", date: groupReleaseDate(launch)!, priority: 1 });
  if (hike) candidates.push({ kind: "hike", date: hike.date, priority: 2 });
  if (sunsets.length >= SUNSET_WAVE) candidates.push({ kind: "sunset", date: sunsets[0].date, priority: 3 });
  if (street) candidates.push({ kind: "street", date: street.date, priority: 4 });

  const selected = candidates.sort((a, b) =>
    b.date.localeCompare(a.date) || a.priority - b.priority,
  )[0]?.kind;

  if (selected === "offer" && offer) {
    const expiry = offer.expiresOn ? ` through ${offer.expiresOn}` : " for a limited time";
    return {
      kind: "offer",
      headline: `${offer.modelName} is free at ${offer.providerName}`,
      body: `${offer.offer}${expiry}. We verified the offer against ${offer.sourceHost}; check the provider terms before sending production traffic.`,
      href: `/m/${offer.modelId}`,
      cta: "Check the offer",
      rule: `new verified first-party free offer within ${OFFER_WINDOW_DAYS} days`,
    };
  }

  if (selected === "cut" && cut) {
    return {
      kind: "cut",
      headline: `${cut.name} is ${pct(cut.pct)} cheaper`,
      body: `${labelOf(cut)} cut input pricing from ${money(cut.from)} to ${money(cut.to)} per million tokens. Every provider reselling it now prices against a lower floor.`,
      href: cut.id ? `/m/${cut.id}` : "/changelog",
      cta: "See the listings",
      rule: "newest qualifying first-party price cut, last 7 days",
    };
  }

  if (selected === "launch" && launch) {
    const price = launch.best
      ? `${money(launch.best.input)}/${money(launch.best.output)} per million`
      : launch.free
        ? "no published price yet"
        : "pricing not yet listed";
    const ctx = groupContext(launch);
    return {
      kind: "launch",
      headline: `${launch.name} is out`,
      body: `${labName(launch.labId)} shipped it${ctx ? ` with a ${compact(ctx)}-token context window` : ""}, and ${launch.listings.length} provider${launch.listings.length === 1 ? "" : "s"} already list it at ${price}.`,
      href: `/m/${launch.id}`,
      cta: "Compare provider prices",
      rule: `first-party launch within ${LAUNCH_WINDOW_DAYS} days`,
    };
  }

  if (selected === "hike" && hike) {
    return {
      kind: "hike",
      headline: `${hike.name} costs ${pct(hike.pct)} more`,
      body: `${labelOf(hike)} raised input pricing from ${money(hike.from)} to ${money(hike.to)} per million tokens — a rare direction of travel in this market.`,
      href: hike.id ? `/m/${hike.id}` : "/changelog",
      cta: "See the listings",
      rule: "newest qualifying first-party price rise, last 7 days",
    };
  }

  if (selected === "sunset") {
    return {
      kind: "sunset",
      headline: `${sunsets.length} models were retired this week`,
      body: `Providers pulled ${sunsets.length} listings, including ${sunsets[0].modelName}. Check anything you depend on before the endpoints stop answering.`,
      href: "/deprecations",
      cta: "See what is going away",
      rule: `${SUNSET_WAVE} or more deprecations, last 7 days`,
    };
  }

  if (selected === "street" && street) {
    const dir = street.pct < 0 ? "cut" : "raised";
    return {
      kind: "street",
      headline: `${street.providerName ?? "A gateway"} ${dir} its ${street.name} markup by ${pct(street.pct)}`,
      body: `The lab has not moved — this is a reseller changing its margin, from ${money(street.from)} to ${money(street.to)} per million input tokens. Worth knowing if you buy through them.`,
      href: street.id ? `/m/${street.id}` : "/changelog",
      cta: "Compare every provider",
      rule: `newest qualifying gateway move over ${Math.round(STREET_MOVE * 100)}%`,
    };
  }

  const week = recentAll(events, 7, now);
  return {
    kind: "quiet",
    headline: "No lab moved its prices this week",
    body:
      week.length > 0
        ? `The tape logged ${week.length} change${week.length === 1 ? "" : "s"}, all of them resellers adjusting listings rather than labs repricing models. The sync keeps watching hourly.`
        : "Nothing changed anywhere in the catalog. The sync keeps watching hourly.",
    href: "/changelog",
    cta: "Read the full tape",
    rule: "nothing met the thresholds above",
  };
}

/** Recent offers only; expired or stale verification must never lead the site. */
export function freshOffer(offers: VerifiedOffer[], now: number = Date.now()): VerifiedOffer | null {
  const cutoff = now - OFFER_WINDOW_DAYS * DAY;
  return [...offers]
    .filter((offer) => {
      const verified = Date.parse(offer.verifiedAt);
      const expires = offer.expiresOn ? Date.parse(`${offer.expiresOn}T23:59:59Z`) : Infinity;
      return Number.isFinite(verified) && verified >= cutoff && expires >= now;
    })
    .sort((a, b) => (b.startsOn ?? b.verifiedAt).localeCompare(a.startsOn ?? a.verifiedAt))[0] ?? null;
}

function newestMove(moves: Move[], qualifies: (move: Move) => boolean): Move | undefined {
  return moves
    .filter(qualifies)
    .sort((a, b) => b.date.localeCompare(a.date) || Math.abs(b.pct) - Math.abs(a.pct))[0];
}

function labelOf(m: Move): string {
  return m.labId ? labName(m.labId) : (m.providerName ?? "The provider");
}

function recentEvents(events: Event[], type: Event["type"], days: number, now: number): Event[] {
  const cutoff = now - days * DAY;
  return events.filter(
    (e) => e.type === type && Date.parse(`${e.date}T00:00:00Z`) >= cutoff,
  ).sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
}

function recentAll(events: Event[], days: number, now: number): Event[] {
  const cutoff = now - days * DAY;
  return events.filter((e) => Date.parse(`${e.date}T00:00:00Z`) >= cutoff);
}

/** Newest lab-attributed model released inside the launch window. */
export function freshLaunch(catalog: Catalog, now: number = Date.now()): ModelGroup | null {
  const cutoff = new Date(now - LAUNCH_WINDOW_DAYS * DAY).toISOString().slice(0, 10);
  const candidates = catalog.tracked
    .filter((g) => {
      const d = groupReleaseDate(g);
      return d != null && d >= cutoff;
    })
    .sort((a, b) => (groupReleaseDate(b) ?? "").localeCompare(groupReleaseDate(a) ?? ""));
  return candidates[0] ?? null;
}

const LAB_NAMES: Record<string, string> = {
  openai: "OpenAI",
  anthropic: "Anthropic",
  google: "Google DeepMind",
  deepseek: "DeepSeek",
  alibaba: "Alibaba",
  moonshotai: "Moonshot AI",
  meta: "Meta",
  mistral: "Mistral",
  xai: "xAI",
  nvidia: "NVIDIA",
  cohere: "Cohere",
  zhipuai: "Zhipu AI",
  tencent: "Tencent",
  "bytedance-seed": "ByteDance Seed",
  microsoft: "Microsoft",
  amazon: "Amazon",
  ai21: "AI21",
  perplexity: "Perplexity",
  unattributed: "Unattributed",
};

export function labName(id: string): string {
  return LAB_NAMES[id] ?? id.charAt(0).toUpperCase() + id.slice(1);
}

function compact(n: number): string {
  if (n >= 1_000_000) return `${Number((n / 1_000_000).toFixed(2))}M`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}K`;
  return String(n);
}
