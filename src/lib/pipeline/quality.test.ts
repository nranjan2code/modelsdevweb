import { describe, expect, it } from "vitest";
import { runQuality, type GroupFacts, type QualityInput } from "./quality";
import type { Event } from "./types";

const NOW = new Date("2026-08-21T18:00:00Z");

const listing = (key: string, opts: Partial<{ canonicalId: string | null; active: boolean; zeroPriced: boolean }> = {}) => ({
  key,
  canonicalId: opts.canonicalId ?? key,
  active: opts.active ?? true,
  zeroPriced: opts.zeroPriced ?? false,
});

const group = (id: string, over: Partial<GroupFacts> = {}): GroupFacts => ({
  id,
  labId: id.split("/")[0],
  labKnown: true,
  free: false,
  best: { input: 1, output: 2 },
  releaseDate: "2026-08-01",
  listings: [listing(`${id}`)],
  ...over,
});

const baseInput = (over: Partial<QualityInput> = {}): QualityInput => ({
  now: NOW,
  snapshotDate: "2026-08-21",
  fetchedAt: "2026-08-21T16:29:13Z",
  apiRaw: {
    openai: { models: { gpt: { name: "GPT" } } },
    kilo: { models: { "stealth/ox-alpha": { name: "Ox Alpha", release_date: "2026-08-20" } } },
  },
  groups: [group("openai/gpt"), group("stealth/ox-alpha", { releaseDate: "2026-08-20", best: null, free: true, listings: [listing("kilo/stealth/ox-alpha", { canonicalId: null, zeroPriced: true })] })],
  stats: { providers: 2, listings: 2, models: 2, labs: 1 },
  labIds: ["openai"],
  canonicalLabs: new Set(["openai"]),
  canonicalIds: new Set(["openai/gpt"]),
  events: [],
  news: [],
  liveApiRaw: null,
  ...over,
});

describe("runQuality", () => {
  it("passes on a healthy dataset", () => {
    const r = runQuality(baseInput());
    expect(r.ok).toBe(true);
    expect(r.errors).toEqual([]);
  });

  it("fails when the snapshot is stale (sync silently dead)", () => {
    const r = runQuality(baseInput({ fetchedAt: "2026-08-19T00:00:00Z" }));
    expect(r.errors.some((e) => e.check === "freshness")).toBe(true);
  });

  it("warns on small upstream drift but fails on wholesale divergence", () => {
    const live = { openai: { models: Object.fromEntries(["gpt", ...Array.from({ length: 10 }, (_, k) => `m${k}`)].map((id) => [id, {}])) } };
    const snap = baseInput({ apiRaw: { openai: { models: { gpt: {} } } }, liveApiRaw: live });
    expect(runQuality(snap).errors.some((e) => e.check === "upstream-complete")).toBe(false);
    expect(runQuality(snap).warnings.some((e) => e.check === "upstream-drift")).toBe(true);

    const broken = baseInput({
      apiRaw: { openai: { models: {} } },
      liveApiRaw: { openai: { models: Object.fromEntries(["gpt", ...Array.from({ length: 120 }, (_, k) => `x${k}`)].map((id) => [id, {}])) } },
      groups: [],
      stats: { providers: 1, listings: 0, models: 0, labs: 0 },
      labIds: [],
    });
    expect(runQuality(broken).errors.some((e) => e.check === "upstream-complete" && e.message.includes("openai/gpt"))).toBe(true);
  });

  it("fails when a fresh upstream release is dropped by normalization (the ox-alpha regression)", () => {
    const r = runQuality(
      baseInput({
        // raw still lists kilo/stealth/ox-alpha but catalog lost every group holding it
        groups: [group("openai/gpt")],
        stats: { providers: 2, listings: 1, models: 1, labs: 1 },
      }),
    );
    expect(r.errors.some((e) => e.check === "new-release-visibility" && e.message.includes("kilo/stealth/ox-alpha"))).toBe(true);
  });

  it("fails when a recent release's group date predates the listing (invisible on home freshest)", () => {
    const r = runQuality(
      baseInput({
        groups: [
          group("openai/gpt"),
          group("stealth/ox-alpha", { releaseDate: "2025-01-01", listings: [listing("kilo/stealth/ox-alpha", { canonicalId: null })] }),
        ],
      }),
    );
    expect(r.errors.some((e) => e.check === "new-release-visibility" && e.message.includes("date predates"))).toBe(true);
  });

  it("fails when provider fallbacks leak into the labs aggregation (pseudo-labs)", () => {
    const r = runQuality(baseInput({ labIds: ["openai", "nano-gpt"], stats: { providers: 2, listings: 2, models: 2, labs: 2 } }));
    expect(r.errors.some((e) => e.check === "lab-hygiene" && e.message.includes("nano-gpt"))).toBe(true);
  });

  it("fails when stats disagree with recomputed counts", () => {
    const r = runQuality(baseInput({ stats: { providers: 99, listings: 99, models: 99, labs: 1 } }));
    expect(r.errors.filter((e) => e.check === "stats-integrity")).toHaveLength(3);
  });

  it("fails when an all-free model is not flagged free or keeps a phantom best price", () => {
    const r = runQuality(
      baseInput({
        groups: [group("openai/gpt"), group("stealth/ox-alpha", { free: false, best: null, listings: [listing("kilo/stealth/ox-alpha", { canonicalId: null, zeroPriced: true })] })],
      }),
    );
    expect(r.errors.some((e) => e.check === "free-integrity" && e.message.includes("free=false"))).toBe(true);
  });

  it("fails when a recent event references a listing absent from the snapshot", () => {
    const ev = (id: string, modelKey: string, date = "2026-08-21"): Event => ({
      id,
      type: "repriced",
      date,
      modelKey,
      modelName: "M",
      canonicalId: null,
      labId: null,
      providerId: null,
      changes: [],
    });
    const r = runQuality(baseInput({ events: [ev("ok", "openai/gpt"), ev("gone", "ofox/vanished-model")] }));
    expect(r.errors.some((e) => e.check === "events-integrity" && e.message.includes("ofox/vanished-model"))).toBe(true);
  });

  it("warns (not errors) on stale news and dead news deep-links", () => {
    const r = runQuality(
      baseInput({
        news: [{ id: "n1", title: "t", url: "https://x/a", publishedAt: "2026-08-01T00:00:00Z", modelIds: ["nope/model"] }],
      }),
    );
    expect(r.errors).toEqual([]);
    expect(r.warnings.some((w) => w.check === "news-integrity" && w.message.includes("old"))).toBe(true);
    expect(r.warnings.some((w) => w.message.includes("nope/model"))).toBe(true);
  });
});
