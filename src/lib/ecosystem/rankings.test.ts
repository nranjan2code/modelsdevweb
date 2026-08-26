import { describe, expect, it } from "vitest";
import { computeEcosystemScores } from "./rankings";
import type { EcosystemSignal } from "./types";

const signal = (entityId: string, metric: EcosystemSignal["metric"], value: number, change: number | null): EcosystemSignal => ({
  entityId,
  source: metric === "npm-weekly-downloads" ? "npm" : "github",
  metric,
  value,
  previousValue: change == null ? null : value - change,
  change,
  fetchedAt: "2026-08-26T00:00:00.000Z",
  attributionUrl: "https://example.com/source",
  license: "test",
});

describe("computeEcosystemScores", () => {
  it("ranks adoption and momentum without mutating signals", () => {
    const signals = [
      signal("steady", "stars", 100_000, 100),
      signal("steady", "forks", 10_000, 10),
      signal("rising", "stars", 10_000, 5_000),
      signal("rising", "npm-weekly-downloads", 100_000, 20_000),
    ];
    const before = JSON.stringify(signals);
    const scores = computeEcosystemScores(signals, new Date("2026-08-26T00:00:00.000Z"));

    expect(scores[0].entityId).toBe("rising");
    expect(scores.find((score) => score.entityId === "rising")?.momentum).toBeGreaterThan(
      scores.find((score) => score.entityId === "steady")?.momentum ?? 0,
    );
    expect(JSON.stringify(signals)).toBe(before);
  });
});
