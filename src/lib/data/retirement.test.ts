import { describe, expect, it } from "vitest";
import type { Listing, ModelStatus } from "../pipeline/types";
import type { ModelGroup } from "./index";
import {
  activeGroups,
  labRetirement,
  providerRetirement,
  retiredGroups,
  retirementOf,
} from "./retirement";

const listing = (providerId: string, status: ModelStatus | null, modelId = "m"): Listing => ({
  key: `${providerId}/${modelId}`,
  providerId,
  providerName: providerId,
  modelId,
  canonicalId: "lab/m",
  name: "M",
  family: null,
  description: null,
  status,
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
  limit: { context: 100_000, output: null, input: null },
  cost: {
    input: 1, output: 2, cacheRead: null, cacheWrite: null,
    reasoning: null, inputAudio: null, outputAudio: null, tiers: [],
  },
});

const group = (listings: Listing[], id = "lab/m"): ModelGroup => ({
  id,
  labId: "lab",
  labKnown: true,
  name: "M",
  canonical: null,
  listings,
  best: null,
  free: false,
  deprecatedCount: listings.filter((l) => l.status === "deprecated").length,
});

describe("retirementOf", () => {
  it("calls a model retired only when no provider still serves it", () => {
    const r = retirementOf(group([listing("a", "deprecated"), listing("b", "deprecated")]));
    expect(r.retiredEverywhere).toBe(true);
    expect(r.liveProviders).toBe(0);
  });

  it("keeps a model alive when one venue still sells it", () => {
    const r = retirementOf(group([listing("lab", null), listing("gateway", "deprecated")]));
    expect(r.retiredEverywhere).toBe(false);
    expect(r.partiallyRetired).toBe(true);
    expect(r.retiredProviders).toEqual(["gateway"]);
    expect(r.liveProviders).toBe(1);
  });

  it("does not call a provider retired when it dropped one variant but kept another", () => {
    // The real shape: an endpoint alias sunsets while the main one stays.
    const r = retirementOf(
      group([listing("azure", null, "m"), listing("azure", "deprecated", "m-preview")]),
    );
    expect(r.retiredProviders).toEqual([]);
    expect(r.partiallyRetired).toBe(false);
    expect(r.liveProviders).toBe(1);
  });

  it("counts providers, not endpoint variants", () => {
    const r = retirementOf(group([listing("azure", null, "a"), listing("azure", null, "b")]));
    expect(r.liveProviders).toBe(1);
  });

  it("treats an empty catalog entry as neither live nor retired", () => {
    const r = retirementOf(group([]));
    expect(r.retiredEverywhere).toBe(false);
    expect(r.partiallyRetired).toBe(false);
  });
});

describe("lab aggregates", () => {
  const groups = [
    group([listing("lab", null)], "lab/live"),
    group([listing("lab", null), listing("gw", "deprecated")], "lab/partial"),
    group([listing("lab", "deprecated")], "lab/dead"),
  ];

  it("excludes fully retired models from what a lab currently offers", () => {
    expect(labRetirement(groups)).toEqual({ active: 2, retired: 1, partial: 1 });
    expect(activeGroups(groups).map((g) => g.id)).toEqual(["lab/live", "lab/partial"]);
    expect(retiredGroups(groups).map((g) => g.id)).toEqual(["lab/dead"]);
  });
});

describe("providerRetirement", () => {
  it("separates what a venue still sells from what it dropped", () => {
    const live = listing("gw", null, "a");
    const dead = listing("gw", "deprecated", "b");
    const stillElsewhere = group([listing("lab", null, "b"), dead], "lab/b");
    const r = providerRetirement([live, dead], (l) => (l.modelId === "b" ? stillElsewhere : undefined));
    expect(r.live).toEqual([live]);
    expect(r.retired).toEqual([dead]);
    // Dropped here but buyable elsewhere — a migration, not a tombstone.
    expect(r.droppedButAvailable).toBe(1);
  });

  it("does not count a dropped model as available when it is gone everywhere", () => {
    const dead = listing("gw", "deprecated", "b");
    const r = providerRetirement([dead], () => group([dead], "lab/b"));
    expect(r.droppedButAvailable).toBe(0);
  });
});
