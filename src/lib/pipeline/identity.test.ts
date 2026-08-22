import { describe, expect, it } from "vitest";
import { buildIdentityIndex, cleanModelName, identityCandidates, isGenericModelId } from "./identity";

interface Model {
  id: string;
  name: string;
}
const index = (models: Model[]) => buildIdentityIndex(models, (m) => ({ id: m.id, name: m.name }));

describe("cleanModelName", () => {
  it("strips deployment and promo parentheticals", () => {
    expect(cleanModelName("GPT-5.6 Sol (Azure)")).toBe("GPT-5.6 Sol");
    expect(cleanModelName("GPT-5.6 Sol (50% off)")).toBe("GPT-5.6 Sol");
    expect(cleanModelName("Claude Haiku 4.5 (latest)")).toBe("Claude Haiku 4.5");
  });

  it("strips a vendor label prefix", () => {
    expect(cleanModelName("OpenAI: GPT-5.6 Sol")).toBe("GPT-5.6 Sol");
    expect(cleanModelName("OpenAI GPT-5.6 Sol")).toBe("GPT-5.6 Sol");
  });

  it("keeps a vendor word that is part of the model name", () => {
    expect(cleanModelName("Qwen Flash")).toBe("Qwen Flash");
    expect(cleanModelName("DeepSeek V4")).toBe("DeepSeek V4");
  });
});

describe("identityCandidates", () => {
  it("offers the id tail for dotted and slashed ids", () => {
    expect(identityCandidates("GPT-5.6 Sol", "global.openai.gpt-5.6-sol")).toContain("gpt56sol");
    expect(identityCandidates("GPT-5.6 Sol", "openai/gpt-5.6-sol")).toContain("gpt56sol");
  });

  it("ignores region suffixes", () => {
    expect(identityCandidates("GPT-5.6 Sol", "gpt-5.6-sol@eu")).toContain("gpt56sol");
  });
});

describe("buildIdentityIndex", () => {
  const canonical = [
    { id: "openai/gpt-5.6-sol", name: "GPT-5.6 Sol" },
    { id: "openai/gpt-5.6-sol-pro", name: "GPT-5.6 Sol Pro" },
  ];

  it("resolves every provider spelling of one model to one canonical", () => {
    const idx = index(canonical);
    for (const [name, id] of [
      ["GPT-5.6 Sol", "databricks-gpt-5-6-sol"],
      ["GPT-5.6 Sol (Azure)", "azure/gpt-5.6-sol"],
      ["OpenAI: GPT-5.6 Sol (50% off)", "openai/gpt-5.6-sol-discounted"],
      ["GPT-5.6 Sol (EU)", "gpt-5.6-sol@eu"],
      ["OpenAI GPT-5.6 Sol", "openai-gpt-5.6-sol"],
    ] as const) {
      expect(idx.resolve(name, id).target?.id, `${name} / ${id}`).toBe("openai/gpt-5.6-sol");
    }
  });

  it("never collapses a distinct variant into its base model", () => {
    const idx = index(canonical);
    expect(idx.resolve("GPT-5.6 Sol Pro", "openai-gpt-56-sol-pro").target?.id).toBe(
      "openai/gpt-5.6-sol-pro",
    );
  });

  it("treats a dated pin and its stable alias as one model", () => {
    const idx = index([
      { id: "anthropic/claude-haiku-4-5", name: "Claude Haiku 4.5 (latest)" },
      { id: "anthropic/claude-haiku-4-5-20251001", name: "Claude Haiku 4.5" },
    ]);
    expect(idx.resolve("Claude Haiku 4.5", "claude-haiku-4-5").target?.id).toBe(
      "anthropic/claude-haiku-4-5",
    );
  });

  it("refuses to guess when two unrelated models share a slug", () => {
    const idx = index([
      { id: "labA/nova", name: "Nova" },
      { id: "labB/nova", name: "Nova" },
    ]);
    expect(idx.resolve("Nova", "nova").target).toBeNull();
  });

  it("does not index generic router aliases", () => {
    const idx = index([{ id: "someprovider/auto", name: "Auto" }]);
    expect(idx.resolve("Auto", "auto").target).toBeNull();
  });
});

describe("isGenericModelId", () => {
  it("flags router placeholders", () => {
    expect(isGenericModelId("Auto", "morph/auto")).toBe(true);
    expect(isGenericModelId("Default", "x/default")).toBe(true);
  });

  it("leaves real models alone", () => {
    expect(isGenericModelId("GPT-5.6 Sol", "openai/gpt-5.6-sol")).toBe(false);
  });
});
