import { describe, expect, it } from "vitest";
import { runQuality, type GroupFacts, type QualityInput } from "./quality";
import type { Event } from "./types";

const NOW = new Date("2026-08-21T18:00:00Z");

const listing = (key: string, opts: Partial<{ canonicalId: string | null; active: boolean; zeroPriced: boolean }> = {}) => ({
  key,
  canonicalId: "canonicalId" in opts ? (opts.canonicalId ?? null) : key,
  active: opts.active ?? true,
  zeroPriced: opts.zeroPriced ?? false,
});

const group = (id: string, over: Partial<GroupFacts> = {}): GroupFacts => ({
  id,
  labId: id.split("/")[0],
  labKnown: true,
  free: false,
  best: { input: 1, output: 2, listingKey: id },
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
  stats: { providers: 2, listings: 2, models: 2, activeModels: 2, catalogEntries: 2, labs: 1 },
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
      stats: { providers: 1, listings: 0, models: 0, activeModels: 0, catalogEntries: 0, labs: 0 },
      labIds: [],
    });
    expect(runQuality(broken).errors.some((e) => e.check === "upstream-complete" && e.message.includes("openai/gpt"))).toBe(true);
  });

  it("fails when a fresh upstream release is dropped by normalization (the ox-alpha regression)", () => {
    const r = runQuality(
      baseInput({
        // raw still lists kilo/stealth/ox-alpha but catalog lost every group holding it
        groups: [group("openai/gpt")],
        stats: { providers: 2, listings: 1, models: 1, activeModels: 1, catalogEntries: 1, labs: 1 },
      }),
    );
    expect(r.errors.some((e) => e.check === "new-release-visibility" && e.message.includes("kilo/stealth/ox-alpha"))).toBe(true);
  });

  it("fails when a recent release's group date predates the listing (invisible on home freshest)", () => {
    const r = runQuality(
      baseInput({
        groups: [
          group("openai/gpt"),
          group("stealth/ox-alpha", { labKnown: false, releaseDate: "2025-01-01", listings: [listing("kilo/stealth/ox-alpha", { canonicalId: null })] }),
        ],
      }),
    );
    expect(r.errors.some((e) => e.check === "new-release-visibility" && e.message.includes("date predates"))).toBe(true);
  });

  it("accepts a provider endpoint added after its canonical model was released", () => {
    const r = runQuality(
      baseInput({
        apiRaw: {
          openai: { models: { gpt: { name: "GPT" } } },
          hyper: { models: { "qwen3.8-27b": { name: "Qwen 3.8 27B", release_date: "2026-08-20" } } },
        },
        groups: [
          group("openai/gpt"),
          group("alibaba/qwen3.8-27b", {
            releaseDate: "2026-08-14",
            listings: [listing("hyper/qwen3.8-27b", { canonicalId: null })],
          }),
        ],
      }),
    );
    expect(r.errors.filter((e) => e.check === "new-release-visibility")).toHaveLength(0);
  });

  it("does not treat last_updated as a model release date", () => {
    const r = runQuality(
      baseInput({
        apiRaw: {
          openai: { models: { gpt: { name: "GPT" } } },
          kilo: { models: { legacy: { name: "Legacy", last_updated: "2026-08-20" } } },
        },
        groups: [
          group("openai/gpt"),
          group("legacy", {
            labKnown: false,
            releaseDate: "2025-01-01",
            listings: [listing("kilo/legacy", { canonicalId: null })],
          }),
        ],
      }),
    );
    expect(r.errors.filter((e) => e.check === "new-release-visibility")).toHaveLength(0);
  });

  it("fails when provider fallbacks leak into the labs aggregation (pseudo-labs)", () => {
    const r = runQuality(baseInput({ labIds: ["openai", "nano-gpt"], stats: { providers: 2, listings: 2, models: 2, activeModels: 2, catalogEntries: 2, labs: 2 } }));
    expect(r.errors.some((e) => e.check === "lab-hygiene" && e.message.includes("nano-gpt"))).toBe(true);
  });

  it("fails when a group's best price comes from a withdrawn endpoint", () => {
    const r = runQuality(
      baseInput({
        groups: [
          group("openai/gpt", {
            best: { input: 1, output: 2, listingKey: "openai/gpt" },
            listings: [listing("openai/gpt", { active: false })],
          }),
        ],
        stats: { providers: 2, listings: 1, models: 1, activeModels: 0, catalogEntries: 1, labs: 1 },
      }),
    );
    expect(r.errors.some((e) => e.check === "retirement-integrity" && e.message.includes("withdrawn endpoint"))).toBe(true);
  });

  it("fails when the active-model count includes models nobody serves", () => {
    const r = runQuality(
      baseInput({
        groups: [group("openai/gpt", { best: null, listings: [listing("openai/gpt", { active: false })] })],
        // Claims one active model while its only listing is withdrawn.
        stats: { providers: 2, listings: 1, models: 1, activeModels: 1, catalogEntries: 1, labs: 1 },
      }),
    );
    expect(r.errors.some((e) => e.check === "retirement-integrity" && e.message.includes("activeModels"))).toBe(true);
  });

  it("accepts a model withdrawn at one venue but live at another", () => {
    const r = runQuality(
      baseInput({
        groups: [
          group("openai/gpt", {
            best: { input: 1, output: 2, listingKey: "openai/gpt" },
            listings: [listing("openai/gpt"), listing("gateway/gpt", { active: false })],
          }),
        ],
        stats: { providers: 2, listings: 2, models: 1, activeModels: 1, catalogEntries: 1, labs: 1 },
      }),
    );
    expect(r.errors.filter((e) => e.check === "retirement-integrity")).toHaveLength(0);
  });

  it("fails when stats disagree with recomputed counts", () => {
    const r = runQuality(baseInput({ stats: { providers: 99, listings: 99, models: 99, activeModels: 99, catalogEntries: 99, labs: 1 } }));
    // providers, listings, catalogEntries and the lab-attributed model count.
    expect(r.errors.filter((e) => e.check === "stats-integrity")).toHaveLength(4);
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

  it("accepts removal events whose modelKey/canonicalId have left the snapshot", () => {
    // Upstream deleted the listing; the model_removed event must not red-line the gate.
    const removed = (id: string, modelKey: string): Event => ({
      id,
      type: "model_removed",
      date: "2026-08-22",
      modelKey,
      modelName: "Vanished",
      canonicalId: "ofox/vanished-model",
      labId: "ofox",
      providerId: "kilo",
      changes: [],
    });
    const r = runQuality(
      baseInput({
        now: new Date("2026-08-22T00:30:00Z"),
        fetchedAt: "2026-08-21T23:00:00Z",
        snapshotDate: "2026-08-21",
        events: [
          removed("r1", "openrouter/deepcogito/cogito-v2.1-671b"),
          removed("r2", "kilo/deepcogito/cogito-v2.1-671b"),
        ],
      }),
    );
    expect(r.errors.filter((e) => e.check === "events-integrity")).toEqual([]);
    expect(r.ok).toBe(true);
  });

  it("keeps historical events when a later removal explains the missing listing", () => {
    const event = (id: string, type: Event["type"], date: string): Event => ({
      id,
      type,
      date,
      modelKey: "ofox/vanished-model",
      modelName: "Vanished",
      canonicalId: null,
      labId: null,
      providerId: "ofox",
      changes: [],
    });
    const r = runQuality(
      baseInput({
        events: [
          event("added", "model_added", "2026-08-21"),
          event("removed", "model_removed", "2026-08-22"),
        ],
      }),
    );
    expect(r.errors.filter((e) => e.check === "events-integrity")).toEqual([]);
    expect(r.ok).toBe(true);
  });

  it("warns on stale news but fails on dead news deep-links", () => {
    const r = runQuality(
      baseInput({
        news: [{ id: "n1", title: "t", url: "https://x/a", publishedAt: "2026-08-01T00:00:00Z", modelIds: ["nope/model"] }],
      }),
    );
    expect(r.errors.some((e) => e.check === "news-links" && e.message.includes("nope/model"))).toBe(true);
    expect(r.warnings.some((w) => w.check === "news-integrity" && w.message.includes("old"))).toBe(true);
  });

  it("fails on an orphaned external signal", () => {
    const r = runQuality(baseInput({
      externalSignals: [{
        source: "github",
        signalType: "stars",
        modelId: "gone/model",
        value: 12,
        metadata: {},
        fetchedAt: NOW.toISOString(),
        license: "repo-specific",
        attributionUrl: "https://github.com/gone/model",
      }],
    }));
    expect(r.errors.some((e) => e.check === "external-signal-orphan")).toBe(true);
  });

  it("fails on an unreviewed extreme context claim", () => {
    const r = runQuality(baseInput({
      apiRaw: { openai: { models: { gpt: { limit: { context: 10_000_000 } } } } },
    }));
    expect(r.errors.some((e) => e.check === "context-sanity" && e.message.includes("without a sourced review"))).toBe(true);
  });

  it("accepts an exact reviewed extreme context claim but fails when it changes", () => {
    const accepted = runQuality(baseInput({
      apiRaw: { "nano-gpt": { models: { "pokee-isaac": { limit: { context: 10_000_000 } } } } },
    }));
    expect(accepted.errors.some((e) => e.check === "context-sanity")).toBe(false);

    const changed = runQuality(baseInput({
      apiRaw: { "nano-gpt": { models: { "pokee-isaac": { limit: { context: 12_000_000 } } } } },
    }));
    expect(changed.errors.some((e) => e.check === "context-sanity" && e.message.includes("review is stale"))).toBe(true);
  });
});
