/**
 * Token economics: the posted price is not the price.
 *
 * A listing's sticker is a scalar only for a customer who sends one input token
 * for every output token, never caches, never reasons, and never fills the
 * context window. Nobody is that customer. Upstream carries the rest of the
 * schedule — per-context-tier rates, cache read/write, separately-priced
 * reasoning tokens — and this module is the single place that turns a schedule
 * plus a *workload* into money.
 *
 * Every ranking on the site routes through `costOf`. There is no scalar price
 * helper any more, deliberately: a number without a named workload behind it is
 * an assumption the reader cannot check.
 */

import type { Cost, CostRates, CostTier } from "../pipeline/types";

/**
 * A named token profile. Counts are per request; rates in the dataset are
 * dollars per million tokens.
 */
export interface Workload {
  id: string;
  name: string;
  /** One line, printed next to any figure derived from it. */
  description: string;
  /** Input tokens per request, cached and uncached together. */
  inputTokens: number;
  /** Visible answer tokens. */
  outputTokens: number;
  /**
   * Hidden reasoning tokens. Billed at `cost.reasoning` where a provider prices
   * them apart, otherwise at the output rate — which is how most providers bill
   * them today.
   */
  reasoningTokens: number;
  /** Share of input tokens served from cache (0–1). */
  cacheHitRate: number;
  /**
   * Share of input tokens written to cache (0–1). Charging nothing for writes
   * makes every cache look free, which is how a calculator ends up saying cost
   * falls monotonically with hit rate.
   */
  cacheWriteRate: number;
  /**
   * Total context length the request occupies. Selects the price tier — for the
   * 401 listings with context tiers this is what decides the rate, and it is
   * usually larger than `inputTokens` because history and tools count too.
   */
  contextTokens: number;
}

/**
 * The default is named and printed, never silently applied. `chat` is closest
 * to the 3:1 input:output blend the site used before workloads existed, so
 * existing figures stay comparable.
 */
export const DEFAULT_WORKLOAD_ID = "chat";

export const WORKLOADS: Workload[] = [
  {
    id: "chat",
    name: "Chat",
    description: "Short turns, light history, little caching — an assistant in a product.",
    inputTokens: 1_500,
    outputTokens: 500,
    reasoningTokens: 0,
    cacheHitRate: 0.2,
    cacheWriteRate: 0.05,
    contextTokens: 8_000,
  },
  {
    id: "rag",
    name: "RAG",
    description: "Retrieved passages dominate the bill; answers are short and the prefix caches well.",
    inputTokens: 20_000,
    outputTokens: 800,
    reasoningTokens: 0,
    cacheHitRate: 0.5,
    cacheWriteRate: 0.1,
    contextTokens: 24_000,
  },
  {
    id: "agentic",
    name: "Agentic",
    description: "Tool loops re-send a growing transcript and think between calls.",
    inputTokens: 12_000,
    outputTokens: 2_000,
    reasoningTokens: 3_000,
    cacheHitRate: 0.7,
    cacheWriteRate: 0.15,
    contextTokens: 32_000,
  },
  {
    id: "reasoning",
    name: "Heavy reasoning",
    description: "Thinking tokens outnumber the answer several times over.",
    inputTokens: 2_000,
    outputTokens: 1_500,
    reasoningTokens: 8_000,
    cacheHitRate: 0,
    cacheWriteRate: 0,
    contextTokens: 12_000,
  },
  {
    id: "long-context",
    name: "Long context",
    description: "A whole codebase or filing per request — the case tiered pricing exists for.",
    inputTokens: 250_000,
    outputTokens: 2_000,
    reasoningTokens: 0,
    cacheHitRate: 0.3,
    cacheWriteRate: 0.1,
    contextTokens: 256_000,
  },
];

const BY_ID = new Map(WORKLOADS.map((w) => [w.id, w]));

export function workloadById(id: string | null | undefined): Workload {
  return (id ? BY_ID.get(id) : undefined) ?? BY_ID.get(DEFAULT_WORKLOAD_ID)!;
}

export const DEFAULT_WORKLOAD = workloadById(DEFAULT_WORKLOAD_ID);

/** Billable tokens per request — the denominator that turns a bill into a $/M figure. */
export function billableTokens(w: Workload): number {
  return w.inputTokens + w.outputTokens + w.reasoningTokens;
}

/**
 * The rate card in force at a given context length. Tiers are thresholds: the
 * highest one at or below the request's context wins, and any field the tier
 * leaves out falls back to the base card rather than to zero.
 */
