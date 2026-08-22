# Model Pulse

**Every AI model. Every provider. Every change.**

Model Pulse is a price-comparison and changelog site for AI models, built entirely on the open
[models.dev](https://models.dev) dataset. Live at **[vaanalytics.in](https://www.vaanalytics.in)**.

It answers four questions:

1. **Compare** — which inference provider serves this model cheapest right now, and what is the
   catch? (the same weights routinely span 20–50× across providers)
2. **Track** — what changed today, and *who* changed it? A lab repricing its model is news; a
   gateway adjusting its markup is inventory, and the site never conflates the two.
3. **Judge** — what does a dollar actually buy? Rankings use independently measured benchmark
   scores only; numbers a lab published about its own model are shown, labelled, and never ranked.
   And "open weights" is split into what it really is: a licence class and an access class, so a
   non-commercial model behind an approval form never reads the same as Apache-2.0 — which also
   answers whether self-hosting is even legal, and at what volume it could start to pay.
4. **Automate** — can my code or AI agent consume all of this as JSON?

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

Two invariants matter more than the rest:

- **One real model is one catalog entry.** Providers spell the same model a dozen ways
  (`GPT-5.6 Sol`, `GPT-5.6 Sol (Azure)`, `openai.gpt-5.6-sol`, `gpt-5.6-sol@eu`).
  `src/lib/pipeline/identity.ts` resolves them by exact slug equality — never fuzzy matching, so
  genuine variants like `GPT-5.6 Sol Pro` stay separate. A quality gate fails the sync if the
  attributed model count drifts away from the upstream canonical count.
- **`snapshots/price-archive.json` is never pruned.** Dated snapshots age out after 30 days;
  the archive is the permanent price record and the only asset here that compounds. Nothing
  upstream keeps the past, so history lost here cannot be recovered.

## Development

```bash
pnpm install
pnpm sync        # fetch models.dev, diff vs last snapshot, update snapshots/ + events/
pnpm news        # fetch daily model news via Tavily into news/index.json (--force to refetch)
pnpm test        # pipeline unit tests (vitest)
pnpm gate        # data-quality gates over committed snapshots (--offline skips live compare)
pnpm check:style # brand token gate (docs/brand.md §9)
pnpm check:docs  # docs gate — dead paths, deleted modules, drifted constants
pnpm sync-weights     # daily HF licence/gating refresh (--force to override the 20h skip)
pnpm archive-backfill # rebuild the permanent price archive from retained snapshots
pnpm dev         # local dev server
pnpm build       # static export to out/ (runs pnpm og + pnpm badges first)

```

Local secrets live in `.env.local` (gitignored): `TAVILY_API_KEY` is read automatically by
`scripts/news.ts`.

## Project layout

| Path | Purpose |
|------|---------|
| `src/lib/pipeline/` | schema validation (zod), normalization, diff engine |
| `src/lib/pipeline/identity.ts` | canonical model identity — one model, one catalog entry |
| `src/lib/data/archive.ts` | permanent columnar price archive (never pruned) |
| `src/lib/data/market.ts` | first-party vs reseller, price spreads, outlier/corroboration defences |
| `src/lib/data/brief.ts` | the editorial layer: tape split, frontier index, the daily lede |
| `src/lib/data/provenance.ts` | benchmark score provenance (independent / self-reported) |
| `src/lib/data/weights.ts` | open-weight licence + gating classification (what you may ship) |
| `src/lib/data/selfhost.ts` | self-host vs API economics — GPU rent floor and break-even |
| `scripts/sync-weights.ts` | daily Hugging Face licence/gating/params refresh |
| `scripts/sync.ts` | hourly sync job: fetch → gate → archive → diff → commit |
| `scripts/news.ts` | daily Tavily news job: top models → headlines → `news/index.json` |
| `scripts/og.tsx` | OG social cards → `public/og/` (build-time, gitignored) |
| `scripts/badges.ts` | SVG price badges → `public/badge/` (build-time, gitignored) |
| `snapshots/latest/` | most recent raw models.dev data |
| `snapshots/price-archive.json` | permanent daily price series — **never delete this** |
| `snapshots/latest/weights.json` | open-weight licence, gating and parameter counts from HF |
| `events/index.json` | merged changelog events, newest first |
| `news/index.json` | daily model news items (title, source, favicon, matched model IDs) |
| `src/app/` | Next.js App Router pages (static export) |

## Machine interfaces

- `/api/events.json` — changelog feed
- `/api/models.json` — canonical model catalog with best prices
- `/api/news.json` — daily model news headlines tagged with model IDs
- `/api/benchmarks.json` — benchmark leaderboards with scores, provenance, best prices and points-per-dollar
- `/rss.xml` — RSS feed of changes and news; `/feeds/<lab>/rss.xml` — per-lab feeds
- `/badge/<model>.svg` — live SVG price badge for embedding in READMEs (regenerated each sync)
- `/llms.txt` — index for AI agents

### MCP server (for AI agents)

Expose Model Pulse as tools to any MCP client (Claude, opencode, Cursor, …):

```bash
pnpm mcp   # stdio transport; set MODEL_PULSE_URL to your deployment
```

Tools: `search_models` (capability/price/context filters), `get_model_prices`
(per-provider comparison), `get_changes` (recent landscape events), `get_news`
(daily model headlines).

### Webhook watchdog

Get POSTed whenever tracked changes happen. Add entries to `watchers.json`:

```json
[
  {
    "url": "https://example.com/hooks/model-pulse",
    "types": ["repriced", "deprecated"],
    "labs": ["openai", "anthropic"]
  }
]
```

Both `types` and `labs` are optional filters. The hourly sync delivers new matching
events as a batch; delivery state is tracked in `events/notified.json`, and failed
endpoints retry on the next run. If the `WATCHER_SECRET` repo secret is set, each
request carries `x-model-pulse-signature: sha256=<hmac(body)>` for verification:

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
    "model-pulse": {
      "command": "pnpm",
      "args": ["mcp"],
      "cwd": "/path/to/model-pulse",
      "env": { "MODEL_PULSE_URL": "https://your-deployment.example.com" }
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
pnpm lint && npx tsc --noEmit && pnpm test && pnpm check:style && pnpm gate --offline
vercel ls                          # latest production deployment status
gh run list --limit 3              # sync workflow health
```

If a sync run fails, check `gh run view <id> --log-failed`. Tavily failures keep the previous
`news/index.json`, so stale-but-valid news is preferred over an empty section.

## Data & pricing caveats

Prices are per 1M tokens (USD) as published by models.dev contributors. A dash (`—`) means the
provider does not publicly list a price — it is **not** necessarily free, and upstream encodes
that case as `$0/$0`, which the pipeline excludes from every price calculation. Always verify
with the provider before purchasing.

Benchmark scores are reported by third parties *and* by the labs themselves. Roughly 60% of the
rows upstream originate on the model vendor's own site, so every score carries a provenance
label and only independently measured ones are used to rank. Extreme listings are defended
against: prices more than 20× from a model's median are dropped as upstream errors, and a price
no second provider comes within 1.5× of is never recommended.

## License

MIT — see [LICENSE](./LICENSE).

## Credits & data sources

- **Model/pricing data**: [models.dev](https://models.dev) (MIT) — community-maintained, open-source database
- **Benchmark scores**: publicly reported results via models.dev, labelled by provenance; benchmark names
  (SWE-Bench, Terminal-Bench, ARC-AGI, Artificial Analysis indexes, …) belong to their maintainers and link
  back to their official sites on every leaderboard
- **News headlines**: fetched via the Tavily API; copyright stays with publishers, items link to source
- **Fonts**: Inter, JetBrains Mono, Caveat (SIL OFL)

A live acknowledgment of all sources ships on the site at [`/about`](src/app/about/page.tsx).
