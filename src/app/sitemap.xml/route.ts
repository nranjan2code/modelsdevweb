import { getCatalog } from "@/lib/data";
import { getBenchmarkBoards } from "@/lib/data/benchmarks";
import { SITE_URL } from "@/lib/site";

export const dynamic = "force-static";

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export async function GET() {
  const [catalog, boards] = await Promise.all([getCatalog(), getBenchmarkBoards()]);
  const lastmod = catalog.stats.snapshotDate ?? undefined;

  const staticPaths = [
    "/",
    "/browse",
    "/compare",
    "/providers",
    "/benchmarks",
    "/trends",
    "/calculator",
    "/self-host",
    "/changelog",
    "/digest",
    "/news",
    "/deprecations",
    "/about",
  ];

  const urls: { loc: string; lastmod?: string }[] = staticPaths.map((p) => ({
    loc: `${SITE_URL}${p}`,
    lastmod,
  }));
  for (const g of catalog.groups) urls.push({ loc: `${SITE_URL}/m/${g.id}`, lastmod });
  for (const l of catalog.labs) urls.push({ loc: `${SITE_URL}/lab/${l.id}`, lastmod });
  for (const p of catalog.providers) urls.push({ loc: `${SITE_URL}/provider/${p.id}`, lastmod });
  for (const b of boards) urls.push({ loc: `${SITE_URL}/benchmarks/${b.slug}`, lastmod });

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map(
    (u) => `  <url>
    <loc>${esc(u.loc)}</loc>${u.lastmod ? `\n    <lastmod>${u.lastmod}</lastmod>` : ""}
  </url>`,
  )
  .join("\n")}
</urlset>`;

  return new Response(xml, { headers: { "content-type": "application/xml; charset=utf-8" } });
}
