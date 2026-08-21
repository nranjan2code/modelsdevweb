# LLM Pulse

**Every AI model. Every provider. Every change.**

LLM Pulse is a price-comparison and changelog site for AI models, built entirely on the open
[models.dev](https://models.dev) dataset. It answers three questions:

1. **Compare** — which inference provider serves this model cheapest right now?
2. **Track** — what changed in the model landscape today? (releases, price moves, deprecations)
3. **Automate** — can my code or AI agent consume all of this as JSON?

## How it works

```
GitHub Actions (hourly cron)
  └─ fetch https://models.dev/{api,models}.json
  └─ validate + normalize + diff against previous snapshot
  └─ fetch daily model news via Tavily (skips after first run of the day)
  └─ commit snapshots/ + events/ + news/ to this repo   ← git history is the database
  └─ push triggers Vercel git integration → static rebuild & deploy
```

No server, no database. Snapshots are committed to git; a pure-TypeScript diff pipeline turns
changes into typed events (`repriced`, `deprecated`, `model_added`, `provider_added`,
`context_changed`, `capability_changed`, …).

## Development

```bash
pnpm install
pnpm sync        # fetch models.dev, diff vs last snapshot, update snapshots/ + events/
pnpm news        # fetch daily model news via Tavily into news/index.json (--force to refetch)
pnpm test        # pipeline unit tests (vitest)
pnpm dev         # local dev server
pnpm build       # static export to out/
```

Local secrets live in `.env.local` (gitignored): `TAVILY_API_KEY` is read automatically by
`scripts/news.ts`.

## Project layout

| Path | Purpose |
|------|---------|
| `src/lib/pipeline/` | schema validation (zod), normalization, diff engine |
| `scripts/sync.ts` | hourly sync job: fetch → diff → commit |
| `scripts/news.ts` | daily Tavily news job: top models → headlines → `news/index.json` |
| `snapshots/latest/` | most recent raw models.dev data |
| `events/index.json` | merged changelog events, newest first |
| `news/index.json` | daily model news items (title, source, favicon, matched model IDs) |
| `src/app/` | Next.js App Router pages (static export) |

## Machine interfaces

- `/api/events.json` — changelog feed
- `/api/models.json` — canonical model catalog with best prices
- `/rss.xml` — RSS feed of changes
- `/llms.txt` — index for AI agents

### MCP server (for AI agents)

Expose LLM Pulse as tools to any MCP client (Claude, opencode, Cursor, …):

```bash
pnpm mcp   # stdio transport; set LLM_PULSE_URL to your deployment
```

Tools: `search_models` (capability/price/context filters), `get_model_prices`
(per-provider comparison), `get_changes` (recent landscape events).

### Webhook watchdog

Get POSTed whenever tracked changes happen. Add entries to `watchers.json`:

```json
[
  {
    "url": "https://example.com/hooks/llm-pulse",
    "types": ["repriced", "deprecated"],
    "labs": ["openai", "anthropic"]
  }
]
```

Both `types` and `labs` are optional filters. The hourly sync delivers new matching
events as a batch; delivery state is tracked in `events/notified.json`, and failed
endpoints retry on the next run. If the `WATCHER_SECRET` repo secret is set, each
request carries `x-llm-pulse-signature: sha256=<hmac(body)>` for verification:

```ts
const valid = crypto.timingSafeEqual(
  Buffer.from(sig),
  Buffer.from("sha256=" + crypto.createHmac("sha256", SECRET).update(rawBody).digest("hex")),
);
```

Client config example:

```json
{
  "mcpServers": {
    "llm-pulse": {
      "command": "pnpm",
      "args": ["mcp"],
      "cwd": "/path/to/llm-pulse",
      "env": { "LLM_PULSE_URL": "https://your-deployment.example.com" }
    }
  }
}
```

## Deployment (Vercel)

Static export (`out/`), deployed via **Vercel git integration** — every push to `main`
(including sync-bot commits) triggers a production build automatically. No deploy hook or
`DEPLOY_HOOK_URL` needed anymore.

```
push to main ──► Vercel build (pnpm build → out/) ──► production
     ▲
     └─ hourly sync Action commits data, which re-triggers the above
```

### Environment & secrets

| Where | Name | Purpose |
|-------|------|---------|
| GitHub repo secrets | `TAVILY_API_KEY` | daily news fetch in CI (`scripts/news.ts`) |
| Vercel project env | `TAVILY_API_KEY` | optional; only if building news during Vercel builds |
| Vercel project env | `NEXT_PUBLIC_SITE_URL` | production URL for absolute links in feeds |
| local `.env.local` | `TAVILY_API_KEY` | manual `pnpm news` runs; auto-loaded by the script |

The key is only ever used server-side in scripts/CI — it never reaches the browser bundle.

### Deploy verification

```bash
vercel ls                          # latest production deployment status
curl -s https://modelsdevweb.vercel.app | grep -c "In the news"
gh run list --limit 3              # sync workflow health
```

If a sync run fails, check `gh run view <id> --log-failed`. Tavily failures keep the previous
`news/index.json`, so stale-but-valid news is preferred over an empty section.

## Data & pricing caveats

Prices are per 1M tokens (USD) as published by models.dev contributors. A dash (`—`) means the
provider does not publicly list a price — it is **not** necessarily free. Always verify with the
provider before purchasing.

## License

MIT
