import { describe, expect, it } from "vitest";
import { diffFields, classify, diffListings } from "./diff";
import { normalizeApi, normalizeModels, toListing, unlistedPrice } from "./normalize";

const MODELS_RAW = {
  "acme/g1": {
    id: "acme/g1",
    name: "G1",
    release_date: "2026-01-01",
    open_weights: true,
    weights: [{ label: "HF", url: "https://huggingface.co/acme/g1" }],
    benchmarks: [{ name: "SWE-Bench", score: 50 }],
  },
};

const API_RAW = {
  acme: {
    id: "acme",
    name: "Acme",
    env: ["ACME_KEY"],
    npm: "@ai-sdk/openai-compatible",
    doc: "https://docs.acme.dev",
    models: {
      g1: {
        id: "g1",
        name: "G1",
        attachment: true,
        reasoning: true,
        tool_call: true,
        structured_output: true,
        temperature: false,
        knowledge: "2025-06",
        release_date: "2026-01-01",
        last_updated: "2026-01-01",
        modalities: { input: ["text", "image"], output: ["text"] },
        open_weights: true,
        limit: { context: 100000, output: 8000 },
        cost: { input: 1, output: 2, cache_read: 0.1 },
      },
    },
  },
  mirror: {
    id: "mirror",
    name: "Mirror",
    models: {
      "acme/g1": {
        id: "acme/g1",
        name: "G1",
        tool_call: true,
        release_date: "2026-01-01",
        last_updated: "2026-01-01",
        modalities: { input: ["text"], output: ["text"] },
        limit: { context: 64000 },
        cost: { input: 0.8, output: 1.6 },
      },
    },
  },
};

describe("normalizeModels", () => {
  it("indexes canonical ids and maps fields", () => {
    const { models, index } = normalizeModels(MODELS_RAW);
    expect(index.has("acme/g1")).toBe(true);
    const m = models[0];
    expect(m.id).toBe("acme/g1");
    expect(m.labId).toBe("acme");
    expect(m.openWeights).toBe(true);
    expect(m.weights[0]?.url).toBe("https://huggingface.co/acme/g1");
    expect(m.benchmarks[0]?.score).toBe(50);
  });
});

describe("normalizeApi", () => {
  it("resolves canonical ids across providers", () => {
    const { index } = normalizeModels(MODELS_RAW);
    const { listings } = normalizeApi(API_RAW, index);
    const direct = listings.find((l) => l.providerId === "acme");
    const mirrored = listings.find((l) => l.providerId === "mirror");
    expect(direct?.canonicalId).toBe("acme/g1");
    expect(mirrored?.canonicalId).toBe("acme/g1");
    expect(direct?.cost.input).toBe(1);
    expect(direct?.modalities.input).toContain("image");
  });

  it("flags unlisted prices only when both are zero", () => {
    const { index } = normalizeModels(MODELS_RAW);
    const listing = toListing("x", "X", "g1", { cost: { input: 0, output: 0 } }, index);
    expect(unlistedPrice(listing.cost)).toBe(true);
    const partial = toListing("x", "X", "g1", { cost: { input: 0, output: 5 } }, index);
    expect(unlistedPrice(partial.cost)).toBe(false);
  });

  it("suppresses only exact extreme claims rejected by the review registry", () => {
    const rejected = toListing(
      "qiniu-ai",
      "Qiniu",
      "kling-v2-6",
      { limit: { context: 99_999_999, output: 99_999_999 } },
      new Set(),
    );
    expect(rejected.limit).toEqual({ context: null, input: null, output: null });

    const changed = toListing(
      "qiniu-ai",
      "Qiniu",
      "kling-v2-6",
      { limit: { context: 100_000_000, output: 99_999_999 } },
      new Set(),
    );
    expect(changed.limit.context).toBe(100_000_000);
  });
});

