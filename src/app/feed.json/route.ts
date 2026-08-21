import { getEvents, getNews } from "@/lib/data";
import { SITE_NAME, SITE_URL } from "@/lib/site";

export const dynamic = "force-static";

export async function GET() {
  const [events, news] = await Promise.all([getEvents(), getNews()]);
  const items = [
    ...events.slice(0, 50).map((e) => ({
      id: e.id,
      url: e.canonicalId ? `${SITE_URL}/m/${e.canonicalId}` : `${SITE_URL}/changelog`,
      title: `${e.type}: ${e.modelName}`,
      content_text:
        e.changes.map((c) => `${c.field}: ${JSON.stringify(c.old)} → ${JSON.stringify(c.new)}`).join("; ") ||
        `${e.type} detected on ${e.modelKey}`,
      date_published: `${e.date}T00:00:00Z`,
      tags: [e.type, ...(e.labId ? [`lab:${e.labId}`] : [])],
    })),
    ...news.map((n) => ({
      id: n.id,
      url: n.url,
      title: n.title,
      content_text: n.snippet || n.title,
      date_published: n.publishedAt ?? "1970-01-01T00:00:00Z",
      tags: ["news", ...n.modelIds.map((id) => `model:${id}`)],
      external_url: n.url,
    })),
  ].sort((a, b) => (a.date_published < b.date_published ? 1 : -1)).slice(0, 50);

  const feed = {
    version: "https://jsonfeed.org/version/1.1",
    title: `${SITE_NAME} — model changes & news`,
    home_page_url: SITE_URL,
    feed_url: `${SITE_URL}/feed.json`,
    items,
  };
  return Response.json(feed);
}
