import { blendPrice, type ModelGroup } from "./index";

export interface CapabilityStat {
  label: string;
  count: number;
  pct: number;
}

const CAP_TESTS: { label: string; test: (g: ModelGroup) => boolean }[] = [
  { label: "reasoning", test: (g) => g.canonical?.reasoning ?? g.listings.some((l) => l.reasoning) },
  { label: "tool call", test: (g) => g.canonical?.toolCall ?? g.listings.some((l) => l.toolCall) },
  {
    label: "structured output",
    test: (g) => g.canonical?.structuredOutput ?? g.listings.some((l) => l.structuredOutput === true),
  },
  {
    label: "vision / attachments",
    test: (g) => g.canonical?.attachment ?? g.listings.some((l) => l.attachment),
  },
  {
    label: "audio input",
    test: (g) =>
      (g.canonical?.modalities?.input.includes("audio") ?? false) ||
      g.listings.some((l) => l.modalities.input.includes("audio")),
  },
  { label: "open weights", test: (g) => g.canonical?.openWeights === true },
];

export function capabilityAdoption(groups: ModelGroup[]): CapabilityStat[] {
  const n = groups.length || 1;
  return CAP_TESTS.map(({ label, test }) => {
    const count = groups.filter(test).length;
    return { label, count, pct: count / n };
  });
}

export interface PriceBucket {
  label: string;
  count: number;
}

const BUCKETS: { label: string; test: (b: number) => boolean }[] = [
  { label: "$0", test: (b) => b === 0 },
  { label: "< $0.25", test: (b) => b > 0 && b < 0.25 },
  { label: "$0.25 – $1", test: (b) => b >= 0.25 && b < 1 },
  { label: "$1 – $3", test: (b) => b >= 1 && b < 3 },
  { label: "$3 – $10", test: (b) => b >= 3 && b < 10 },
  { label: "$10 – $30", test: (b) => b >= 10 && b < 30 },
  { label: "≥ $30", test: (b) => b >= 30 },
];

/** Distribution of blended input/output price across priced model groups. */
export function priceBuckets(groups: ModelGroup[]): PriceBucket[] {
  const priced = groups.filter((g) => g.best != null);
  return BUCKETS.map(({ label, test }) => ({
    label,
    count: priced.filter((g) => test(blendPrice(g.best!.input, g.best!.output))).length,
  }));
}
