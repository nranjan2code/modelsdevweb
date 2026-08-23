import { groupContext, pricedProviderCount, providerCount, type ModelGroup } from "./index";
import { isTokenComparable } from "../economics/comparable";
import { DEFAULT_WORKLOAD, ratePerMillion, type Workload } from "../economics/workload";
import { unlistedPrice } from "../pipeline/normalize";
import type { Listing } from "../pipeline/types";

/**
 * Market structure: who is actually selling, and at what.
 *
 * The same weights reach buyers two ways — from the lab that trained them, and
 * from gateways reselling with a markup. Conflating the two produced a homepage
 * whose headline "price hikes" were all margin changes at kilo and edenai, and
 * a model page that recommended the cheapest listing without noticing it shipped
 * a third of the context window.
 */

/** Provider ids that are the lab itself under a different name. */
const FIRST_PARTY_ALIASES: Record<string, string[]> = {
  google: ["google", "google-vertex", "google-ai-studio", "googleai", "vertex"],
  alibaba: ["alibaba", "dashscope", "qwen", "alibaba-cloud"],
  moonshotai: ["moonshot", "moonshotai", "kimi"],
  zhipuai: ["zhipuai", "zhipu", "z-ai", "zai"],
  "bytedance-seed": ["bytedance", "bytedance-seed", "volcengine"],
  deepseek: ["deepseek"],
  openai: ["openai"],
  anthropic: ["anthropic"],
  mistral: ["mistral", "mistralai"],
  xai: ["xai"],
  cohere: ["cohere"],
  nvidia: ["nvidia"],
  meta: ["meta", "meta-llama"],
};

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

/** Is this listing sold by the lab that made the model, rather than a reseller? */
export function isFirstParty(labId: string, providerId: string): boolean {
  const lab = norm(labId);
  const prov = norm(providerId);
  if (lab === prov) return true;
  const aliases = FIRST_PARTY_ALIASES[labId];
  if (aliases) return aliases.some((a) => norm(a) === prov);
  return false;
}

export function groupHasFirstParty(g: ModelGroup): boolean {
  return g.listings.some((l) => l.status !== "deprecated" && isFirstParty(g.labId, l.providerId));
}

/**
 * A listing with a price the provider actually publishes. Upstream encodes
 * "no published price" as $0/$0, so treating that as free invents 100% savings
 * and spreads in the thousands.
 */
export function hasRealPrice(l: Listing): boolean {
  return (
    l.status !== "deprecated" &&
    l.cost.input != null &&
    l.cost.output != null &&
    !unlistedPrice(l.cost)
  );
}

/** The lab's own listing, when it sells the model directly. */
export function firstPartyListing(g: ModelGroup): Listing | null {
  return (
    g.listings.find((l) => hasRealPrice(l) && isFirstParty(g.labId, l.providerId)) ?? null
  );
}

export interface PriceSpread {
  /** Live listings with a real price, cheapest blended first. */
  ranked: Listing[];
  cheapest: Listing;
  dearest: Listing;
  /**
   * dearest / cheapest-corroborated on blended price. Measured from a price at
   * least two venues offer, so the headline spread reflects a market rather
   * than one venue's typo.
   */
  ratio: number;
  firstParty: Listing | null;
  /**
   * Cheapest listing that matches the model's full context window — the honest
   * recommendation, since the outright cheapest often quietly truncates it.
   */
  cheapestFullContext: Listing | null;
  /** Full context for this model, as established across all sources. */
  fullContext: number | null;
  /** Cheapest listing ships less context / a downgraded tier than the best on offer. */
  cheapestIsCompromised: boolean;
  /** Listings dropped as implausible against the group median. */
  outliersDropped: number;
  /**
   * Cheapest price at least one other provider also offers. A lone listing far
   * below every other venue is more often a stale or bait price than a real
   * one, so the recommendation is corroborated before it is made.
   */
  cheapestCredible: Listing | null;
}

const MIN_SPREAD_LISTINGS = 2;
/** Within this fraction of full context still counts as full context. */
const CONTEXT_TOLERANCE = 0.9;
/**
 * Listings this far from the group median are treated as upstream data errors
 * rather than prices. Both directions occur in the wild: helicone published
 * $20/$40 for Mistral Nemo against a $0.11 median (a mis-scaled $0.02/$0.04),
 * and unorouter published $0.19 for GPT-5.5 against $11.25. Left unfiltered
 * these produced a headline "1,149x price spread".
 */
const PRICE_OUTLIER_FACTOR = 20;
/** Below this many listings there is no median worth trusting. */
const MIN_FOR_MEDIAN = 5;
/** A second provider within this multiple corroborates a price. */
const CORROBORATION_FACTOR = 1.5;

function withoutPriceOutliers(ranked: Listing[], rate: (l: Listing) => number): Listing[] {
  if (ranked.length < MIN_FOR_MEDIAN) return ranked;
  const blended = ranked.map(rate);
  const mid = Math.floor(blended.length / 2);
  const median =
    blended.length % 2 === 1 ? blended[mid] : (blended[mid - 1] + blended[mid]) / 2;
  if (!(median > 0)) return ranked;
  const kept = ranked.filter((l) => {
    const p = rate(l);
    return p <= median * PRICE_OUTLIER_FACTOR && p >= median / PRICE_OUTLIER_FACTOR;
  });
  return kept.length >= MIN_SPREAD_LISTINGS ? kept : ranked;
}

