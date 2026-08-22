import { describe, expect, it } from "vitest";
import type { Event } from "../pipeline/types";
import type { ModelGroup } from "./index";
import {
  activityCalendar,
  headToHeads,
  labScorecards,
  leadStory,
  modelOfWeek,
  moversLosers,
  pulseSeries,
  records,
} from "./story";

const ev = (over: Partial<Event>): Event => ({
  id: "e1",
  type: "repriced",
  date: "2026-08-20",
  modelKey: "openrouter/x/m",
  modelName: "Model M",
  canonicalId: null,
  labId: null,
  providerId: "openrouter",
  changes: [],
  ...over,
});

const g = (over: Partial<ModelGroup>): ModelGroup => ({
  id: "x/m",
  labId: "x",
  labKnown: true,
  name: "M",
  canonical: null,
  listings: [],
  best: null,
  free: false,
  deprecatedCount: 0,
  ...over,
});

const NOW = Date.parse("2026-08-22T00:00:00Z");
const best = (input: number, output: number) => ({
  input,
  output,
  cacheRead: null,
  providerId: "p",
  providerName: "P",
  listingKey: "k",
});

describe("leadStory", () => {
  it("returns a baseline story with no events", () => {
    const s = leadStory([], new Map(), NOW);
    expect(s.kind).toBe("baseline");
    expect(s.href).toBe("/changelog");
  });

  it("picks the steepest input cut as the lead", () => {
    const events = [
      ev({ id: "a", date: "2026-08-21", modelName: "Small Cut", canonicalId: "x/small", changes: [{ field: "cost.input", old: 2, new: 1.9 }] }),
      ev({ id: "b", date: "2026-08-21", modelName: "Big Cut", canonicalId: "x/big", changes: [{ field: "cost.input", old: 4, new: 2 }] }),
    ];
    const groupsById = new Map([["x/small", g({id: "x/small"})], ["x/big", g({id: "x/big"})]]);
    const s = leadStory(events, groupsById, NOW);
    expect(s.kind).toBe("cut");
    expect(s.headline).toContain("Big Cut");
    expect(s.headline).toContain("50%");
    expect(s.dek).toContain("$4 → $2");
    expect(s.href).toBe("/m/x/big");
  });

  it("flags the steepest cut of the week in the eyebrow", () => {
    const events = [
      ev({ date: "2026-08-21", canonicalId: "x/big", changes: [{ field: "cost.input", old: 10, new: 5 }] }),
    ];
    const groupsById = new Map([["x/big", g({id: "x/big"})]]);
    const s = leadStory(events, groupsById, NOW);
    expect(s.eyebrow).toContain("steepest cut of the week");
  });

  it("reports price hikes as a distinct kind", () => {
    const events = [ev({ canonicalId: "x/big", changes: [{ field: "cost.input", old: 1, new: 2 }] })];
    const groupsById = new Map([["x/big", g({id: "x/big"})]]);
    const s = leadStory(events, groupsById, NOW);
    expect(s.kind).toBe("hike");
    expect(s.headline).toContain("raises");
  });

  it("falls back to a quiet-day story when nothing is fresh", () => {
    const events = [ev({ date: "2026-08-01", type: "model_added" })];
    const s = leadStory(events, new Map(), NOW);
    expect(s.kind).toBe("quiet");
    expect(s.meta[0]).toContain("2026");
  });
});

