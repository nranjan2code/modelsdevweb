import { SITE_URL } from "@/lib/site";

export const dynamic = "force-static";

export async function GET() {
  const body = `User-agent: *
Allow: /

# Explicitly welcome major AI crawlers
User-agent: GPTBot
Allow: /

User-agent: ChatGPT-User
Allow: /

User-agent: ClaudeBot
Allow: /

User-agent: anthropic-ai
Allow: /

User-agent: PerplexityBot
Allow: /

User-agent: Google-Extended
Allow: /

User-agent: CCBot
Allow: /

Crawl-delay: 10

Sitemap: ${SITE_URL}/sitemap.xml
`;
  return new Response(body, { headers: { "content-type": "text/plain; charset=utf-8" } });
}
