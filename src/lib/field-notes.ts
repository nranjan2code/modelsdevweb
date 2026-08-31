export type FieldNote = {
  slug: string;
  eyebrow: string;
  title: string;
  summary: string;
  status: "published" | "planned";
};

export const FIELD_NOTES: FieldNote[] = [
  {
    slug: "api-key-introspection",
    eyebrow: "Field note 01 · published",
    title: "What an API key can actually tell you",
    summary:
      "A practical map of authentication, balances, quotas, response headers, free tiers and the capacity numbers providers do not publish.",
    status: "published",
  },
  {
    slug: "why-429-is-not-one-thing",
    eyebrow: "Field note 02 · published",
    title: "Why a 429 is not one thing",
    summary: "Separating request limits, token limits, spend caps, acceleration limits and overloaded providers.",
    status: "published",
  },
  {
    slug: "same-model-different-route",
    eyebrow: "Field note 03 · published",
    title: "The same model is not the same route",
    summary: "How gateways, first-party APIs, BYOK and fallback providers change the thing you are buying.",
    status: "published",
  },
];
