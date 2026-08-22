import { describe, expect, it } from "vitest";
import { collapseByModel, frontierIndex, INDEX_MIN_DAYS, lede, marketMoves, type Move } from "./brief";
import type { Catalog } from "./index";
import type { Event } from "../pipeline/types";
import type { PriceArchive } from "./archive";

const today = "2026-08-22";
const NOW = Date.parse(`${today}T12:00:00Z`);

function repriced(over: Partial<Event> & { providerId: string; old: number; new: number }): Event {
  return {
    id: `${over.providerId}-${over.old}-${over.new}`,
    type: "repriced",
    date: today,
    modelKey: `${over.providerId}/m`,
    modelName: "M",
    canonicalId: "openai/m",
    labId: null,
    changes: [{ field: "cost.input", old: over.old, new: over.new }],
    ...over,
  } as Event;
}

const catalog = {
  groups: [
    {
      id: "openai/m", labId: "openai", labKnown: true, name: "M", canonical: null,
      listings: [
        { key: "openai/m", providerId: "openai", providerName: "OpenAI" },
        { key: "kilo/m", providerId: "kilo", providerName: "Kilo Gateway" },
      ],
      best: null, free: false, deprecatedCount: 0,
    },
  ],
  tracked: [],
  groupById: new Map(),
  providers: [], labs: [],
  stats: {} as Catalog["stats"],
} as unknown as Catalog;
catalog.groupById = new Map(catalog.groups.map((g) => [g.id, g]));

describe("marketMoves", () => {
  it("separates a lab repricing its model from a gateway changing its markup", () => {
    const m = marketMoves(
      [repriced({ providerId: "openai", old: 5, new: 4 }), repriced({ providerId: "kilo", old: 1, new: 3 })],
      catalog, 7, NOW,
    );
    expect(m.firstParty.map((x) => x.providerId)).toEqual(["openai"]);
    expect(m.street.map((x) => x.providerId)).toEqual(["kilo"]);
  });

  it("ignores moves into or out of an unpublished $0 price", () => {
    const m = marketMoves([repriced({ providerId: "openai", old: 0, new: 4 })], catalog, 7, NOW);
    expect(m.firstParty).toHaveLength(0);
  });

  it("chains repeated nudges from one provider into a single move", () => {
    const m = marketMoves(
      [
        repriced({ id: "a", providerId: "openai", old: 5, new: 4 }),
        repriced({ id: "b", providerId: "openai", old: 4, new: 2 }),
      ],
      catalog, 7, NOW,
    );
    expect(m.firstParty).toHaveLength(1);
    expect(m.firstParty[0].from).toBe(5);
    expect(m.firstParty[0].to).toBe(2);
  });
});

const noMoves = { firstParty: [] as Move[], street: [] as Move[] };
const emptyCatalog = { ...catalog, tracked: [] } as Catalog;

describe("lede", () => {
  it("leads with a first-party cut over anything a reseller did", () => {
    const l = lede(
      {
        firstParty: [{ id: "openai/m", name: "M", labId: "openai", providerId: "openai", providerName: "OpenAI", from: 5, to: 2, pct: -0.6, date: today, firstParty: true }],
        street: [{ id: "openai/m", name: "M", labId: "openai", providerId: "kilo", providerName: "Kilo", from: 1, to: 5, pct: 4, date: today, firstParty: false }],
      },
      emptyCatalog, [], NOW,
    );
    expect(l.kind).toBe("cut");
    expect(l.headline).toContain("60% cheaper");
  });

  it("labels a gateway-only move as the reseller's, not the lab's", () => {
    const l = lede(
      { firstParty: [], street: [{ id: "openai/m", name: "M", labId: "openai", providerId: "kilo", providerName: "Kilo Gateway", from: 1, to: 3, pct: 2, date: today, firstParty: false }] },
      emptyCatalog, [], NOW,
    );
    expect(l.kind).toBe("street");
    expect(l.body).toContain("The lab has not moved");
  });

  it("says a quiet week is quiet instead of manufacturing a story", () => {
    const l = lede(noMoves, emptyCatalog, [], NOW);
    expect(l.kind).toBe("quiet");
    expect(l.headline).toBe("No lab moved its prices this week");
  });

  it("always names the rule that selected the story", () => {
    for (const l of [lede(noMoves, emptyCatalog, [], NOW)]) expect(l.rule.length).toBeGreaterThan(0);
  });
});

describe("frontierIndex", () => {
  const build = (days: number): PriceArchive => ({
    dates: Array.from({ length: days }, (_, i) => `2026-08-${String(i + 1).padStart(2, "0")}`),
    models: { a: { name: "A", labId: "openai", in: Array(days).fill(2), out: Array(days).fill(10), n: Array(days).fill(3) } },
  });

  it("refuses to publish until there is enough history to mean anything", () => {
    const idx = frontierIndex(build(3), new Set(["a"]));
    expect(idx.ready).toBe(false);
    expect(idx.changePct).toBeNull();
    expect(idx.daysNeeded).toBe(INDEX_MIN_DAYS - 3);
  });

  it("publishes once the archive is deep enough", () => {
    const idx = frontierIndex(build(INDEX_MIN_DAYS), new Set(["a"]));
    expect(idx.ready).toBe(true);
    expect(idx.latest).toBe(4);
  });

  it("skips days a model was not listed rather than reading them as free", () => {
    const a = build(INDEX_MIN_DAYS);
    a.models.a.in[0] = null;
    a.models.a.out[0] = null;
    expect(frontierIndex(a, new Set(["a"])).points).toHaveLength(INDEX_MIN_DAYS - 1);
  });
});

describe("collapseByModel", () => {
  const move = (providerId: string, pct: number, id = "openai/m"): Move => ({
    id, name: "M", labId: "openai", providerId, providerName: providerId,
    from: 1, to: 1 + pct, pct, date: today, firstParty: false,
  });

  it("reports one row per model when several gateways make the same move", () => {
    const rows = collapseByModel([move("kilo", 1), move("openrouter", 1), move("nanogpt", 1)]);
    expect(rows).toHaveLength(1);
    expect(rows[0].venues).toBe(3);
  });

  it("keeps distinct models apart", () => {
    const rows = collapseByModel([move("kilo", 1), move("kilo", 2, "openai/other")]);
    expect(rows).toHaveLength(2);
  });

  it("represents a cluster by its median move, not its most extreme", () => {
    const rows = collapseByModel([move("a", 0.1), move("b", 0.5), move("c", 9)]);
    expect(rows[0].pct).toBe(0.5);
  });
});
