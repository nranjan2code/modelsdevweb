import { describe, expect, it } from "vitest";
import { groupContext, IMPLAUSIBLE_CONTEXT_TOKENS, type ModelGroup } from "./index";

const listing = (ctx: number | null, key = `p/m`) => ({
  key,
  providerId: "p",
  providerName: "P",
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
  limit: { context: ctx, output: null, input: null },
  cost: { input: 1, output: 1, cacheRead: null, cacheWrite: null, reasoning: null, inputAudio: null, outputAudio: null, tiers: [] },
});

const g = (listings: ReturnType<typeof listing>[], canonicalCtx: number | null = null): ModelGroup => ({
  id: "x/m",
  labId: "x",
  labKnown: true,
  name: "M",
  canonical: canonicalCtx == null ? null : {
    id: "x/m", labId: "x", name: "M", description: null, family: null,
    attachment: null, reasoning: null, toolCall: null, structuredOutput: null,
    temperature: null, openWeights: null, knowledge: null, releaseDate: null,
    lastUpdated: null, modalities: null, limit: { context: canonicalCtx, output: null, input: null },
    weights: [], benchmarks: [],
  },
  listings,
  best: null,
  free: false,
  deprecatedCount: 0,
});

describe("groupContext outlier defense", () => {
  it("drops a lone implausible placeholder (qiniu kling-v2-6 case)", () => {
    expect(groupContext(g([listing(99_999_999)]))).toBeNull();
    expect(groupContext(g([listing(IMPLAUSIBLE_CONTEXT_TOKENS)]))).toBeNull();
  });

  it("drops a single-source claim above the ceiling (qiniu grok 20M case)", () => {
    expect(groupContext(g([listing(20_000_000)]))).toBeNull();
  });

  it("excludes a single-provider typo far above peers", () => {
    const grp = g([listing(9_000_000), listing(2_000_000), listing(2_000_000), listing(2_000_000)]);
    expect(groupContext(grp)).toBe(2_000_000);
  });

  it("keeps the max when values are legitimately spread and sources are few", () => {
    const grp = g([listing(1_048_576), listing(524_288)]);
    expect(groupContext(grp)).toBe(1_048_576);
  });

  it("keeps a legitimate large claim under the ceiling", () => {
    const grp = g([listing(10_000_000), listing(10_000_000), listing(10_000_000)]);
    expect(groupContext(grp)).toBe(10_000_000);
  });

  it("canonical participates but is subject to the same defenses", () => {
    expect(groupContext(g([listing(2_000_000), listing(2_000_000), listing(2_000_000)], 9_000_000))).toBe(2_000_000);
    expect(groupContext(g([], 1_000_000))).toBe(1_000_000);
    expect(groupContext(g([], 99_999_999))).toBeNull();
    expect(groupContext(g([], 20_000_000))).toBeNull();
  });

  it("returns null when no source publishes a context", () => {
    expect(groupContext(g([listing(null), listing(null)]))).toBeNull();
    expect(groupContext(g([]))).toBeNull();
  });
});
