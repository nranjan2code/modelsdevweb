import { describe, expect, it } from "vitest";
import {
  fmtTokenCount,
  hostingCase,
  hostingFloor,
  memoryRequiredGb,
} from "./selfhost";
import type { ModelGroup } from "./index";
import type { WeightsFacts } from "./weights";
import { DEFAULT_WORKLOAD, flatCost, ratePerMillion } from "../economics/workload";

const group = (over: Partial<ModelGroup> = {}): ModelGroup => ({
  id: "lab/m", labId: "lab", labKnown: true, name: "M", canonical: null,
  listings: [], best: { input: 0.2, output: 0.6, cacheRead: null, cost: flatCost(0.2, 0.6), providerId: "p", providerName: "P", listingKey: "p/m" },
  free: false, deprecatedCount: 0, ...over,
});

const facts = (over: Partial<WeightsFacts> = {}): WeightsFacts => ({
  groupId: "lab/m", repoId: "lab/m", licence: "apache-2.0", licenceClass: "permissive",
  access: "open", parameters: 8e9, baseModel: null, languages: [],
  cardUrl: "https://huggingface.co/lab/m", fetchedAt: "2026-08-22T00:00:00Z", ...over,
});

describe("memoryRequiredGb", () => {
  it("sizes bf16 weights plus serving overhead", () => {
    expect(Math.round(memoryRequiredGb(8e9))).toBe(20);
    expect(Math.round(memoryRequiredGb(70e9))).toBe(175);
  });
});

describe("hostingFloor", () => {
  it("picks the cheapest configuration that actually fits", () => {
    const f = hostingFloor(8e9)!;
    expect(f.gpus).toBe(1);
    expect(f.vramGb).toBeGreaterThanOrEqual(memoryRequiredGb(8e9));
  });

  it("scales to multiple GPUs when one will not hold the weights", () => {
    const f = hostingFloor(70e9)!;
    expect(f.gpus).toBeGreaterThan(1);
    expect(f.vramGb).toBeGreaterThanOrEqual(memoryRequiredGb(70e9));
  });

  it("refuses models too large for a single node rather than inventing a cluster", () => {
    expect(hostingFloor(685e9)).toBeNull();
  });
});

describe("hostingCase", () => {
  it("calls a non-commercial model API-only regardless of its size", () => {
    const c = hostingCase(group(), facts({ licenceClass: "non-commercial", licence: "cc-by-nc-4.0" }));
    expect(c.verdict).toBe("api-only");
    expect(c.breakEvenTokens).toBeNull();
  });

  it("break-even equals the GPU rent divided by the API rate", () => {
    const c = hostingCase(group(), facts());
    expect(c.verdict).toBe("breakeven");
    // Priced under the default chat workload rather than a fixed 3:1 blend, so
    // the cache-write line and the 1500:500 token mix both move the figure.
    const rate = ratePerMillion(flatCost(0.2, 0.6), DEFAULT_WORKLOAD);
    expect(c.apiBlendedPerM).toBeCloseTo(rate, 6);
    expect(c.breakEvenTokens).toBeCloseTo((c.floor!.usdPerMonth * 1e6) / rate, 0);
  });

  it("says unknown rather than guessing when facts are missing", () => {
    expect(hostingCase(group(), undefined).verdict).toBe("unknown");
    expect(hostingCase(group(), facts({ parameters: null })).verdict).toBe("unknown");
    expect(hostingCase(group({ best: null }), facts()).verdict).toBe("unknown");
  });

  it("flags a model too big for one node instead of pricing a fantasy", () => {
    expect(hostingCase(group(), facts({ parameters: 685e9 })).verdict).toBe("needs-cluster");
  });
});

describe("fmtTokenCount", () => {
  it("uses the unit people quote", () => {
    expect(fmtTokenCount(845_000_000)).toBe("845M");
    expect(fmtTokenCount(7_200_000_000)).toBe("7.2B");
    expect(fmtTokenCount(null)).toBeNull();
  });
});
