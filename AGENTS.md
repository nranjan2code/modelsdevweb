# Agent guide — Model Pulse

Price-comparison & changelog site for AI models, built on the open models.dev dataset.
Production: https://modelsdevweb.vercel.app

## Commands

```bash
pnpm lint          # eslint
npx tsc --noEmit   # typecheck (no dedicated script)
pnpm test          # vitest
pnpm check:style   # brand/style token gate (docs/brand.md §9) — fails CI on raw hexes, palette classes, soft shadows, !important colors
pnpm build         # pnpm og + pnpm badges + next build (static export) → out/
pnpm sync          # fetch models.dev, run quality gates, diff, write snapshots/ + events/ (gates fail → nothing written, exit 1)
pnpm sync-external # fetch HF/GitHub popularity signals → snapshots/latest/external-signals.json (uses GITHUB_TOKEN if set)
pnpm gate          # standalone data-quality gates over committed snapshots (add --offline to skip live upstream compare)
pnpm news          # Tavily daily news → news/index.json (--force to refetch same day)
pnpm og            # satori-render OG cards → public/og/ (site + top 300 models)
pnpm badges        # shields-style SVG price badges → public/badge/ (all models)
```

## Data-quality gates

`src/lib/pipeline/quality.ts` defines invariant checks; `scripts/gate.ts` runs them against
committed state and `scripts/sync.ts` runs them pre-write so a red gate never lands.
CI (`sync.yml`) runs both. Hard-fail checks: snapshot freshness (<26h), upstream completeness
(vs live fetch, with a small drift budget), new-release visibility (a release dated ≤3 days must
surface via `groupReleaseDate` — the "0x/Ox Alpha missing from home" regression), group
fragmentation (case-insensitive merge invariants), lab hygiene (only canonical labs, no
provider fallbacks like `kilo`/`nano-gpt`), stats integrity, free-model ($0/$0) classification,
and event referential integrity. Soft warnings: upstream drift within budget, stale/dead-linked
news.

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
  ├─ pnpm sync-external → snapshots/latest/external-signals.json (HF downloads/likes/trending/papers + GitHub stars/forks)
  └─ git commit + push → Vercel git integration rebuilds production
```

- External signals resolve to canonical group ids via `src/lib/pipeline/external-resolver.ts`
  (manual overrides > exact > fuzzy ≥0.75, one group per external item); `src/lib/scoring/composite.ts`
  ranks them with per-source normalization curves and half-life decay. Every signal carries
  `license` + `attributionUrl`; the quality gates reject orphans, missing attribution, bad values,
  and >30d-stale entries. Papers with Code (shut down mid-2025) and LMArena (no public API) were
  evaluated and deliberately excluded. Home "Momentum index" + `/api/signals.json` consume this.
- `scripts/news.ts` picks the 6 freshest + 4 most-listed models, queries Tavily topic=news,
  dedupes URLs, tags items with canonical model IDs for deep-linking to `/m/<id>`.
- If all Tavily queries fail, the previous `news/index.json` is kept (stale over empty).
- Missing `TAVILY_API_KEY` → script exits 0 with a warning (CI stays green).
- `scripts/og.tsx` renders OG social cards (satori + resvg) into `public/og/` during
  `pnpm build`; gitignored, never committed. Model pages reference their card when present,
  others fall back to `/og/site.png`. Absolute URLs come from `NEXT_PUBLIC_SITE_URL`.
- `scripts/badges.ts` renders shields-style SVG price badges into `public/badge/` during
  `pnpm build`; gitignored. Model pages embed them; `/badge/<id>.svg` is public.

## Brand, voice & design tokens

`docs/brand.md` (visual system) and `docs/voice.md` (copy rules) are binding specs.

- All colors are semantic tokens defined in `@theme` in `src/app/globals.css`
  (`ink`, `paper`, `surface`, `accent`, `pos`, `neg`, `warn`, `special` + `-soft` tints
  and `*-bright` fills). Never use Tailwind palette classes (`text-blue-600`) or raw
  hexes in TSX — `pnpm check:style` fails on both.
- Hue encodes *kind*, fixed site-wide (docs/brand.md §3.2): `pos` = good for the buyer
  (cuts ▼, launches, Free), `neg` = costly/gone (hikes ▲, deprecations),
  `special` = repricing machinery, `warn` = attention-neutral, `accent` = links/info.
- Shared primitives live in `src/components/ui.tsx`: `<Badge tone>`, `<DeltaChip>`,
  `<SectionHead>`, `<Bar>`, `<EmptyState>` — use them instead of hand-rolling chips,
  headings, meters or empty states.
- Money values render ink by default; color is for deltas/winners only.
- Ink alpha text scale is `/35 · /45 · /60 · /70`; line steps `/5 · /10 · /15`.

## Pages & client state

- Static pages: `/compare` (2–4 model diff), `/trends` (market aggregates), per-lab feeds at
  `/feeds/[lab]/rss.xml`. All computed from the same snapshot data as every other page.
- `/compare` selection lives in localStorage (`model-pulse:compare`) via `src/lib/compare.ts`
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