export function priceSpread(g: ModelGroup, w: Workload = DEFAULT_WORKLOAD): PriceSpread | null {
  // Providers disagree on what a token *is* for image and audio models — some
  // fold a per-image charge into the token field — so a "spread" across them
  // measures units rather than price.
  if (!isTokenComparable(g)) return null;
  const priced = g.listings.filter(hasRealPrice);
  if (priced.length < MIN_SPREAD_LISTINGS) return null;

  // The spread is a function of the workload: a listing that is cheapest for a
  // short chat can be dearest once a long-context tier kicks in.
  const rate = (l: Listing): number => ratePerMillion(l.cost, w);
  const ranked = withoutPriceOutliers([...priced].sort((a, b) => rate(a) - rate(b)), rate);
  const cheapest = ranked[0];
  const dearest = ranked[ranked.length - 1];

  // A price no other venue comes close to is treated as unconfirmed.
  const corroborated = (l: Listing): boolean => {
    const p = rate(l);
    return ranked.some((o) => o.providerId !== l.providerId && rate(o) <= p * CORROBORATION_FACTOR);
  };
  const cheapestCredible = ranked.find(corroborated) ?? null;


  const fullContext = groupContext(g);
  const meetsContext = (l: Listing) =>
    fullContext == null || (l.limit.context ?? 0) >= fullContext * CONTEXT_TOLERANCE;
  const cheapestFullContext =
    ranked.find((l) => meetsContext(l) && l.status == null && corroborated(l)) ??
    ranked.find((l) => meetsContext(l) && corroborated(l)) ??
    ranked.find(meetsContext) ??
    null;

  const floor = cheapestCredible ?? cheapest;
  const lo = rate(floor);
  const hi = rate(dearest);

  return {
    ranked,
    cheapest,
    dearest,
    ratio: lo > 0 ? hi / lo : 1,
    firstParty: firstPartyListing(g),
    cheapestFullContext,
    fullContext,
    cheapestIsCompromised:
      cheapestFullContext != null && cheapestFullContext.key !== cheapest.key,
    outliersDropped: priced.length - ranked.length,
    cheapestCredible,
  };
}

/**
 * The sentence a buyer actually needs, generated from the spread. Says what the
 * cheapest safe option is, how it compares to buying from the lab, and names the
 * catch when the outright cheapest listing has one.
 */
export function spreadSummary(g: ModelGroup, s: PriceSpread, w: Workload = DEFAULT_WORKLOAD): string {
  const priced = pricedProviderCount(g);
  const live = providerCount(g);
  const pick = s.cheapestFullContext ?? s.cheapest;
  const price = `$${fmt(pick.cost.input!)}/$${fmt(pick.cost.output!)}`;
  const parts: string[] = [
    priced === live
      ? `${priced} providers list ${g.name}.`
      : `${priced} of ${live} providers publish a price for ${g.name}.`,
  ];

  if (s.firstParty && s.firstParty.key !== pick.key) {
    const fp = ratePerMillion(s.firstParty.cost, w);
    const pk = ratePerMillion(pick.cost, w);
    const saving = Number.isFinite(fp) && Number.isFinite(pk) && fp > 0 ? Math.round((1 - pk / fp) * 100) : 0;
    parts.push(
      saving > 0
        ? `The cheapest full-context option is ${pick.providerName} at ${price} per M — ${saving}% below ${s.firstParty.providerName}'s own price.`
        : `The cheapest full-context option is ${pick.providerName} at ${price} per M.`,
    );
  } else {
    parts.push(`The cheapest full-context option is ${pick.providerName} at ${price} per M.`);
  }

  if (s.cheapestIsCompromised) {
    const ctx = s.cheapest.limit.context;
    parts.push(
      ctx != null
        ? `${s.cheapest.providerName} lists lower but caps context at ${compactTokens(ctx)}.`
        : `${s.cheapest.providerName} lists lower on a reduced tier.`,
    );
  } else if (s.ratio >= 1.5) {
    parts.push(`Listed prices span ${s.ratio.toFixed(1)}× for identical weights.`);
  }

  return parts.join(" ");
}

function fmt(v: number): string {
  if (v === 0) return "0";
  if (v < 0.01) return v.toPrecision(2);
  return v < 1 ? String(Number(v.toFixed(3))) : String(Number(v.toFixed(2)));
}

function compactTokens(n: number): string {
  if (n >= 1_000_000) return `${Number((n / 1_000_000).toFixed(2))}M`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}K`;
  return String(n);
}

export interface SpreadRow {
  group: ModelGroup;
  spread: PriceSpread;
}

/**
 * Models where shopping around actually pays: widely listed, and with a real
 * gap between the cheapest safe option and what the lab charges.
 */
export function widestSpreads(groups: ModelGroup[], minProviders = 6, limit = 6): SpreadRow[] {
  const rows: SpreadRow[] = [];
  for (const g of groups) {
    const spread = priceSpread(g);
    if (!spread || pricedProviderCount(g) < minProviders) continue;
    if (spread.ratio < 1.5) continue;
    rows.push({ group: g, spread });
  }
  return rows.sort((a, b) => b.spread.ratio - a.spread.ratio).slice(0, limit);
}
