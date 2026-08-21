# Agent guide — LLM Pulse

Price-comparison & changelog site for AI models, built on the open models.dev dataset.
Production: https://modelsdevweb.vercel.app

## Commands

```bash
pnpm lint          # eslint
npx tsc --noEmit   # typecheck (no dedicated script)
pnpm test          # vitest
pnpm build         # pnpm og + pnpm badges + next build (static export) → out/
pnpm sync          # fetch models.dev, diff, write snapshots/ + events/
pnpm news          # Tavily daily news → news/index.json (--force to refetch same day)
pnpm og            # satori-render OG cards → public/og/ (site + top 300 models)
pnpm badges        # shields-style SVG price badges → public/badge/ (all models)
```

## Architecture constraints

- **Static export** (`output: "export"` in next.config.ts). No server runtime, no route
  handlers doing dynamic work, no ISR. Everything is prerendered at build time.
- **Git is the database**: `snapshots/`, `events/index.json`, `news/index.json` are committed
  by CI. Pages read these files via `src/lib/data` at build time only.
- Never call external APIs from components or client code — fetch in `scripts/*.ts` during
  CI instead, commit the JSON result. API keys must never reach the browser bundle.

## Data flow

```
hourly GH Action (sync.yml)
  ├─ pnpm sync   → snapshots/{latest,date}/ + events/index.json
  ├─ pnpm news   → news/index.json (Tavily; runs once/day, skips rest of day)
  └─ git commit + push → Vercel git integration rebuilds production
```

- `scripts/news.ts` picks the 6 freshest + 4 most-listed models, queries Tavily topic=news,
  dedupes URLs, tags items with canonical model IDs for deep-linking to `/m/<id>`.
- If all Tavily queries fail, the previous `news/index.json` is kept (stale over empty).
- Missing `TAVILY_API_KEY` → script exits 0 with a warning (CI stays green).
- `scripts/og.tsx` renders OG social cards (satori + resvg) into `public/og/` during
  `pnpm build`; gitignored, never committed. Model pages reference their card when present,
  others fall back to `/og/site.png`. Absolute URLs come from `NEXT_PUBLIC_SITE_URL`.
- `scripts/badges.ts` renders shields-style SVG price badges into `public/badge/` during
  `pnpm build`; gitignored. Model pages embed them; `/badge/<id>.svg` is public.

## Pages & client state

- Static pages: `/compare` (2–4 model diff), `/trends` (market aggregates), per-lab feeds at
  `/feeds/[lab]/rss.xml`. All computed from the same snapshot data as every other page.
- `/compare` selection lives in localStorage (`llm-pulse:compare`) via `src/lib/compare.ts`
  (`useSyncExternalStore`). Never read it with useState+useEffect — the
  `react-hooks/set-state-in-effect` lint rule rejects that pattern.
- Benchmark boards expose `pointsPerDollar` (score ÷ blended price); see
  `src/lib/data/benchmarks.ts`.

## Deployment (Vercel)

- Project `modelsdevweb` (team `sutraworks-lab`), linked via `.vercel/project.json`.
- **Git integration connected to `nranjan2code/modelsdevweb`** — every push to `main`
  deploys (the old `DEPLOY_HOOK_URL` mechanism was removed from the workflow).
- Secrets: GitHub Actions secret `TAVILY_API_KEY`; Vercel env `NEXT_PUBLIC_SITE_URL`,
  optional Vercel `TAVILY_API_KEY`. Local dev uses `.env.local` (gitignored).

## Verify after changes

```bash
vercel ls                                        # deployment status
curl -s https://modelsdevweb.vercel.app | grep -c "In the news"
gh run list --limit 3                            # sync workflow health
```

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
