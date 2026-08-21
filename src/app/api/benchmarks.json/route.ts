import { getBenchmarkBoards } from "@/lib/data/benchmarks";

export const dynamic = "force-static";

export async function GET() {
  const boards = await getBenchmarkBoards();
  return Response.json({
    updated: new Date().toISOString(),
    boards: boards.map((b) => ({
      name: b.name,
      slug: b.slug,
      metric: b.metric,
      entries: b.entries.map((e) => ({
        model: e.groupId,
        lab: e.labId,
        score: e.score,
        best_input_per_m: e.bestInput,
        best_output_per_m: e.bestOutput,
        points_per_dollar: e.pointsPerDollar != null && Number.isFinite(e.pointsPerDollar) ? Math.round(e.pointsPerDollar * 100) / 100 : null,
      })),
    })),
  });
}
