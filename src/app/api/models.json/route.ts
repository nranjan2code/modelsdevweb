import { getCatalog } from "@/lib/data";

export const dynamic = "force-static";

export async function GET() {
  const catalog = await getCatalog();
  return Response.json({
    updated: new Date().toISOString(),
    stats: catalog.stats,
    models: catalog.groups.map((g) => ({
      id: g.id,
      name: g.name,
      lab: g.labId,
      providers: g.listings.length,
      best_price: g.best
        ? { input_per_m: g.best.input, output_per_m: g.best.output, cache_read_per_m: g.best.cacheRead, provider: g.best.providerId }
        : null,
      context: g.canonical?.limit?.context ?? null,
      max_output: g.canonical?.limit?.output ?? null,
      reasoning: g.canonical?.reasoning ?? null,
      tool_call: g.canonical?.toolCall ?? null,
      structured_output: g.canonical?.structuredOutput ?? null,
      vision: g.canonical?.attachment ?? null,
      open_weights: g.canonical?.openWeights ?? null,
      release_date: g.canonical?.releaseDate ?? null,
    })),
  });
}
