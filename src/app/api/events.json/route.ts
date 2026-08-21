import { getEvents } from "@/lib/data";

export const dynamic = "force-static";

export async function GET() {
  const events = await getEvents();
  return Response.json({ count: events.length, events });
}
