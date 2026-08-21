import { describe, expect, it } from "vitest";
import { priceBuckets } from "./stats";
import type { ModelGroup } from "./index";

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

describe("priceBuckets", () => {
  it("buckets by blended price", () => {
    const groups = [
      g({ id: "a", best: { input: 0.2, output: 0.2, cacheRead: null, providerId: "p", providerName: "P", listingKey: "k" } }), // blend 0.2 → <$0.25
      g({ id: "b", best: { input: 1, output: 1, cacheRead: null, providerId: "p", providerName: "P", listingKey: "k" } }), // blend 1 → $1–$3
      g({ id: "c", best: { input: 40, output: 40, cacheRead: null, providerId: "p", providerName: "P", listingKey: "k" } }), // ≥$30
    ];
    const b = priceBuckets(groups);
    expect(b.find((x) => x.label === "< $0.25")?.count).toBe(1);
    expect(b.find((x) => x.label === "$1 – $3")?.count).toBe(1);
    expect(b.find((x) => x.label === "≥ $30")?.count).toBe(1);
    expect(b.find((x) => x.label === "$0")?.count).toBe(0);
  });

  it("counts all-free groups in the $0 bucket instead of dropping them", () => {
    const groups = [
      g({ id: "free1", free: true, best: null }),
      g({ id: "free2", free: true, best: null }),
      g({ id: "paid", best: { input: 3, output: 6, cacheRead: null, providerId: "p", providerName: "P", listingKey: "k" }, free: true }), // has paid tier → priced normally
      g({ id: "unlisted", free: false, best: null }),
    ];
    const b = priceBuckets(groups);
    expect(b.find((x) => x.label === "$0")?.count).toBe(2);
    expect(b.find((x) => x.label === "$3 – $10")?.count).toBe(1);
    const total = b.reduce((n, x) => n + x.count, 0);
    expect(total).toBe(3); // unlisted group stays out
  });
});
