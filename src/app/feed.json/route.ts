import { getEvents } from "@/lib/data";
import { SITE_NAME, SITE_URL } from "@/lib/site";

export const dynamic = "force-static";

export async function GET() {
  const events = await getEvents();
  const feed = {
    version: "https://jsonfeed.org/version/1.1",
    title: `${SITE_NAME} — model changes`,
    home_page_url: SITE_URL,
    feed_url: `${SITE_URL}/feed.json`,
    items: events.slice(0, 50).map((e) => ({
      id: e.id,
      url: e.canonicalId ? `${SITE_URL}/m/${e.canonicalId}` : `${SITE_URL}/changelog`,
      title: `${e.type}: ${e.modelName}`,
      content_text:
        e.changes.map((c) => `${c.field}: ${JSON.stringify(c.old)} → ${JSON.stringify(c.new)}`).join("; ") ||
        `${e.type} detected on ${e.modelKey}`,
      date_published: `${e.date}T00:00:00Z`,
      tags: [e.type, ...(e.labId ? [`lab:${e.labId}`] : [])],
    })),
  };
  return Response.json(feed);
}
