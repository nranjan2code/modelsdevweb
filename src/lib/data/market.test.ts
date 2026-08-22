import { describe, expect, it } from "vitest";
import { isFirstParty, priceSpread, spreadSummary } from "./market";
import type { ModelGroup } from "./index";
import type { Listing } from "../pipeline/types";

function listing(over: Partial<Listing> & { providerId: string; input: number; output: number; context?: number }): Listing {
  const { input, output, context, ...rest } = over;
  return {
    key: `${over.providerId}/m`,
    providerName: over.providerId,
    modelId: "m",
    canonicalId: null,
    name: "M",
    family: null,
    description: null,
    status: null,
    experimental: false,
    attachment: false,
    reasoning: false,
    toolCall: false,
    structuredOutput: null,
    temperature: true,
    openWeights: false,
    knowledge: null,
    releaseDate: null,
    lastUpdated: null,
    modalities: { input: [], output: [] },
    limit: { context: context ?? 200_000, output: null, input: null },
    cost: { input, output, cacheRead: null, cacheWrite: null, reasoning: null, inputAudio: null, outputAudio: null, tiers: false },
    ...rest,
  } as Listing;
}

function group(listings: Listing[], labId = "openai"): ModelGroup {
  return {
    id: "openai/m", labId, labKnown: true, name: "M", canonical: null,
    listings, best: null, free: false, deprecatedCount: 0,
  };
}

describe("isFirstParty", () => {
  it("matches the lab selling its own model", () => {
    expect(isFirstParty("openai", "openai")).toBe(true);
    expect(isFirstParty("google", "google-vertex")).toBe(true);
    expect(isFirstParty("alibaba", "dashscope")).toBe(true);
  });

  it("does not count clouds reselling someone else's model", () => {
    expect(isFirstParty("openai", "azure")).toBe(false);
    expect(isFirstParty("anthropic", "amazon-bedrock")).toBe(false);
    expect(isFirstParty("deepseek", "openrouter")).toBe(false);
  });
});

describe("priceSpread", () => {
  it("ignores $0/$0 listings, which mean no published price", () => {
    const s = priceSpread(group([
      listing({ providerId: "unlisted", input: 0, output: 0 }),
      listing({ providerId: "a", input: 2, output: 10 }),
      listing({ providerId: "openai", input: 5, output: 30 }),
    ]))!;
    expect(s.ranked.map((l) => l.providerId)).toEqual(["a", "openai"]);
    expect(s.cheapest.providerId).toBe("a");
  });

  it("drops listings implausibly far from the median as upstream errors", () => {
    const s = priceSpread(group([
      listing({ providerId: "junk-low", input: 0.001, output: 0.002 }),
      listing({ providerId: "a", input: 1, output: 2 }),
      listing({ providerId: "b", input: 1.1, output: 2 }),
      listing({ providerId: "c", input: 1.2, output: 2 }),
      listing({ providerId: "d", input: 1.3, output: 2 }),
      listing({ providerId: "junk-high", input: 900, output: 900 }),
    ]))!;
    expect(s.outliersDropped).toBe(2);
    expect(s.ratio).toBeLessThan(3);
  });

  it("flags when the cheapest listing truncates the context window", () => {
    // Blended, not headline, price decides "cheapest": 1/2 beats 2/10.
    const s = priceSpread(group([
      listing({ providerId: "cheap", input: 1, output: 2, context: 372_000 }),
      listing({ providerId: "full", input: 2, output: 10, context: 1_050_000 }),
      listing({ providerId: "openai", input: 5, output: 30, context: 1_050_000 }),
    ]))!;
    expect(s.cheapestIsCompromised).toBe(true);
    expect(s.cheapestFullContext?.providerId).toBe("full");
  });

  it("names the catch in the summary rather than just the lowest number", () => {
    const g = group([
      listing({ providerId: "cheap", input: 1, output: 2, context: 372_000 }),
      listing({ providerId: "full", input: 2, output: 10, context: 1_050_000 }),
      listing({ providerId: "openai", input: 5, output: 30, context: 1_050_000 }),
    ]);
    const text = spreadSummary(g, priceSpread(g)!);
    expect(text).toContain("full");
    expect(text).toMatch(/caps context at 372K/);
  });

  it("prefers the blended price, so a low headline rate with a high output rate does not win", () => {
    const s = priceSpread(group([
      listing({ providerId: "headline-cheap", input: 1.5, output: 12 }),
      listing({ providerId: "actually-cheap", input: 2, output: 10 }),
    ]))!;
    expect(s.cheapest.providerId).toBe("actually-cheap");
  });

  it("returns null when only one provider publishes a price", () => {
    expect(priceSpread(group([listing({ providerId: "a", input: 1, output: 2 })]))).toBeNull();
  });
});

describe("price corroboration", () => {
  // Priced to survive the median-outlier filter, so this exercises
  // corroboration rather than the coarser defence in front of it.
  it("does not recommend a price no other venue comes close to", () => {
    const s = priceSpread(group([
      listing({ providerId: "bait", input: 0.8, output: 0.8 }),
      listing({ providerId: "a", input: 8, output: 20 }),
      listing({ providerId: "b", input: 9, output: 22 }),
      listing({ providerId: "c", input: 10, output: 24 }),
      listing({ providerId: "d", input: 11, output: 26 }),
    ]))!;
    expect(s.cheapest.providerId).toBe("bait");
    expect(s.cheapestCredible?.providerId).toBe("a");
    expect(s.cheapestFullContext?.providerId).toBe("a");
  });

  it("measures the spread from a corroborated floor, not an outlier", () => {
    const s = priceSpread(group([
      listing({ providerId: "bait", input: 0.8, output: 0.8 }),
      listing({ providerId: "a", input: 8, output: 20 }),
      listing({ providerId: "b", input: 9, output: 22 }),
      listing({ providerId: "c", input: 10, output: 24 }),
      listing({ providerId: "d", input: 16, output: 40 }),
    ]))!;
    // Measured from a's $11 blended floor, not bait's $0.80.
    expect(s.ratio).toBeLessThan(4);
  });
});
