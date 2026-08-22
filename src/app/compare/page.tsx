import type { Metadata } from "next";
import { getCatalog } from "@/lib/data";
import type { Modality } from "@/lib/pipeline/types";
import { CompareBoard, type CompareModel } from "@/components/compare-board";

export const metadata: Metadata = {
  title: "Compare models",
  description: "Compare two to four AI models side by side: prices, context windows, capabilities and benchmark scores.",
  alternates: { canonical: "/compare" },
};

export default async function ComparePage() {
  const catalog = await getCatalog();
  const models: CompareModel[] = catalog.groups.map((g) => {
    const c = g.canonical;
    const live = g.listings.filter((l) => l.status !== "deprecated");
    const hasMod = (dir: "input" | "output", mod: Modality): boolean =>
      (c?.modalities?.[dir].includes(mod) ?? false) || g.listings.some((l) => l.modalities[dir].includes(mod));
    const cap = (
      canonicalVal: boolean | null | undefined,
      listingPick: (l: (typeof g.listings)[number]) => boolean | null,
    ): boolean => canonicalVal ?? g.listings.some((l) => listingPick(l) === true);
    const benchmarks: Record<string, number> = {};
    for (const b of c?.benchmarks ?? []) benchmarks[b.name] = b.score;
    return {
      id: g.id,
      name: g.name,
      lab: g.labId,
      input: g.best?.input ?? null,
      output: g.best?.output ?? null,
      cacheRead: g.best?.cacheRead ?? null,
      ctx: c?.limit?.context ?? live.reduce<number | null>((acc, l) => (l.limit.context != null && (acc == null || l.limit.context > acc) ? l.limit.context : acc), null),
      maxOut: c?.limit?.output ?? live.reduce<number | null>((acc, l) => (l.limit.output != null && (acc == null || l.limit.output > acc) ? l.limit.output : acc), null),
      reasoning: cap(c?.reasoning, (l) => l.reasoning),
      tools: cap(c?.toolCall, (l) => l.toolCall),
      structured: cap(c?.structuredOutput, (l) => l.structuredOutput),
      vision: cap(c?.attachment, (l) => l.attachment),
      audioIn: hasMod("input", "audio"),
      open: c?.openWeights ?? null,
      released: c?.releaseDate ?? null,
      knowledge: c?.knowledge ?? null,
      providers: live.length,
      deprecated: g.deprecatedCount,
      benchmarks,
    };
  });

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <p className="mono-label">Head to head</p>
        <h1 className="text-3xl font-bold tracking-tight text-black sm:text-4xl">Compare models</h1>
        <p className="max-w-2xl text-sm leading-relaxed text-black/60">
          Put two to four models side by side — prices, limits, capabilities and benchmark scores. Green marks
          the winner on each priced or sized row.
        </p>
      </header>
      <CompareBoard models={models} />
    </div>
  );
}
