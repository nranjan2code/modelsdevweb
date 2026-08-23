/**
 * Which models can be compared on a dollars-per-million-tokens basis at all.
 *
 * `$/M` only means the same thing across two listings when both are billing text
 * tokens. Whisper's `input` is a million *audio* tokens; an image model's
 * `output` is sometimes a per-image charge folded into the token field by one
 * provider and left as real tokens by another. Both slipped into the first cut
 * of this work: Whisper became "the cheapest budget model on the site", and
 * Nano Banana 2 showed a 95% gateway discount that was a unit mismatch, not a
 * price. Neither number was wrong arithmetically — they measured something else.
 *
 * So every cross-model and cross-venue price comparison is gated on this. It is
 * deliberately conservative: a model whose modalities we cannot read is excluded
 * rather than assumed comparable.
 */

import type { ModelGroup } from "../data/index";

/**
 * Text in, text out, and nothing but text coming out.
 *
 * Multimodal *input* is fine and deliberately so: Gemini 2.5 Flash accepts
 * audio and video, but a text request to it is billed in text tokens like any
 * other. Gating on input modality excluded 64 of 346 tracked models — Gemini
 * Flash and Qwen3.5 among them — which is far worse than the mis-comparison it
 * was trying to prevent.
 *
 * What actually breaks the unit is the *output* side: Whisper takes audio and
 * has no text input to price, and an image generator's output charge is a
 * picture, not a token. Those are the cases to exclude.
 */
export function isTokenComparable(g: ModelGroup): boolean {
  const canonical = g.canonical?.modalities;
  const input = canonical?.input ?? [];
  const output = canonical?.output ?? [];
  if (input.length > 0 || output.length > 0) {
    return comparable(input, output);
  }
  // No canonical modality record — fall back to the listings' own declaration.
  return g.listings.some((l) => comparable(l.modalities.input, l.modalities.output));
}

function comparable(input: string[], output: string[]): boolean {
  if (!input.includes("text") || !output.includes("text")) return false;
  // Anything non-text on the output side means the bill is not a text token.
  return !output.some((m) => m === "audio" || m === "image" || m === "video");
}
