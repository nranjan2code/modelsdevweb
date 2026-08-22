import { describe, expect, it } from "vitest";
import { computeCompositeScore } from "./composite";
import type { ExternalSignal } from "../pipeline/external-types";

const NOW = new Date("2026-08-22T12:00:00Z");
const day = (n: number) => new Date(NOW.getTime() - n * 86_400_000).toISOString();

function sig(over: Partial<ExternalSignal>): ExternalSignal {
  return {
    source: "hf",
    signalType: "downloads",
    modelId: "a/m1",
    value: 1_000_000,
    metadata: {},
    fetchedAt: day(0),
    license: "test",
    attributionUrl: "https://example.com",
    ...over,
  };
}

describe("computeCompositeScore", () => {
  it("scores a fully-signalized model above one with weak signals", () => {
    const strong = computeCompositeScore(
      [sig({ modelId: "a/strong", value: 10_000_000 }), sig({ modelId: "a/strong", signalType: "likes", value: 20_000 })],
      NOW,
    )[0];
    const weak = computeCompositeScore(
      [sig({ modelId: "b/weak", value: 100 })],
      NOW,
    )[0];
    expect(strong.score).toBeGreaterThan(weak.score);
    expect(strong.score).toBeLessThanOrEqual(1);
  });

  it("decays stale signals — same values, older fetch, lower score", () => {
    const fresh = computeCompositeScore([sig({ modelId: "x/fresh" })], NOW)[0];
    const old = computeCompositeScore([sig({ modelId: "x/old", fetchedAt: day(30) })], NOW)[0];
    expect(old.score).toBeLessThan(fresh.score);
    expect(old.score).toBeGreaterThan(0);
  });

  it("ignores non-finite and unknown source/type combos", () => {
    const scores = computeCompositeScore(
      [
        sig({ modelId: "x/nan", value: Number.NaN }),
        sig({ modelId: "x/github", source: "github", signalType: "downloads" }),
        sig({ modelId: "x/ok" }),
      ],
      NOW,
    );
    expect(scores.map((s) => s.groupId)).toEqual(["x/ok"]);
  });

  it("breakdown keys are namespaced by source:type", () => {
    const s = computeCompositeScore(
      [sig({ modelId: "x/mix", signalType: "likes" }), sig({ modelId: "x/mix", source: "github", signalType: "stars", value: 50_000 })],
      NOW,
    )[0];
    expect(Object.keys(s.breakdown).sort()).toEqual(["github:stars", "hf:likes"]);
  });
});
