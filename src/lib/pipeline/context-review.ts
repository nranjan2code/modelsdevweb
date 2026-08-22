import type { Limits } from "./types";

export const CONTEXT_REVIEW_THRESHOLD = 10_000_000;

export interface ContextReview {
  /** The exact upstream value reviewed. A changed claim must be reviewed again. */
  claimedContext: number;
  decision: "verified" | "reject";
  sourceUrl: string;
  note: string;
}

/**
 * Narrow, evidence-backed decisions for extreme upstream context claims.
 * Never add a family/prefix rule here: every provider/model claim is reviewed
 * independently, and any changed number returns to the hard gate.
 */
export const CONTEXT_REVIEWS: Readonly<Record<string, ContextReview>> = {
  "alibaba-cn/qwen-long": {
    claimedContext: 10_000_000,
    decision: "verified",
    sourceUrl: "https://www.alibabacloud.com/help/en/model-studio/long-context-qwen-long",
    note: "Alibaba documents Qwen Long file inputs up to 10 million tokens.",
  },
  "nano-gpt/qwen-long": {
    claimedContext: 10_000_000,
    decision: "verified",
    sourceUrl: "https://nano-gpt.com/api/v1/models?detailed=true",
    note: "NanoGPT's authoritative detailed catalog publishes a 10 million token route.",
  },
  "nano-gpt/pokee-isaac": {
    claimedContext: 10_000_000,
    decision: "verified",
    sourceUrl: "https://console.pokee.ai/model",
    note: "Pokee's model page publishes and evaluates a 10 million token window.",
  },
  "qiniu-ai/kling-v2-6": {
    claimedContext: 99_999_999,
    decision: "reject",
    sourceUrl: "https://developer.qiniu.com/aitokenapi/13388/new-video-generate-kling-api",
    note: "Kling is a video-generation API; token context/output limits are inapplicable sentinel values.",
  },
  "qiniu-ai/x-ai/grok-4.1-fast-reasoning": {
    claimedContext: 20_000_000,
    decision: "reject",
    sourceUrl: "https://docs.x.ai/developers/migration/may-15-retirement",
    note: "xAI documents this retired slug's replacement at 1 million tokens, not 20 million.",
  },
};

export function contextReview(providerId: string, modelId: string): ContextReview | null {
  return CONTEXT_REVIEWS[`${providerId}/${modelId}`] ?? null;
}

/** Reject only an exact reviewed claim; changed upstream values remain visible to the gate. */
export function reviewedLimits(providerId: string, modelId: string, limits: Limits): Limits {
  const review = contextReview(providerId, modelId);
  if (review?.decision !== "reject" || limits.context !== review.claimedContext) return limits;
  return { context: null, input: null, output: null };
}
