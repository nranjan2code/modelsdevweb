import { describe, expect, it } from "vitest";
import type { Listing } from "../pipeline/types";
import type { ModelGroup } from "../data/index";
import { basisReport, bestDiscounts } from "./basis";

const listing = (providerId: string, input: number, output: number): Listing => ({
  key: `${providerId}/m`,
  providerId,
  providerName: providerId,
  modelId: "m",
  canonicalId: "openai/m",
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
  modalities: { input: ["text"], output: ["text"] },
  limit: { context: 200_000, output: null, input: null },
  cost: {
    input, output, cacheRead: null, cacheWrite: null,
    reasoning: null, inputAudio: null, outputAudio: null, tiers: [],
  },
});

const group = (listings: Listing[]): ModelGroup => ({
  id: "openai/m",
  labId: "openai",
  labKnown: true,
  name: "M",
  canonical: null,
  listings,
  best: null,
  free: false,
  deprecatedCount: 0,
});

describe("basisReport", () => {
  it("measures gateway quotes against the lab's own counter", () => {
    const r = basisReport(
      group([
        listing("openai", 10, 30),
        listing("gw1", 12, 36),
        listing("gw2", 13, 39),
        listing("gw3", 11, 33),
      ]),
    )!;
    expect(r.referenceProvider).toBe("openai");
    expect(r.quotes).toHaveLength(3);
    // gw3 is 10% over the lab's rate.
    expect(r.bestBasis).toBeCloseTo(0.1, 6);
  });

  it("returns null without a first-party reference", () => {
    expect(basisReport(group([listing("gw1", 1, 2), listing("gw2", 1, 2), listing("gw3", 1, 2)]))).toBeNull();
  });

  it("returns null below the minimum number of quotes", () => {
    expect(basisReport(group([listing("openai", 10, 30), listing("gw1", 12, 36)]))).toBeNull();
  });

  it("keeps a lone mis-scaled quote out of the headline basis (the unorouter case)", () => {
    // One venue publishes a rate ~50x below everyone else — a feed error, not a
    // 96% discount anyone can transact at.
    const r = basisReport(
      group([
        listing("openai", 10, 30),
        listing("unorouter", 0.19, 0.5),
        listing("gw1", 11, 33),
        listing("gw2", 12, 36),
        listing("gw3", 11.5, 34),
      ]),
    )!;
    expect(r.bestBasis).toBeGreaterThan(-0.5);
    expect(r.quotes.some((q) => q.providerId === "unorouter")).toBe(true);
    expect(r.corroborated.some((q) => q.providerId === "unorouter")).toBe(false);
  });

  it("accepts a discount two venues agree on", () => {
    const r = basisReport(
      group([
        listing("openai", 10, 30),
        listing("gw1", 5, 15),
        listing("gw2", 5.5, 16),
        listing("gw3", 11, 33),
      ]),
    )!;
    expect(r.bestBasis).toBeCloseTo(-0.5, 2);
    expect(r.corroborated.length).toBeGreaterThanOrEqual(2);
  });

  it("refuses to compare models whose token is not a text token", () => {
    // Whisper bills audio tokens; an image model bills a picture. Neither $/M
    // means the same thing as a text model's, so there is no basis to report.
    const audio = {
      ...group([listing("openai", 10, 30), listing("gw1", 1, 3), listing("gw2", 1, 3)]),
      listings: [listing("openai", 10, 30), listing("gw1", 1, 3), listing("gw2", 1, 3)].map((l) => ({
        ...l,
        modalities: { input: ["audio" as const, "text" as const], output: ["text" as const] },
      })),
    };
    expect(basisReport(audio)).toBeNull();
  });

  it("does not report a discount backed by a single venue", () => {
    const g = group([
      listing("openai", 10, 30),
      listing("cheap", 1, 3),
      listing("gw1", 11, 33),
      listing("gw2", 12, 36),
    ]);
    expect(bestDiscounts([g])).toHaveLength(0);
  });
});
