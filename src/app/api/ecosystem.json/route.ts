import type { EcosystemSnapshot } from "@/lib/ecosystem/types";
import { getEcosystemSnapshot } from "@/lib/ecosystem/data";

export const dynamic = "force-static";

export async function GET() {
  const snapshot: EcosystemSnapshot = await getEcosystemSnapshot();
  return Response.json(snapshot);
}
