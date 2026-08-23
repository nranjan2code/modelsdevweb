import { describe, expect, it } from "vitest";
import type { Cost } from "../pipeline/types";
import {
  billableTokens,
  costOf,
  DEFAULT_WORKLOAD,
  effectiveRates,
  firstTierThreshold,
  flatCost,
  monthlyCost,
  ratePerMillion,
  workloadById,
  WORKLOADS,
} from "./workload";

const w = (over: Partial<(typeof WORKLOADS)[number]>) => ({
  ...DEFAULT_WORKLOAD,
  ...over,
});

/** GPT-5.5 as hpc-ai lists it: $5/$30 flat, $10/$45 once context reaches 272k. */
const tiered: Cost = {
  input: 5, output: 30, cacheRead: 0.5,
  cacheWrite: null, reasoning: null, inputAudio: null, outputAudio: null,
  tiers: [{ minContext: 272_000, rates: { input: 10, output: 45, cacheRead: 1, cacheWrite: null, reasoning: null, inputAudio: null, outputAudio: null } }],
};

describe("effectiveRates", () => {
  it("uses the base card below the threshold", () => {
    const { rates, tier } = effectiveRates(tiered, 100_000);
    expect(tier).toBeNull();
    expect(rates.input).toBe(5);
    expect(rates.output).toBe(30);
  });

  it("switches to the tier at the threshold, not near it", () => {
    expect(effectiveRates(tiered, 271_999).tier).toBeNull();
    expect(effectiveRates(tiered, 272_000).tier?.minContext).toBe(272_000);
    expect(effectiveRates(tiered, 272_000).rates.input).toBe(10);
  });

  it("falls back to the base card for fields a tier omits", () => {
    // The tier publishes no cache_write, so it must not become null-priced.
    const { rates } = effectiveRates(
      { ...tiered, cacheWrite: 6.25 },
      300_000,
    );
    expect(rates.cacheWrite).toBe(6.25);
    expect(rates.input).toBe(10);
  });

  it("picks the highest matching tier when several apply", () => {
    const multi: Cost = {
      ...tiered,
      tiers: [
        { minContext: 128_000, rates: { ...tiered.tiers[0].rates, input: 7 } },
        { minContext: 512_000, rates: { ...tiered.tiers[0].rates, input: 20 } },
      ],
    };
    expect(effectiveRates(multi, 600_000).rates.input).toBe(20);
    expect(effectiveRates(multi, 200_000).rates.input).toBe(7);
  });
});

describe("costOf", () => {
  it("bills each line item at the published rate", () => {
    const profile = w({
      inputTokens: 1_000_000, outputTokens: 0, reasoningTokens: 0,
      cacheHitRate: 0, cacheWriteRate: 0, contextTokens: 1_000,
    });
    expect(costOf(flatCost(3, 15), profile).total).toBeCloseTo(3, 9);
  });

  it("charges for cache writes, so a higher hit rate is not automatically cheaper", () => {
    const card: Cost = { ...flatCost(3, 15), cacheRead: 0.3, cacheWrite: 3.75 };
    const noCache = w({ cacheHitRate: 0, cacheWriteRate: 0 });
    // Every request re-writes the whole prefix and reads none of it back — the
    // pathological case a write-free model of caching reports as a saving.
    const churn = w({ cacheHitRate: 0, cacheWriteRate: 1 });
    expect(costOf(card, churn).total).toBeGreaterThan(costOf(card, noCache).total);
  });

  it("bills reasoning tokens at the output rate when none is published", () => {
    const profile = w({
      inputTokens: 0, outputTokens: 0, reasoningTokens: 1_000_000,
      cacheHitRate: 0, cacheWriteRate: 0,
    });
    expect(costOf(flatCost(1, 20), profile).total).toBeCloseTo(20, 9);
  });

  it("uses a separately published reasoning rate when there is one", () => {
    const card: Cost = { ...flatCost(1, 20), reasoning: 5 };
    const profile = w({
      inputTokens: 0, outputTokens: 0, reasoningTokens: 1_000_000,
      cacheHitRate: 0, cacheWriteRate: 0,
    });
    expect(costOf(card, profile).total).toBeCloseTo(5, 9);
  });

  it("assumes no cache discount when a provider publishes none", () => {
    const profile = w({
      inputTokens: 1_000_000, outputTokens: 0, reasoningTokens: 0,
      cacheHitRate: 1, cacheWriteRate: 0,
    });
    // cacheRead is null: charging $0 here would invent a discount nobody offers.
    expect(costOf(flatCost(3, 15), profile).total).toBeCloseTo(3, 9);
  });

  it("prices a long-context request on the tier it actually trips", () => {
    const short = costOf(tiered, w({ contextTokens: 100_000 }));
    const long = costOf(tiered, w({ contextTokens: 300_000 }));
    expect(long.tier).not.toBeNull();
    expect(long.perMillion).toBeGreaterThan(short.perMillion);
  });

  it("treats $0/$0 as no published price, never as free", () => {
    expect(costOf(flatCost(0, 0), DEFAULT_WORKLOAD).priced).toBe(false);
    expect(ratePerMillion(flatCost(0, 0), DEFAULT_WORKLOAD)).toBe(Number.POSITIVE_INFINITY);
  });

  it("sorts an unpriced listing last rather than cheapest", () => {
    const unpriced: Cost = { ...flatCost(0, 0), input: null, output: null };
    expect(ratePerMillion(unpriced, DEFAULT_WORKLOAD)).toBe(Number.POSITIVE_INFINITY);
  });

  it("reports perMillion consistently with the per-request total", () => {
    const b = costOf(flatCost(3, 15), DEFAULT_WORKLOAD);
    expect(b.perMillion).toBeCloseTo((b.total / billableTokens(DEFAULT_WORKLOAD)) * 1e6, 9);
  });
});

describe("workload ordering", () => {
  it("reorders two models when the workload changes", () => {
    // Cheap input, dear output vs. the reverse — whichever wins depends
    // entirely on the profile, which is the whole point of the module.
    const inputHeavy = flatCost(0.5, 20);
    const outputHeavy = flatCost(8, 8);
    const rag = workloadById("rag");
    const reasoning = workloadById("reasoning");
    expect(ratePerMillion(inputHeavy, rag)).toBeLessThan(ratePerMillion(outputHeavy, rag));
    expect(ratePerMillion(inputHeavy, reasoning)).toBeGreaterThan(ratePerMillion(outputHeavy, reasoning));
  });

  it("falls back to the default for an unknown workload id", () => {
    expect(workloadById("nonsense").id).toBe(DEFAULT_WORKLOAD.id);
    expect(workloadById(null).id).toBe(DEFAULT_WORKLOAD.id);
  });
});

describe("monthlyCost", () => {
  it("scales the per-request bill by volume", () => {
    const one = costOf(flatCost(3, 15), DEFAULT_WORKLOAD).total;
    expect(monthlyCost(flatCost(3, 15), DEFAULT_WORKLOAD, 10_000)).toBeCloseTo(one * 10_000, 9);
  });

  it("returns null rather than $0 for an unpriced listing", () => {
    expect(monthlyCost(flatCost(0, 0), DEFAULT_WORKLOAD, 1_000)).toBeNull();
  });
});

describe("firstTierThreshold", () => {
  it("names the context length at which a listing gets dearer", () => {
    expect(firstTierThreshold(tiered)).toBe(272_000);
    expect(firstTierThreshold(flatCost(1, 2))).toBeNull();
  });
});
