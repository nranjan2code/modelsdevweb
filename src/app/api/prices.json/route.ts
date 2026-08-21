import { getCatalog } from "@/lib/data";

export const dynamic = "force-static";

export async function GET() {
  const catalog = await getCatalog();
  return Response.json({
    updated: new Date().toISOString(),
    stats: catalog.stats,
    prices: catalog.groups.flatMap((g) =>
      g.listings
        .filter((l) => l.cost.input != null || l.cost.output != null)
        .map((l) => ({
          model: g.id,
          provider: l.providerId,
          listing: l.key,
          status: l.status,
          input_per_m: l.cost.input,
          output_per_m: l.cost.output,
          cache_read_per_m: l.cost.cacheRead,
          cache_write_per_m: l.cost.cacheWrite,
          reasoning_per_m: l.cost.reasoning,
          context: l.limit.context,
        })),
    ),
  });
}