describe("moversLosers", () => {
  it("chains multiple repricings into one net move per model", () => {
    const events = [
      ev({ id: "1", date: "2026-08-17", canonicalId: "x/m", changes: [{ field: "cost.input", old: 10, new: 8 }] }),
      ev({ id: "2", date: "2026-08-19", canonicalId: "x/m", changes: [{ field: "cost.input", old: 8, new: 5 }] }),
      ev({ id: "3", date: "2026-08-19", canonicalId: "y/n", changes: [{ field: "cost.input", old: 1, new: 3 }] }),
    ];
    const { fallers, risers } = moversLosers(events, 7, NOW);
    expect(fallers[0]).toMatchObject({ name: "Model M", from: 10, to: 5 });
    expect(risers[0]).toMatchObject({ from: 1, to: 3 });
    expect(risers[0].pct).toBeGreaterThan(0);
    expect(fallers[0].pct).toBeLessThan(0);
  });

  it("ignores repricings outside the window and non-input fields", () => {
    const events = [
      ev({ date: "2026-08-01", changes: [{ field: "cost.input", old: 10, new: 1 }] }),
      ev({ date: "2026-08-20", changes: [{ field: "cost.output", old: 10, new: 1 }] }),
    ];
    const { fallers, risers } = moversLosers(events, 7, NOW);
    expect(fallers).toHaveLength(0);
    expect(risers).toHaveLength(0);
  });
});

describe("records", () => {
  const mk = (over: Partial<ModelGroup>): ModelGroup => g(over);
  const catalog = {
    groups: [
      mk({ id: "a/big", name: "Big", best: best(5, 10), canonical: { limit: { context: 2_000_000 } } as never }),
      mk({
        id: "b/frontier",
        name: "Frontier",
        best: best(0.5, 1),
        canonical: { limit: { context: 256_000 } } as never,
        listings: [
          { status: null, limit: { context: null } },
          { status: null, limit: { context: null } },
          { status: "deprecated", limit: { context: null } },
        ] as never,
      }),
      mk({ id: "c/cheap", name: "Cheap", best: best(0.01, 0.03), canonical: { limit: { context: 32_000 } } as never }),
      mk({ id: "d/open", name: "OpenOne", best: best(1, 2), canonical: { openWeights: true, limit: { context: 128_000 } } as never }),
    ],
    groupById: new Map(),
    providers: [],
    labs: [],
    stats: { providers: 3, listings: 6, models: 4, labs: 4, deprecated: 1, openWeights: 1, snapshotDate: null },
  };

  it("surfaces superlatives with links", () => {
    const rows = records(catalog as never);
    const byTitle = new Map(rows.map((r) => [r.title, r]));
    expect(byTitle.get("Longest context window")?.holder).toBe("Big");
    expect(byTitle.get("Longest context window")?.value).toContain("2M");
    expect(byTitle.get("Cheapest paid model")?.value).toContain("$0.01");
    expect(byTitle.get("Cheapest paid model")?.holder).toBe("Cheap");
    expect(byTitle.get("Biggest open-weights context")?.holder).toBe("OpenOne");
    const frontier = byTitle.get("Cheapest frontier-grade (200K+ ctx)");
    expect(frontier?.id).toBe("b/frontier"); // Cheap lacks 200K context
    expect(byTitle.get("Widest availability")?.value).toContain("2 providers");
  });
});

describe("labScorecards", () => {
  it("aggregates per-lab stats and counts weekly events", () => {
    const groups = [
      g({ id: "a/1", labId: "alpha", name: "A1", best: best(1, 1), canonical: { releaseDate: "2026-08-20" } as never }),
      g({ id: "a/2", labId: "alpha", name: "A2", best: best(3, 3) }),
      g({ id: "b/1", labId: "beta", name: "B1", best: best(9, 9) }),
      g({ id: "u/1", labId: "unknown-lab", labKnown: false, name: "U" }),
    ];
    const events = [ev({ date: "2026-08-21", labId: "beta", type: "model_added" })];
    const cards = labScorecards(
      { groups, labs: [], providers: [], groupById: new Map(), stats: {} } as never,
      events,
    );
    const alpha = cards.find((c) => c.id === "alpha")!;
    const beta = cards.find((c) => c.id === "beta")!;
    expect(alpha.models).toBe(2);
    expect(beta.weeklyEvents).toBe(1);
    expect(beta.models).toBe(1);
    expect(cards.find((c) => c.id === "unknown-lab")).toBeUndefined();
    expect(alpha.medianBlend).not.toBeNull();
    expect(alpha.lastRelease).toBe("2026-08-20");
  });
});

