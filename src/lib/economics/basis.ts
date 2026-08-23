/**
 * Basis: what the street charges over the lab's own counter.
 *
 * The single most commercially useful number here. For a model whose lab sells
 * it directly, every gateway listing is a quote on the *same* weights, so the
 * gap between them is pure markup — or, when negative, a subsidy the gateway is
 * paying for distribution. Neither is visible from a price table sorted by $/M.
 *
 * Basis is only defined against a first-party reference. A model with no lab
 * counter (an open-weights release nobody hosts officially) has resellers but
 * no basis, and this module returns null rather than inventing a benchmark from
 * the cheapest gateway — that would make the cheapest reseller definitionally
 * "at par" and every other one look expensive against a number no buyer can
 * actually transact at.
 *
 * **Extreme quotes need corroboration**, the same rule `priceSpread` applies and
 * for the same reason. Upstream carries mis-scaled listings in both directions
 * (unorouter published $0.19 for GPT-5.5 against a $11.25 first-party rate), and
 * an uncorroborated one reads as a 96% discount — a recommendation to route
 * production traffic at a price that does not exist. A quote no second venue
 * comes within `CORROBORATION_FACTOR` of is dropped from the headline figures
 * and kept only in the full quote list.
 */

import { firstPartyListing, hasRealPrice, isFirstParty } from "../data/market";
import type { ModelGroup } from "../data/index";
import type { Listing } from "../pipeline/types";
import { isTokenComparable } from "./comparable";
import { DEFAULT_WORKLOAD, ratePerMillion, type Workload } from "./workload";

export interface Quote {
  providerId: string;
  providerName: string;
  listingKey: string;
  /** Effective $/M under the workload, not the sticker. */
  rate: number;
  /** Fractional gap to the first-party rate: 0.25 = 25% over the lab's counter. */
  basis: number;
  status: Listing["status"];
}

export interface BasisReport {
  groupId: string;
  name: string;
  labId: string;
  /** The lab's own listing — the reference every quote is measured against. */
  referenceProvider: string;
  referenceRate: number;
  /** Every gateway quote, cheapest first — including uncorroborated ones. */
  quotes: Quote[];
  /**
   * Quotes a second venue comes within `CORROBORATION_FACTOR` of. The headline
   * best/worst basis is drawn from these; a lone extreme quote is a feed error
   * until another venue confirms it.
   */
  corroborated: Quote[];
  /** Median basis across gateways — the typical markup for this model. */
  medianBasis: number;
  /** The best gateway offer relative to the lab. Negative means below the lab. */
  bestBasis: number;
  /** The worst. */
  worstBasis: number;
  /**
   * The weights are public, so the lab's own API is one host among many rather
   * than the sole source. A large discount is then ordinary competition, not a
   * gateway undercutting a monopoly — the two must never be ranked together.
   */
  openWeights: boolean;
}

/** Below this many gateway quotes there is no "typical" markup to report. */
export const MIN_QUOTES = 3;
/**
 * A quote this far from the gateway median is an upstream data error, not a
 * price. Same factor `market.ts` uses on the spread.
 */
export const PRICE_OUTLIER_FACTOR = 20;
/** A second venue within this multiple corroborates a quote. */
export const CORROBORATION_FACTOR = 1.5;

export function basisReport(g: ModelGroup, w: Workload = DEFAULT_WORKLOAD): BasisReport | null {
  // Providers disagree on what a token *is* for image and audio models, so a
  // basis across them measures units, not markup.
  if (!isTokenComparable(g)) return null;
  const reference = firstPartyListing(g);
  if (!reference) return null;
  const referenceRate = ratePerMillion(reference.cost, w);
  if (!Number.isFinite(referenceRate) || referenceRate <= 0) return null;

  const quotes: Quote[] = g.listings
    .filter((l) => l.status !== "deprecated")
    .filter(hasRealPrice)
    .filter((l) => !isFirstParty(g.labId, l.providerId))
    .map((l) => {
      const rate = ratePerMillion(l.cost, w);
      return {
        providerId: l.providerId,
        providerName: l.providerName,
        listingKey: l.key,
        rate,
        basis: rate / referenceRate - 1,
        status: l.status,
      };
    })
    .filter((q) => Number.isFinite(q.rate))
    .sort((a, b) => a.rate - b.rate);

  if (quotes.length < MIN_QUOTES) return null;

  const credible = withoutOutliers(quotes);
  const sorted = credible.map((q) => q.basis).sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const medianBasis = sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;

  // The headline best/worst must be a price a buyer could actually get, so they
  // come from corroborated quotes only. `quotes` keeps everything for the table.
  const corroborated = credible.filter((q) =>
    credible.some((o) => o.providerId !== q.providerId && o.rate <= q.rate * CORROBORATION_FACTOR),
  );
  const headline = corroborated.length > 0 ? corroborated : credible;
  const headlineBasis = headline.map((q) => q.basis).sort((a, b) => a - b);

  return {
    groupId: g.id,
    name: g.name,
    labId: g.labId,
    referenceProvider: reference.providerName,
    referenceRate,
    quotes,
    corroborated,
    medianBasis,
    bestBasis: headlineBasis[0],
    worstBasis: headlineBasis[headlineBasis.length - 1],
    openWeights: g.canonical?.openWeights === true,
  };
}

/** Drops quotes far enough from the gateway median to be feed errors. */
function withoutOutliers(quotes: Quote[]): Quote[] {
  if (quotes.length < MIN_QUOTES) return quotes;
  const rates = quotes.map((q) => q.rate).sort((a, b) => a - b);
  const mid = Math.floor(rates.length / 2);
  const median = rates.length % 2 === 1 ? rates[mid] : (rates[mid - 1] + rates[mid]) / 2;
  if (!(median > 0)) return quotes;
  const kept = quotes.filter(
    (q) => q.rate <= median * PRICE_OUTLIER_FACTOR && q.rate >= median / PRICE_OUTLIER_FACTOR,
  );
  return kept.length >= MIN_QUOTES ? kept : quotes;
}

/**
 * Models where the street undercuts the lab — the actionable direction, since a
 * buyer can act on a discount but not on a markup.
 *
 * Split by `openWeights`, because the two are different phenomena. A gateway
 * beating OpenAI on GPT-5 is selling the same monopoly product cheaper and
 * deserves scrutiny; a host beating Alibaba on Qwen is running the same open
 * weights on cheaper hardware, which is simply the market working. Ranked
 * together, the open-weights models crowd out the finding worth reading.
 */
export function bestDiscounts(
  groups: ModelGroup[],
  w: Workload = DEFAULT_WORKLOAD,
  limit = 8,
  openWeights = false,
): BasisReport[] {
  return groups
    .flatMap((g) => basisReport(g, w) ?? [])
    // A discount only counts when a second venue is near it.
    .filter((r) => r.bestBasis < 0 && r.corroborated.length > 0 && r.openWeights === openWeights)
    .sort((a, b) => a.bestBasis - b.bestBasis)
    .slice(0, limit);
}

/** Models carrying the fattest typical markup — where shopping around pays most. */
export function widestMarkups(
  groups: ModelGroup[],
  w: Workload = DEFAULT_WORKLOAD,
  limit = 8,
): BasisReport[] {
  return groups
    .flatMap((g) => basisReport(g, w) ?? [])
    .filter((r) => r.medianBasis > 0)
    .sort((a, b) => b.medianBasis - a.medianBasis)
    .slice(0, limit);
}
