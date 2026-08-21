import { getEvents, getNews } from "@/lib/data";
import { SITE_NAME, SITE_TAGLINE, SITE_URL } from "@/lib/site";

export const dynamic = "force-static";

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

interface FeedItem {
  title: string;
  link: string;
  guid: string;
  pubDate: Date;
  description: string;
}

export async function GET() {
  const [events, news] = await Promise.all([getEvents(), getNews()]);
  const items: FeedItem[] = [
    ...events.slice(0, 50).map((e): FeedItem => {
      const title = `${e.type}: ${e.modelName}${e.providerId ? ` via ${e.providerId}` : ""}`;
      return {
        title,
        link: e.canonicalId ? `${SITE_URL}/m/${e.canonicalId}` : `${SITE_URL}/changelog`,
        guid: e.id,
        pubDate: new Date(`${e.date}T00:00:00Z`),
        description:
          e.changes.map((c) => `${c.field}: ${JSON.stringify(c.old)} → ${JSON.stringify(c.new)}`).join("; ") ||
          title,
      };
    }),
    ...news.map((n): FeedItem => ({
      title: n.title,
      link: n.url,
      guid: n.id,
      pubDate: n.publishedAt ? new Date(n.publishedAt) : new Date(0),
      description: n.snippet || n.title,
    })),
  ]
    .sort((a, b) => b.pubDate.getTime() - a.pubDate.getTime())
    .slice(0, 50);

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>${esc(SITE_NAME)}</title>
    <link>${SITE_URL}</link>
    <description>${esc(SITE_TAGLINE)} Changes to AI model prices, capabilities and availability, plus daily model news.</description>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
${items
  .map(
    (i) => `    <item>
      <title>${esc(i.title)}</title>
      <link>${esc(i.link)}</link>
      <guid isPermaLink="false">${i.guid}</guid>
      <pubDate>${i.pubDate.toUTCString()}</pubDate>
      <description>${esc(i.description)}</description>
    </item>`,
  )
  .join("\n")}
  </channel>
</rss>`;

  return new Response(xml, { headers: { "content-type": "application/rss+xml; charset=utf-8" } });
}