describe("modelOfWeek", () => {
  it("is deterministic within a day and rotates across days", () => {
    const groups = Array.from({ length: 12 }, (_, i) =>
      g({ id: `lab/m${i}`, name: `M${i}`, best: best(1 + i, 2 + i), canonical: { reasoning: true } as never }),
    );
    const d1 = modelOfWeek(groups, new Date(Date.parse("2026-08-20T00:00:00Z")));
    const d1again = modelOfWeek(groups, new Date(Date.parse("2026-08-20T23:59:59Z")));
    const d2 = modelOfWeek(groups, new Date(Date.parse("2026-08-27T00:00:00Z")));
    expect(d1?.id).toBe(d1again?.id);
    expect(d2?.id).not.toBe(d1?.id);
  });

  it("excludes free and unpriced groups", () => {
    const groups = [g({ id: "free", free: true }), g({ id: "noprice" })];
    expect(modelOfWeek(groups, new Date())).toBeNull();
  });
});

describe("pulseSeries", () => {
  it("computes daily medians over frontier ids only", () => {
    const history = new Map<string, { date: string; input: number | null; output: number | null; providers: number }[]>([
      ["f/a", [
        { date: "2026-08-20", input: 2, output: 2, providers: 1 },
        { date: "2026-08-21", input: 1, output: 1, providers: 1 },
      ]],
      ["f/b", [
        { date: "2026-08-20", input: 4, output: 4, providers: 1 },
        { date: "2026-08-21", input: 3, output: 3, providers: 1 },
      ]],
      ["other/x", [{ date: "2026-08-20", input: 100, output: 100, providers: 1 }]],
    ]);
    const series = pulseSeries(history as never, new Set(["f/a", "f/b"]));
    expect(series).toHaveLength(2);
    expect(series[0].models).toBe(2);
    expect(series[0].median).toBeCloseTo(3); // median of blends (2/2→2, 4/4→4)
    expect(series[1].median).toBeCloseTo(2); // median of blends (1/1→1, 3/3→3)
  });
});

describe("headToHeads", () => {
  it("pairs newest flagships of consecutive major labs", () => {
    const groups = [
      g({ id: "a/new", labId: "a", name: "A-new", best: best(1, 1), canonical: { releaseDate: "2026-08-21" } as never }),
      g({ id: "a/old", labId: "a", name: "A-old", best: best(1, 1), canonical: { releaseDate: "2026-01-01" } as never }),
      g({ id: "b/new", labId: "b", name: "B-new", best: best(2, 2), canonical: { releaseDate: "2026-08-20" } as never }),
      g({ id: "c/unpriced", labId: "c", name: "C", best: null }),
      g({ id: "d/new", labId: "d", name: "D-new", best: best(3, 3), canonical: { releaseDate: "2026-08-19" } as never }),
    ];
    const pairs = headToHeads(
      groups,
      [
        { id: "a", modelCount: 10 },
        { id: "c", modelCount: 8 }, // unpriced flagship → skipped
        { id: "b", modelCount: 6 },
        { id: "d", modelCount: 2 },
      ],
    );
    expect(pairs).toHaveLength(1);
    expect(pairs[0].left.name).toBe("A-new");
    expect(pairs[0].right.name).toBe("B-new");
  });
});

describe("activityCalendar", () => {
  it("zero-fills days without events, oldest first", () => {
    const cal = activityCalendar([ev({ date: "2026-08-22" }), ev({ date: "2026-08-22" })], 14, NOW);
    expect(cal).toHaveLength(14);
    expect(cal[0].date).toBe("2026-08-09");
    expect(cal[13].count).toBe(2);
    expect(cal[12].count).toBe(0);
  });
});
