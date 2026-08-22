import { describe, expect, it } from "vitest";
import { relevanceScore } from "./news";

const NOW = Date.parse("2026-08-22T12:00:00Z");
const hoursAgo = (h: number) => new Date(NOW - h * 3_600_000).toISOString();

function base(over: Partial<Parameters<typeof relevanceScore>[0]> = {}): Parameters<typeof relevanceScore>[0] {
  return {
    title: "OpenAI cuts API prices for GPT-5",
    snippet: "The company lowered per-million token pricing across its lineup.",
    source: "techcrunch.com",
    publishedAt: hoursAgo(2),
    modelIds: ["openai/gpt-5"],
    ...over,
  };
}

describe("relevanceScore", () => {
  it("known outlet + fresh + priced + tagged ranks highest", () => {
    const s = relevanceScore(base(), NOW);
    expect(s).toBeGreaterThanOrEqual(90);
  });

  it("stale articles sink regardless of source", () => {
    const fresh = relevanceScore(base(), NOW);
    const stale = relevanceScore(base({ publishedAt: hoursAgo(24 * 6) }), NOW);
    expect(stale).toBeLessThan(fresh);
  });

  it("unknown blogs score well below editorial outlets", () => {
    const known = relevanceScore(base(), NOW);
    const blog = relevanceScore(base({ source: "random-tech-blog.xyz" }), NOW);
    expect(blog).toBeLessThan(known);
  });

  it("off-vertical titles lose the keyword weight", () => {
    const onTopic = relevanceScore(base(), NOW);
    const offTopic = relevanceScore(
      base({ title: "Celebrity invests in startup", snippet: "Funding round details inside." }),
      NOW,
    );
    expect(offTopic).toBeLessThan(onTopic);
  });

  it("untagged items lose the model-linkage weight", () => {
    const tagged = relevanceScore(base(), NOW);
    const untagged = relevanceScore(base({ modelIds: [] }), NOW);
    expect(untagged).toBeLessThan(tagged);
  });

  it("deprecation stories match verticals", () => {
    const s = relevanceScore(
      base({ title: "Provider announces model sunset and deprecation date", snippet: "Retirement timeline." }),
      NOW,
    );
    expect(s).toBeGreaterThan(50);
  });
});
