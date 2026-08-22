import { describe, expect, it } from "vitest";
import { resolveExternalIds, computeSimilarity } from "./external-resolver";
import type { ModelGroup } from "../data";

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

const groups = [
  g({ id: "meta-llama/llama-3.1-8b-instruct", name: "Llama 3.1 8B Instruct" }),
  g({ id: "qwen/qwen-2.5-72b-instruct", name: "Qwen 2.5 72B Instruct" }),
];

describe("resolveExternalIds", () => {
  it("manual override wins and claims the group once", () => {
    const m = resolveExternalIds(
      "github",
      [
        { id: "meta-llama/llama3" },
        { id: "meta-llama/llama3-duplicate" },
      ],
      groups,
    );
    const llamaMappings = m.filter((x) => x.groupId === "meta-llama/llama-3.1-8b-instruct");
    expect(llamaMappings).toHaveLength(1);
    expect(llamaMappings[0].method).toBe("manual");
    expect(llamaMappings[0].confidence).toBe(1);
  });

  it("exact id match resolves with confidence 1", () => {
    const m = resolveExternalIds("hf", [{ id: "qwen/qwen-2.5-72b-instruct", name: "Qwen2.5-72B-Instruct" }], groups);
    expect(m[0].groupId).toBe("qwen/qwen-2.5-72b-instruct");
    expect(m[0].confidence).toBe(1);
    expect(m[0].method).toBe("exact");
  });

  it("fuzzy name matching requires ≥0.75 similarity", () => {
    const m = resolveExternalIds("hf", [{ id: "unknown-org/Qwen2.5-72B-Instruct-AWQ", name: "Qwen2.5-72B-Instruct-AWQ" }], groups);
    if (m.length > 0) {
      expect(m[0].confidence).toBeGreaterThanOrEqual(0.75);
    }
  });

  it("never maps two external items onto one group", () => {
    const m = resolveExternalIds(
      "hf",
      [
        { id: "a/Llama-3.1-8B-Instruct", name: "Llama 3.1 8B Instruct" },
        { id: "b/Llama-3.1-8B-Instruct-GGUF", name: "Llama 3.1 8B Instruct GGUF" },
      ],
      groups,
    );
    const ids = m.map((x) => x.groupId);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("computeSimilarity", () => {
  it("identical names score 1", () => {
    expect(computeSimilarity("Llama 3.1 8B", "llama-3-1-8b")).toBe(1);
  });
  it("substring containment scores high", () => {
    expect(computeSimilarity("Qwen2.5-72B-Instruct", "Qwen2.5-72B-Instruct-AWQ")).toBe(0.85);
  });
});
