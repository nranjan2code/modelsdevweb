import { describe, expect, it } from "vitest";
import { pruneExternalSignals, sanitizeNewsLinks } from "./enrichment-hygiene";
import type { ExternalSignal } from "./external-types";
import type { NewsItem } from "./types";

const signal = (modelId: string): ExternalSignal => ({
  source: "github",
  signalType: "stars",
  modelId,
  value: 1,
  metadata: {},
  fetchedAt: "2026-08-22T00:00:00Z",
  license: "repo-specific",
  attributionUrl: "https://github.com/example/repo",
});

const news = (modelIds: string[], labIds: string[]): NewsItem => ({
  id: "n1",
  title: "A model changed",
  url: "https://example.com/story",
  source: "example.com",
  favicon: null,
  publishedAt: "2026-08-22T00:00:00Z",
  score: 50,
  snippet: "News",
  modelIds,
  labIds,
});

describe("enrichment hygiene", () => {
  it("purges retained signals for removed catalog groups", () => {
    const result = pruneExternalSignals(
      [signal("openai/live"), signal("openai/removed")],
      new Set(["openai/live"]),
    );
    expect(result.signals.map((item) => item.modelId)).toEqual(["openai/live"]);
    expect(result.removed).toBe(1);
  });

  it("removes dead news tags and rebuilds lab tags from current groups", () => {
    const result = sanitizeNewsLinks(
      [news(["openai/live", "moonshotai/removed"], ["old-lab", "moonshotai"])],
      new Map([["openai/live", "openai"]]),
    );
    expect(result.items[0].modelIds).toEqual(["openai/live"]);
    expect(result.items[0].labIds).toEqual(["openai"]);
    expect(result.removed).toBe(1);
  });
});
