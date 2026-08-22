/**
 * Self-host or buy the API?
 *
 * This site is the only place that knows both halves of that question: what a
 * model costs per token from every provider, and whether its weights are even
 * licensed for the job. This module joins them.
 *
 * The honest difficulty is throughput. Tokens/sec depends on hardware, batch
 * size, quantisation, framework and sequence length, so any single figure would
 * be invented precision dressed up as analysis. So we do not model it.
 *
 * Instead we compute the *floor*: renting the smallest GPU configuration the
 * weights fit on costs the same whether you serve one token or a billion. The
 * API has no fixed cost. So self-hosting cannot beat the API until your monthly
 * API spend exceeds that rent — and the token figure that implies assumes a
 * fully saturated GPU, which is the best case for self-hosting and almost never
 * achieved. Every number here is therefore a *lower bound on when self-hosting
 * could start to make sense*, never a claim that it does.
 */

import { blendPrice, type ModelGroup } from "./index";
import { isFreelyUsable, type WeightsFacts } from "./weights";

/**
 * Representative on-demand list rates for rented accelerators, in USD/hour.
 *
 * These are order-of-magnitude market rates, not a quote from any one vendor:
 * spot, committed-use and reserved pricing all run materially cheaper, and the
 * page says so. Update the whole table together and move the date when you do.
 */
export const GPU_PRICES_AS_OF = "2026-08";

export interface GpuTier {
  name: string;
  vramGb: number;
  usdPerHour: number;
}

/** Ordered smallest to largest — the first fit wins. */
export const GPU_TIERS: GpuTier[] = [
  { name: "A100 40GB", vramGb: 40, usdPerHour: 1.1 },
  { name: "A100 80GB", vramGb: 80, usdPerHour: 1.8 },
  { name: "H100 80GB", vramGb: 80, usdPerHour: 3.0 },
  { name: "H200 141GB", vramGb: 141, usdPerHour: 4.0 },
];

/** Largest single-node deployment we will reason about (8-way is a standard box). */
const MAX_GPUS_PER_NODE = 8;
const HOURS_PER_MONTH = 730;

/** Bytes per parameter at bf16 — the no-quality-loss default. */
const BYTES_PER_PARAM_BF16 = 2;
/**
 * Serving needs more than the weights: KV cache, activations and framework
 * overhead. A 25% allowance is conservative for modest batch sizes and
 * understates memory for long contexts — which again favours the API.
 */
const SERVING_OVERHEAD = 1.25;

/** VRAM needed to serve a model at bf16, in GB. */
export function memoryRequiredGb(parameters: number): number {
  return (parameters * BYTES_PER_PARAM_BF16 * SERVING_OVERHEAD) / 1e9;
}

export interface HostingFloor {
  tier: GpuTier;
  gpus: number;
  vramGb: number;
  usdPerMonth: number;
}

/** Cheapest configuration whose combined VRAM holds the model. */
export function hostingFloor(parameters: number): HostingFloor | null {
  const needed = memoryRequiredGb(parameters);
  let best: HostingFloor | null = null;
  for (const tier of GPU_TIERS) {
    const gpus = Math.ceil(needed / tier.vramGb);
    if (gpus > MAX_GPUS_PER_NODE) continue;
    const usdPerMonth = gpus * tier.usdPerHour * HOURS_PER_MONTH;
    if (!best || usdPerMonth < best.usdPerMonth) {
      best = { tier, gpus, vramGb: gpus * tier.vramGb, usdPerMonth };
    }
  }
  return best;
}

export type HostingVerdict =
  /** Weights are not licensed for commercial self-hosting — the API is the only route. */
  | "api-only"
  /** Legal to self-host, but you must clear the rent first. */
  | "breakeven"
  /** Licensed, but too large for a single 8-GPU node at bf16. */
  | "needs-cluster"
  /** Missing licence or parameter data — we say so rather than guess. */
  | "unknown";

export interface HostingCase {
  groupId: string;
  name: string;
  verdict: HostingVerdict;
  parameters: number | null;
  floor: HostingFloor | null;
  /** Cheapest blended API price per million tokens. */
  apiBlendedPerM: number | null;
  /**
   * Monthly tokens at which API spend equals the GPU rent. Self-hosting cannot
   * win below this, and needs a saturated GPU to win above it.
   */
  breakEvenTokens: number | null;
  licence: string | null;
  gated: boolean;
}

export function hostingCase(g: ModelGroup, facts: WeightsFacts | undefined): HostingCase {
  const base = {
    groupId: g.id,
    name: g.name,
    parameters: facts?.parameters ?? null,
    licence: facts?.licence ?? null,
    gated: facts?.access === "gated",
    apiBlendedPerM: g.best ? blendPrice(g.best.input, g.best.output) : null,
  };

  if (!facts) return { ...base, verdict: "unknown", floor: null, breakEvenTokens: null };

  if (facts.licenceClass === "non-commercial") {
    return { ...base, verdict: "api-only", floor: null, breakEvenTokens: null };
  }

  if (facts.parameters == null || base.apiBlendedPerM == null || base.apiBlendedPerM <= 0) {
    return { ...base, verdict: "unknown", floor: null, breakEvenTokens: null };
  }

  const floor = hostingFloor(facts.parameters);
  if (!floor) return { ...base, verdict: "needs-cluster", floor: null, breakEvenTokens: null };

  return {
    ...base,
    verdict: "breakeven",
    floor,
    breakEvenTokens: (floor.usdPerMonth * 1e6) / base.apiBlendedPerM,
  };
}

/**
 * The cases worth showing: licensed, sized, priced, and ranked by how *low* the
 * bar is — a model you could plausibly justify hosting is far more interesting
 * than one needing billions of tokens a month.
 */
export function hostableCases(
  groups: ModelGroup[],
  weights: Record<string, WeightsFacts>,
  limit = 6,
): HostingCase[] {
  return groups
    .map((g) => hostingCase(g, weights[g.id]))
    .filter((c) => c.verdict === "breakeven" && c.breakEvenTokens != null)
    .sort((a, b) => (a.breakEvenTokens ?? 0) - (b.breakEvenTokens ?? 0))
    .slice(0, limit);
}

/** Licensed models the API is the only legal route for — a short, useful warning. */
export function apiOnlyCases(
  groups: ModelGroup[],
  weights: Record<string, WeightsFacts>,
  limit = 4,
): HostingCase[] {
  return groups
    .map((g) => hostingCase(g, weights[g.id]))
    .filter((c) => c.verdict === "api-only")
    .sort((a, b) => (b.parameters ?? 0) - (a.parameters ?? 0))
    .slice(0, limit);
}

/** Compact token count: 210M, 7.2B, 1.4T. */
export function fmtTokenCount(n: number | null): string | null {
  if (n == null || !Number.isFinite(n) || n <= 0) return null;
  if (n >= 1e12) return `${Number((n / 1e12).toFixed(1))}T`;
  if (n >= 1e9) return `${Number((n / 1e9).toFixed(1))}B`;
  if (n >= 1e6) return `${Number((n / 1e6).toFixed(0))}M`;
  return `${Math.round(n / 1e3)}K`;
}

export function fmtMonthlyUsd(n: number): string {
  return n >= 10_000
    ? `$${Math.round(n / 1000)}k`
    : `$${Math.round(n).toLocaleString("en-US")}`;
}

/** How many freely-usable models we could actually reason about. */
export function countFreelyUsable(
  groups: ModelGroup[],
  weights: Record<string, WeightsFacts>,
): number {
  return groups.filter((g) => {
    const f = weights[g.id];
    return f != null && isFreelyUsable(f);
  }).length;
}