export function effectiveRates(cost: Cost, contextTokens: number): { rates: CostRates; tier: CostTier | null } {
  let tier: CostTier | null = null;
  for (const t of cost.tiers) {
    if (contextTokens >= t.minContext && (!tier || t.minContext > tier.minContext)) tier = t;
  }
  if (!tier) return { rates: baseRates(cost), tier: null };
  const base = baseRates(cost);
  const r = tier.rates;
  return {
    tier,
    rates: {
      input: r.input ?? base.input,
      output: r.output ?? base.output,
      cacheRead: r.cacheRead ?? base.cacheRead,
      cacheWrite: r.cacheWrite ?? base.cacheWrite,
      reasoning: r.reasoning ?? base.reasoning,
      inputAudio: r.inputAudio ?? base.inputAudio,
      outputAudio: r.outputAudio ?? base.outputAudio,
    },
  };
}

function baseRates(cost: Cost): CostRates {
  return {
    input: cost.input,
    output: cost.output,
    cacheRead: cost.cacheRead,
    cacheWrite: cost.cacheWrite,
    reasoning: cost.reasoning,
    inputAudio: cost.inputAudio,
    outputAudio: cost.outputAudio,
  };
}

export interface CostBreakdown {
  /** Dollars per request, by line item. */
  input: number;
  cacheRead: number;
  cacheWrite: number;
  reasoning: number;
  output: number;
  /** Dollars per request. */
  total: number;
  /**
   * `total` restated as dollars per million billable tokens, so it can sit in a
   * column beside a sticker price without unit confusion.
   */
  perMillion: number;
  /** The tier that priced this request, if the workload tripped one. */
  tier: CostTier | null;
  /** False when the listing has no published input/output price. */
  priced: boolean;
}

const UNPRICED: CostBreakdown = {
  input: 0, cacheRead: 0, cacheWrite: 0, reasoning: 0, output: 0,
  total: 0, perMillion: 0, tier: null, priced: false,
};

/**
 * What one request of `w` costs on this rate card.
 *
 * Fallbacks are deliberately un-generous to the seller's marketing: an
 * unpublished cache-read rate is charged at the full input rate (no discount
 * assumed), an unpublished cache-write rate likewise, and reasoning tokens
 * without their own rate bill as output. Assuming a discount nobody published
 * is how a comparison site quietly recommends the wrong model.
 */
export function costOf(cost: Cost, w: Workload): CostBreakdown {
  if (cost.input == null || cost.output == null) return UNPRICED;
  if (cost.input === 0 && cost.output === 0) return UNPRICED;

  const { rates, tier } = effectiveRates(cost, w.contextTokens);
  const inRate = rates.input ?? 0;
  const outRate = rates.output ?? 0;
  const readRate = rates.cacheRead ?? inRate;
  const writeRate = rates.cacheWrite ?? inRate;
  const reasonRate = rates.reasoning ?? outRate;

  const hit = clamp01(w.cacheHitRate);
  const write = clamp01(w.cacheWriteRate);
  const per = (tokens: number, rate: number) => (tokens / 1_000_000) * rate;

  const input = per(w.inputTokens * (1 - hit), inRate);
  const cacheRead = per(w.inputTokens * hit, readRate);
  const cacheWrite = per(w.inputTokens * write, writeRate);
  const reasoning = per(w.reasoningTokens, reasonRate);
  const output = per(w.outputTokens, outRate);
  const total = input + cacheRead + cacheWrite + reasoning + output;
  const billable = billableTokens(w);

  return {
    input, cacheRead, cacheWrite, reasoning, output, total,
    perMillion: billable > 0 ? (total / billable) * 1_000_000 : 0,
    tier,
    priced: true,
  };
}

/**
 * Dollars per million billable tokens under `w` — the ranking key that replaced
 * the old fixed 3:1 blend. Unpriced listings sort last rather than free.
 */
export function ratePerMillion(cost: Cost, w: Workload): number {
  const b = costOf(cost, w);
  return b.priced ? b.perMillion : Number.POSITIVE_INFINITY;
}

/** Monthly bill for a given request volume — the unit a buyer actually approves. */
export function monthlyCost(cost: Cost, w: Workload, requestsPerMonth: number): number | null {
  const b = costOf(cost, w);
  return b.priced ? b.total * requestsPerMonth : null;
}

/**
 * A rate card with only the headline pair — what the price archive stores for
 * historical days, since tier schedules were not captured before this module
 * existed. Rates for cache and reasoning fall back to input/output, so an index
 * built from it is a like-for-like series rather than a wrong one.
 */
export function flatCost(input: number, output: number): Cost {
  return {
    input, output,
    cacheRead: null, cacheWrite: null, reasoning: null,
    inputAudio: null, outputAudio: null,
    tiers: [],
  };
}

/** True when this listing's bill changes with context length. */
export function isTiered(cost: Cost): boolean {
  return cost.tiers.length > 0;
}

/** The context threshold at which a listing first gets more expensive, if any. */
export function firstTierThreshold(cost: Cost): number | null {
  if (!cost.tiers.length) return null;
  return Math.min(...cost.tiers.map((t) => t.minContext));
}

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}
