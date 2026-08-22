import { getExternalSignals } from "@/lib/data/external";

export const dynamic = "force-static";

export async function GET() {
  const snapshot = await getExternalSignals();
  return Response.json({
    count: snapshot.compositeScores.length,
    license: snapshot.license,
    fetchedAt: snapshot.fetchedAt,
    compositeScores: snapshot.compositeScores,
    signals: snapshot.signals,
  });
}
