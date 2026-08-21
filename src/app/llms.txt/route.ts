import { getCatalog, getEvents } from "@/lib/data";
import { SITE_NAME, SITE_TAGLINE, SITE_URL } from "@/lib/site";

export const dynamic = "force-static";

export async function GET() {
  const [catalog, events] = await Promise.all([getCatalog(), getEvents()]);
  const s = catalog.stats;
  const body = `# ${SITE_NAME}

> ${SITE_TAGLINE} Price comparison and change tracking for AI models across
> ${s.providers} inference providers, built on open data from models.dev.
> Prices are USD per 1M tokens. "null" price means unlisted, not free.

## Machine-readable endpoints

- GET ${SITE_URL}/api/models.json — canonical model catalog: best prices, context limits, capabilities
- GET ${SITE_URL}/api/prices.json — every provider listing with per-token pricing
- GET ${SITE_URL}/api/events.json — changelog events (releases, repricings, deprecations)
- GET ${SITE_URL}/api/news.json — daily news headlines about top models, tagged with model ids
- GET ${SITE_URL}/api/benchmarks.json — benchmark leaderboards with scores, best prices and points-per-dollar
- GET ${SITE_URL}/feed.json — JSON Feed 1.1 of recent changes
- GET ${SITE_URL}/rss.xml — RSS 2.0 of recent changes
- GET ${SITE_URL}/feeds/{lab}/rss.xml — per-lab RSS (e.g. /feeds/openai/rss.xml)
- GET ${SITE_URL}/badge/{lab}/{model}.svg — live SVG price badge for embedding (e.g. /badge/openai/gpt-4o.svg)

## Event types

model_added, provider_added, repriced, deprecated, context_changed,
capability_changed, model_removed, provider_removed

## Pages

- / — latest activity and stats
- /browse — filterable catalog of all canonical models
- /compare?models=lab/model,lab/model2 — side-by-side comparison of 2–4 models
- /trends — aggregate market view: capability adoption, price distribution, lab medians
- /m/{lab}/{model} — per-model provider price comparison (e.g. /m/openai/gpt-4o)
- /lab/{lab} — all models from one lab
- /benchmarks — index; /benchmarks/{slug} — leaderboard pairing scores with prices
- /calculator — monthly cost estimator by token mix
- /deprecations — listings no longer served
- /changelog — full event history (${events.length} events)
- /news — daily model news headlines with source links

## Notes for agents

- Prefer /api/*.json over scraping HTML.
- Model IDs are stable path-style identifiers (lab/model).
- A missing or null price means the provider does not publish one; verify before purchasing.

## MCP server

An MCP (Model Context Protocol) server ships in this repo for direct tool access:

- search_models — filter by capability, context, price, free text
- get_model_prices — per-provider price comparison for one model
- get_changes — recent releases, repricings, deprecations
- get_news — daily model news headlines, filterable by query or model id

Run with LLM_PULSE_URL=https://your-deployment pnpm mcp (stdio transport).
`;

  return new Response(body, { headers: { "content-type": "text/plain; charset=utf-8" } });
}