describe("diffListings", () => {
  const { index } = normalizeModels(MODELS_RAW);
  const base = normalizeApi(API_RAW, index);

  type FixtureProvider = { id: string; name: string; models: Record<string, Record<string, unknown>> };
  type FixtureApi = Record<string, FixtureProvider>;
  const clone = () => structuredClone(API_RAW) as unknown as FixtureApi;

  it("emits provider_added only for brand-new providers; new listings on known providers are model_added", () => {
    const nextRaw = clone();
    // brand-new provider "other"
    nextRaw.other = {
      id: "other",
      name: "Other",
      models: {
        "acme/g1": {
          id: "acme/g1",
          name: "G1",
          release_date: "2026-01-01",
          modalities: { input: ["text"], output: ["text"] },
          limit: {},
        },
      },
    };
    // brand-new model on the EXISTING acme provider
    nextRaw.acme.models.g2 = {
      id: "g2",
      name: "G2",
      release_date: "2026-08-20",
      modalities: { input: ["text"], output: ["text"] },
      limit: {},
    } as Record<string, unknown>;
    const next = normalizeApi(nextRaw, index);
    const events = diffListings(base.listings, next.listings, "2026-08-21");
    const pa = events.find((e) => e.type === "provider_added");
    expect(pa?.modelKey).toBe("other/acme/g1");
    const ma = events.find((e) => e.type === "model_added");
    expect(ma?.modelKey).toBe("acme/g2");
  });

  it("classifies repriced events with field-level changes", () => {
    const nextRaw = clone();
    (nextRaw.acme.models.g1 as Record<string, unknown>).cost = { input: 0.5, output: 2, cache_read: 0.1 };
    const next = normalizeApi(nextRaw, index);
    const events = diffListings(base.listings, next.listings, "2026-08-21");
    const ev = events.find((e) => e.type === "repriced");
    expect(ev).toBeDefined();
    const field = ev!.changes.find((c) => c.field === "cost.input");
    expect(field).toEqual({ field: "cost.input", old: 1, new: 0.5 });
  });

  it("prioritizes deprecation over other changes", () => {
    const nextRaw = clone();
    const g1 = nextRaw.acme.models.g1 as Record<string, unknown>;
    g1.status = "deprecated";
    g1.cost = { input: 9, output: 9 };
    const next = normalizeApi(nextRaw, index);
    const events = diffListings(base.listings, next.listings, "2026-08-21");
    expect(events.find((e) => e.modelKey === "acme/g1")?.type).toBe("deprecated");
  });

  it("detects removals and context changes", () => {
    const nextRaw = { acme: { ...API_RAW.acme, models: {} } };
    const next = normalizeApi(nextRaw, index);
    const events = diffListings(base.listings, next.listings, "2026-08-21");
    expect(events.find((e) => e.type === "model_removed")).toBeDefined();

    const ctxRaw = clone();
    ((ctxRaw.acme.models.g1 as Record<string, unknown>).limit as Record<string, unknown>).context = 200000;
    const ctxNext = normalizeApi(ctxRaw, index);
    const ctxEvents = diffListings(base.listings, ctxNext.listings, "2026-08-21");
    expect(ctxEvents.find((e) => e.type === "context_changed")).toBeDefined();
  });

  it("classify prefers deprecated > repriced > context > capability", () => {
    expect(classify([{ field: "status", old: null, new: "deprecated" }])).toBe("deprecated");
    expect(classify([{ field: "cost.input", old: 1, new: 2 }])).toBe("repriced");
    expect(classify([{ field: "limit.context", old: 1, new: 2 }])).toBe("context_changed");
    expect(classify([{ field: "reasoning", old: true, new: false }])).toBe("capability_changed");
  });

  it("diffFields compares missing vs null as equal", () => {
    expect(diffFields({ a: undefined }, { a: null })).toHaveLength(0);
    expect(diffFields({ a: 1 }, { a: 2 })).toHaveLength(1);
  });
});
