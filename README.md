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
  └─ commit snapshots/ + events/ to this repo   ← git history is the database
  └─ static rebuild & deploy
```

No server, no database. Snapshots are committed to git; a pure-TypeScript diff pipeline turns
changes into typed events (`repriced`, `deprecated`, `model_added`, `provider_added`,
`context_changed`, `capability_changed`, …).

## Development

```bash
pnpm install
pnpm sync        # fetch models.dev, diff vs last snapshot, update snapshots/ + events/
pnpm test        # pipeline unit tests (vitest)
pnpm dev         # local dev server
pnpm build       # static export to out/
```

## Project layout

| Path | Purpose |
|------|---------|
| `src/lib/pipeline/` | schema validation (zod), normalization, diff engine |
| `scripts/sync.ts` | hourly sync job: fetch → diff → commit |
| `snapshots/latest/` | most recent raw models.dev data |
| `events/index.json` | merged changelog events, newest first |
| `src/app/` | Next.js App Router pages (static export) |

## Machine interfaces

- `/api/events.json` — changelog feed
- `/api/models.json` — canonical model catalog with best prices
- `/rss.xml` — RSS feed of changes
- `/llms.txt` — index for AI agents

## Data & pricing caveats

Prices are per 1M tokens (USD) as published by models.dev contributors. A dash (`—`) means the
provider does not publicly list a price — it is **not** necessarily free. Always verify with the
provider before purchasing.

## License

MIT
