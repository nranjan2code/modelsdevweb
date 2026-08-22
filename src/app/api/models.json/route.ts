import {
  getCatalog,
  groupContext,
  groupReleaseDate,
  lowestInputListing,
  lowestOutputListing,
  providerCount,
} from "@/lib/data";

export const dynamic = "force-static";

export async function GET() {
  const catalog = await getCatalog();
  const maxOutput = (g: (typeof catalog.groups)[number]): number | null => {
    let m = g.canonical?.limit?.output ?? null;
    for (const l of g.listings) {
      if (l.limit.output != null && (m == null || l.limit.output > m)) m = l.limit.output;
    }
    return m;
  };
  return Response.json({
    updated: new Date().toISOString(),
    stats: catalog.stats,
    models: catalog.groups.map((g) => {
      const lowestInput = lowestInputListing(g);
      const lowestOutput = lowestOutputListing(g);
      return {
        id: g.id,
        name: g.name,
        lab: g.labId,
        providers: providerCount(g),
        listings: g.listings.length,
        best_price: g.best
          ? {
              input_per_m: g.best.input,
              output_per_m: g.best.output,
              cache_read_per_m: g.best.cacheRead,
              provider: g.best.providerId,
              basis: "3:1 blended input/output",
            }
          : null,
        lowest_input: lowestInput
          ? { per_m: lowestInput.cost.input, provider: lowestInput.providerId, listing: lowestInput.key }
          : null,
        lowest_output: lowestOutput
          ? { per_m: lowestOutput.cost.output, provider: lowestOutput.providerId, listing: lowestOutput.key }
          : null,
        free: g.free,
        context: groupContext(g),
        max_output: maxOutput(g),
        reasoning: g.canonical?.reasoning ?? null,
        tool_call: g.canonical?.toolCall ?? null,
        structured_output: g.canonical?.structuredOutput ?? null,
        vision: g.canonical?.attachment ?? null,
        open_weights: g.canonical?.openWeights ?? null,
        release_date: groupReleaseDate(g),
      };
    }),
  });
}
