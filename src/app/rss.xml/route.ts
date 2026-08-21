import { getEvents } from "@/lib/data";
import { SITE_NAME, SITE_TAGLINE, SITE_URL } from "@/lib/site";

export const dynamic = "force-static";

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export async function GET() {
  const events = await getEvents();
  const items = events
    .slice(0, 50)
    .map((e) => {
      const title = `${e.type}: ${e.modelName}${e.providerId ? ` via ${e.providerId}` : ""}`;
      const desc = e.changes.map((c) => `${c.field}: ${JSON.stringify(c.old)} → ${JSON.stringify(c.new)}`).join("; ");
      const link = e.canonicalId ? `${SITE_URL}/m/${e.canonicalId}` : `${SITE_URL}/changelog`;
      return `    <item>
      <title>${esc(title)}</title>
      <link>${esc(link)}</link>
      <guid isPermaLink="false">${e.id}</guid>
      <pubDate>${new Date(`${e.date}T00:00:00Z`).toUTCString()}</pubDate>
      <description>${esc(desc || title)}</description>
    </item>`;
    })
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>${esc(SITE_NAME)}</title>
    <link>${SITE_URL}</link>
    <description>${esc(SITE_TAGLINE)} Changes to AI model prices, capabilities and availability.</description>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
${items}
  </channel>
</rss>`;

  return new Response(xml, { headers: { "content-type": "application/rss+xml; charset=utf-8" } });
}
