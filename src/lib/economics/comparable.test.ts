import { describe, expect, it } from "vitest";
import type { ModelGroup } from "../data/index";
import { isTokenComparable } from "./comparable";

const g = (input: string[], output: string[], useCanonical = true): ModelGroup =>
  ({
    id: "lab/m", labId: "lab", labKnown: true, name: "M",
    canonical: useCanonical
      ? ({ modalities: { input, output } } as ModelGroup["canonical"])
      : null,
    listings: useCanonical
      ? []
      : ([{ modalities: { input, output } }] as unknown as ModelGroup["listings"]),
    best: null, free: false, deprecatedCount: 0,
  }) as ModelGroup;

describe("isTokenComparable", () => {
  it("accepts a plain text model", () => {
    expect(isTokenComparable(g(["text"], ["text"]))).toBe(true);
  });

  it("accepts a multimodal-input model that answers in text", () => {
    // Gemini Flash takes audio and video; a text request still bills text
    // tokens. Excluding these dropped 64 of 346 tracked models.
    expect(isTokenComparable(g(["text", "image", "audio", "video"], ["text"]))).toBe(true);
  });

  it("rejects a transcription model with no text input to price", () => {
    expect(isTokenComparable(g(["audio"], ["text"]))).toBe(false);
  });

  it("rejects an image generator, whose output charge is a picture", () => {
    expect(isTokenComparable(g(["text"], ["image"]))).toBe(false);
    expect(isTokenComparable(g(["text"], ["text", "image"]))).toBe(false);
  });

  it("rejects speech output", () => {
    expect(isTokenComparable(g(["text"], ["audio"]))).toBe(false);
  });

  it("falls back to the listings when there is no canonical record", () => {
    expect(isTokenComparable(g(["text"], ["text"], false))).toBe(true);
    expect(isTokenComparable(g(["text"], ["image"], false))).toBe(false);
  });
});
