# Agent guide — Model Pulse

Price-comparison & changelog site for AI models, built on the open models.dev dataset.
Production: https://www.vaanalytics.in (Vercel project `modelsdevweb`)

## Commands

```bash
pnpm lint          # eslint
npx tsc --noEmit   # typecheck (no dedicated script)
pnpm test          # vitest
pnpm check:style   # brand/style token gate (docs/brand.md §9) — fails CI on raw hexes, palette classes, soft shadows, !important colors
pnpm check:docs    # docs gate — dead paths, references to deleted modules, constants quoted in prose that drifted from source
pnpm build         # pnpm og + pnpm badges + next build (static export) → out/
pnpm sync          # fetch models.dev, run quality gates, diff, write snapshots/ + events/ (gates fail → nothing written, exit 1)
pnpm sync-external # fetch HF/GitHub popularity signals → snapshots/latest/external-signals.json (uses GITHUB_TOKEN if set)
pnpm sync-weights  # fetch HF licence/gating/params for open-weight models → snapshots/latest/weights.json (daily; --force to override)
pnpm archive-backfill # rebuild snapshots/price-archive.json from retained daily snapshots
pnpm gate          # standalone data-quality gates over committed snapshots (add --offline to skip live upstream compare)
pnpm news          # Tavily daily news → news/index.json (--force to refetch same day)
pnpm notify        # POST new matching events to watchers.json endpoints; retries failures next sync
pnpm og            # satori-render OG cards → public/og/ (site + top 300 models)
pnpm badges        # shields-style SVG price badges → public/badge/ (all models)
```

## Model identity — read this before touching grouping

One real model reaches us under a dozen provider spellings ("GPT-5.6 Sol", "GPT-5.6 Sol
(Azure)", "OpenAI: GPT-5.6 Sol (50% off)", `global.openai.gpt-5.6-sol`, `gpt-5.6-sol@eu`).
Keying groups off those strings shattered 355 upstream models into 3,109 catalog entries
and promoted resellers (`databricks`, `gitlab`, `venice`) to "labs", which corrupted every
aggregate on the site.

- `src/lib/pipeline/identity.ts` resolves a listing to a canonical model by exact slug
  equality only — **never prefix or fuzzy matching**, so "GPT-5.6 Sol Pro" stays separate.
  A slug claimed by two unrelated canonicals is poisoned rather than guessed; a stable
  alias and its dated pin (`claude-haiku-4-5` / `claude-haiku-4-5-20251001`) are treated as
  one model. Generic ids (`auto`, `default`) never merge across providers.
- `catalog.tracked` = groups backed by a canonical lab. **Every aggregate — indices,
  distributions, scorecards, records, the price index — runs over `tracked`, not `groups`.**
  `catalog.groups` includes gateway-only variants and is for browse/compare/sitemap/API only.
- Groups with no canonical lab get `labId = UNATTRIBUTED_LAB`, never the provider id.
- The `catalog-identity` gate hard-fails if attributed groups drift outside 0.5–1.5× the
  upstream canonical count, or if a provider id appears as a lab.

## Token economics — the price is a function, not a number

`src/lib/economics/` is the only place a price becomes money. Nothing else may
compute one.

- **`workload.ts#costOf(cost, workload)`** is the single pricing entry point. A
  `Workload` is a named token profile (input / output / reasoning tokens, cache
  hit and *write* rates, context length); `WORKLOADS` holds the five presets and
  `DEFAULT_WORKLOAD` is `chat`. The old `blendPrice()` — a fixed `(3×in + out)/4`
  — is **deleted**. It asserted a chat workload site-wide and inverted for
  anything that reasons or retrieves, and no page said it was an assumption.
- **Every figure names its workload on the page.** A number whose profile is
  invisible is one the reader cannot check.
- **Fallbacks never assume an unpublished discount.** No cache-read rate → billed
  at full input. No cache-write rate → same. No separate reasoning rate → billed
  as output. Cache *writes* are charged, so a higher hit rate is not automatically
  cheaper — modelling them as free is how a calculator reports a saving that does
  not exist.
- **Context tiers are real rates, not a boolean.** `Cost.tiers` is a sorted
  `CostTier[]` of thresholds; `effectiveRates()` picks the highest tier at or
  below the request's context and falls back to the base card for fields a tier
  omits. 401 listings price by context, and collapsing that to `tiers: boolean`
  (which this codebase used to do) printed the cheap rate for exactly the
  long-context requests the expensive rate exists for.
- **`comparable.ts#isTokenComparable` gates every cross-model price comparison.**
  `$/M` only means the same thing when both sides bill text tokens. Whisper bills
  audio tokens and image models fold a per-image charge into the token field —
  unguarded, Whisper ranked as the cheapest budget model on the site and Nano
  Banana 2 showed a 95% "gateway discount" that was a unit mismatch.
- **`instruments.ts`** groups `tracked` into disjoint classes of purchase
  (`Basket`), over live listings only, with `MIN_CONSTITUENTS` before a class
  gets a median. Membership is derived from verified facts, never from a name.
- **`basis.ts`** measures gateway quotes against the lab's own counter. It needs
  a first-party reference — no lab counter, no basis, and the cheapest reseller
  is never a substitute. Extreme quotes need corroboration exactly as
  `priceSpread` requires it (`PRICE_OUTLIER_FACTOR` 20×, `CORROBORATION_FACTOR`
  1.5×); the first cut of this module omitted that and reported a 96% discount
  on a mis-scaled unorouter listing. **Open-weight basis is ranked separately**:
  a host beating Alibaba on Qwen runs the same public weights on cheaper
  hardware, which is not a gateway undercutting a monopoly.
- **`volatility.ts`** and any longitudinal claim need `MIN_OBSERVATION_DAYS` (14)
  of archive and return `ready: false` below it.
- **`benchmark-workloads.ts`** maps a board to the profile it exercises, so
  points-per-dollar prices SWE-Bench as an agent loop and GPQA as a long chain of
  thought. The map is **allow-listed, never pattern-matched** — an unlisted board
  is `calibrated: false`, priced at the default, and the page says so.

## Retirement is per-listing, not per-model

`src/lib/data/retirement.ts`. Upstream marks `status: "deprecated"` per provider
endpoint, so one model is routinely live at some venues and withdrawn at others.
Two different facts, and collapsing them loses information a buyer needs:

- **Withdrawn here** (`partiallyRetired`) — live somewhere, gone at this venue.
  A migration, not a sunset. A provider counts as having retired a model only if
  it has no live endpoint left; dropping one variant while serving another is not.
- **Retired everywhere** (`retiredEverywhere`) — no live listing anywhere. Never
  counted in what a lab currently offers.

`stats.activeModels` excludes fully-retired groups and is what the homepage
prints; `stats.models` still counts every attributed group. Lab pages use
`providerCount()` and list retired models in a separate section — they used to
print `listings.length`, which counts endpoint variants *and* withdrawn ones, so
Claude Opus 4.1 advertised 22 providers against 16 that would sell it. Provider
pages split live from withdrawn rather than price-sorting them together, where a
dead endpoint could head the table as the venue's cheapest offer. The
`retirement-integrity` gate hard-fails if a group's best price cites a withdrawn
endpoint or if `activeModels` disagrees with the live-listing count.

## Never claim a window you cannot cover

`src/lib/data/coverage.ts`. The event log's first sync diffs an empty state
against the whole catalog, so its volume is a function of catalog size, not of
market activity — 121 of the first 170 events landed that way. `coverage()`
detects that cold start (first day ≥ `COLD_START_MULTIPLE` × the median of later
days, and only with ≥2 later days to compare against), excludes it from every
rate, and reports `observedDays`. `windowLabel()` prints the window that actually
exists. Rankings need `MIN_RANKING_DAYS` (7). A hard-coded "last 7 days" caption
over a two-day log is the same class of error as a flat price index.

## Editorial rules — the site takes a position

- **First-party vs street.** A lab repricing its own model is news; a gateway changing its
  markup is inventory. `src/lib/data/market.ts#isFirstParty` decides (with alias handling —
  `google-vertex` is first-party for Google, `azure` is *not* for OpenAI), and
  `src/lib/data/brief.ts#marketMoves` splits the tape on it. Never rank them together.
- **The lede** (`brief.ts#lede`) picks the day's lead story from ordered rules and returns
  the rule name with it — the homepage prints it. A quiet week must read as a quiet week;
  never manufacture a story. Any new rule must be explainable in one line.
- **Benchmark provenance** (`src/lib/data/provenance.ts`). ~60% of upstream benchmark rows
  come from the lab's own site. Rankings use `board.independent` only; self-reported scores
  are shown on model pages with a `Self-reported` badge and never ranked.
- **"Open weights" is two facts, not one** (`src/lib/data/weights.ts`). A licence class
  (permissive / conditional / non-commercial / unknown) and an access class (open / gated),
  read from Hugging Face model cards. Upstream's `openWeights` boolean put Apache-2.0 in the
  same bucket as Cohere's `cc-by-nc-4.0` behind an approval form. **Classification is
  allow-listed, never pattern-guessed** — telling someone they may ship commercially when
  they may not is the worst error this codebase can make, so an unrecognised licence is
  `unknown` ("check the card"), never `permissive`. We summarise; the card is authoritative
  and every record carries its URL.
- **$0/$0 means "no published price", not free** (`unlistedPrice`). Treating it as a price
  produced "100% below OpenAI" recommendations and a 1,149× spread headline.
- **Extreme claims need corroboration.** `priceSpread` drops listings >20× from the group
  median as upstream errors, and only recommends a price a second venue is within 1.5× of.
- **No module may render a lie when data is thin.** The price index returns `ready: false`
  and states the date it starts publishing rather than drawing a flat line at ▼0.0%.

## Data-quality gates

`src/lib/pipeline/quality.ts` defines invariant checks; `scripts/gate.ts` runs them against
committed state and `scripts/sync.ts` runs them pre-write so a red gate never lands.
CI (`sync.yml`) runs both. Hard-fail checks: snapshot freshness (<26h), upstream completeness
(vs live fetch, with a small drift budget), new-release visibility (a release dated ≤3 days must
surface via `groupReleaseDate` — the "0x/Ox Alpha missing from home" regression), group
fragmentation (case-insensitive merge invariants), lab hygiene (only canonical labs, no
provider fallbacks like `kilo`/`nano-gpt`), catalog identity (attributed-group count tracks
upstream; no provider id as a lab), stats integrity, free-model ($0/$0) classification,
event referential integrity, and retirement integrity (no best price from a
withdrawn endpoint; `activeModels` matches the live-listing count). News deep links and external-signal model IDs are also
hard-fail referential checks; their ingestion scripts remove retained IDs that no longer exist
before the final gate. Context claims at or above 10M are hard-fail unless the exact
provider/model/value has a sourced decision in `src/lib/pipeline/context-review.ts`; rejected
claims are removed during normalization. Soft warnings are limited to upstream drift within
budget, stale/malformed news, stale external signals, and stale/orphaned weight records.

## Social accounts are distribution, not data

Evaluated for ingestion, with what we found:

- **Hugging Face — the only viable source, and now used twice.** Public metadata under HF's
  API terms; we attribute and link back on every record. Popularity signals via
  `sync-external`, licence/gating/params via `sync-weights`.
- **Reddit — do not build against the public JSON endpoint.** `r/LocalLLaMA` sentiment is the
  best practitioner signal available, but `reddit.com/*.json` returns **403** from CI ranges,
  and Reddit's Data API terms restrict commercial use and redistribution — and this repo
  *commits fetched data to git*, which is redistribution. Ingesting it needs a registered
  OAuth app plus a decision about commercial terms. Not a code problem; do not work around
  the 403.
- **X/Twitter — not viable for ingestion.** The free tier is effectively write-only and paid
  tiers start around $100/mo, which does not fit a static, no-server site.

The accounts' real value is **outbound**: the daily lede (`brief.ts#lede`) is already a
written, self-contained sentence with a link — that is the post. Publish it; do not scrape.

## Docs are gated, so keep them true

`README.md`, this file, `docs/brand.md` and `docs/voice.md` are binding specs an
agent reads *before* changing code — a stale claim is worse than a missing one.
`pnpm check:docs` (CI, before lint) mechanically enforces three things:

1. every `src/…`, `scripts/…`, `snapshots/…` path named in prose exists,
2. no doc describes a deliberately removed module as current (the removal list
   lives in `scripts/check-docs.ts`; the "why we removed it" notes here pass
   because they read as historical),
3. tuning constants quoted in prose still match source — currently
   `RETENTION_DAYS` (30 days), `INDEX_MIN_DAYS` (14 days),
   `PRICE_OUTLIER_FACTOR` (20×) and `CORROBORATION_FACTOR` (1.5×).

It cannot check whether the *meaning* is still right — that stays with you. When
you delete a module, add it to the `DELETED` list so the docs cannot quietly
keep describing it.

## Architecture constraints

- **Static export** (`output: "export"` in next.config.ts). No server runtime, no route
  handlers doing dynamic work, no ISR. Everything is prerendered at build time.
- **Git is the database**: `snapshots/`, `events/index.json`, `news/index.json` are committed
  by CI. Pages read these files via `src/lib/data` at build time only.
- **`snapshots/price-archive.json` is never pruned.** Dated snapshots age out at
  `RETENTION_DAYS` (30) and exist only to diff against and to rebuild the archive; the
  archive is the permanent record and the only asset here that compounds. Deleting it loses
  history that cannot be recovered — nothing upstream keeps the past. `sync.ts` appends a
  column per day before pruning; `getAllPriceHistory()` reads it and falls back to walking
  dated snapshots only on a cold start.
- Never call external APIs from components or client code — fetch in `scripts/*.ts` during
  CI instead, commit the JSON result. API keys must never reach the browser bundle.

## Data flow

```
hourly GH Action (sync.yml)
  ├─ pnpm sync   → snapshots/{latest,date}/ + events/index.json
  ├─ pnpm news   → news/index.json (Tavily; runs once/day, skips rest of day)
  ├─ pnpm sync-weights → snapshots/latest/weights.json (HF licence/access/params; skips if <20h old)
  ├─ pnpm sync-external → snapshots/latest/external-signals.json (HF downloads/likes/trending/papers + GitHub stars/forks)
  │                         + snapshots/external-history/{date}.json
  ├─ pnpm gate   → validates the complete candidate state after external refreshes
  ├─ pnpm notify → watcher webhooks; successful event ids → events/notified.json
  └─ git commit + push → Vercel git integration rebuilds production
```

- External signals resolve to canonical group ids via `src/lib/pipeline/external-resolver.ts`
  (manual overrides > exact > fuzzy ≥0.75, one group per external item); `src/lib/scoring/composite.ts`
  ranks them with per-source normalization curves and half-life decay. Every signal carries
  `license` + `attributionUrl`; the quality gates reject orphans, missing attribution, bad values,
  and >30d-stale entries. Papers with Code (shut down mid-2025) and LMArena (no public API) were
  evaluated and deliberately excluded. `/api/signals.json` consumes this. **The momentum index
  is off the homepage**: it ranked on cumulative GitHub stars from the only five repos with
  signals, so it was "all-time popularity" mislabelled "last 7 days". Do not restore it until
  it ranks on *deltas* (stars/downloads gained in the window) using
  `snapshots/external-history/`.
- Retained news tags and external signals are sanitized against the current catalog on every
  enrichment run, including news interval/API-key skips. The final `pnpm gate` runs only after
  news, weights, and signals have refreshed; orphaned enrichment IDs cannot be committed.
- `scripts/sync-weights.ts` refreshes `snapshots/latest/weights.json` once a day (licences
  change on the order of months; a pass is ~140 per-repo requests against HF's anonymous
  budget of 500 per 300s). It **merges** rather than replaces, so a repo that fails to
  resolve keeps its last known licence instead of vanishing from the site, and a failed run
  keeps the previous file entirely. The `weights-integrity` gate hard-fails on an unknown
  classification, a missing card URL or an implausible parameter count;
  `weights-orphan`/`weights-stale` are warnings.
- **Weights resolution is deliberately stricter than popularity resolution.** A wrong repo
  means a wrong licence, so `hf-weights.ts` rejects community re-uploads (quantisations,
  GGUF/AWQ conversions, merges), requires `repoMatchesModel()` equality rather than the
  substring containment the signals resolver allows, cross-checks declared parameters against
  any size in the model name, and refuses to let one repo back two groups. Rejected records
  are **purged**, not merely skipped — keeping a stored one would preserve the licence we just
  disproved. This drops roughly a quarter of matches; that is the intended trade.
- `scripts/news.ts` builds a bounded Tavily query plan from the five most recently active
  canonical models, fresh external-signal leaders, up to three recent releases, and three
  generic market queries. It scores results by source quality, recency, vertical relevance and
  model linkage, dedupes URLs, and tags items with canonical model IDs for `/m/<id>` deep links.
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

- **Homepage is seven decision-led modules, deliberately.** Daily lede + model lookup → three
  decision entry points → market pulse (labs | street | wire) → same model different price →
  independently measured value → self-host or buy → weekly digest. Raw statistics, generic news
  and machine interfaces stay on their dedicated pages or in the footer. Adding a module needs a
  question no existing module answers. The previous dashboard-style versions repeated events and
  made visitors process the database before helping them decide.
- **`/self-host` is the decision tool; the homepage module is its headline.** The module states
  the threshold in *dollars of API spend* rather than tokens, because the rent already is the
  break-even and a bill is a unit readers can act on — "2.5B tokens/mo" was arithmetic they had
  to finish themselves. The page (`src/app/self-host/page.tsx` +
  `src/components/self-host-table.tsx`) takes a monthly volume and gives a per-model verdict.
- **The verdict is "worth pricing out", never "self-host this"** — see the assumptions below.
- **`self-host or buy` states a floor, never a recommendation** (`src/lib/data/selfhost.ts`).
  Throughput depends on hardware, batch size, quantisation and sequence length, so it is not
  modelled. What is modelled is the rent: the smallest configuration the weights fit on at
  bf16 costs the same idle or saturated, and the API has no fixed cost, so self-hosting cannot
  win below that. The published break-even assumes a permanently saturated GPU — the best case
  for self-hosting — which makes every figure a lower bound. Never restate it as "cheaper to
  self-host above X".
- **`/exchange` is the token-economics view**: instrument baskets, first-party basis, and an
  explicit coverage panel stating how much history stands behind each number. Cross-sectional
  claims (levels, spreads) publish today; longitudinal ones wait for archive depth.
- `/calculator` is the workload tool — pick a profile and a monthly request volume, get a bill.
  The chosen workload persists in localStorage (`model-pulse:workload`) via
  `src/lib/workload-state.ts`, same `useSyncExternalStore` shape as `compare.ts`.
- Static pages: `/compare` (2–4 model diff), `/trends` (market aggregates over `tracked`),
  per-lab feeds at `/feeds/[lab]/rss.xml`. All computed from the same snapshot data.
- `/compare` selection lives in localStorage (`model-pulse:compare`) via `src/lib/compare.ts`
  (`useSyncExternalStore`). Never read it with useState+useEffect — the
  `react-hooks/set-state-in-effect` lint rule rejects that pattern.
- Benchmark boards expose `pointsPerDollar` and `costPerRun` (priced with `costOf` under
  the board's calibrated workload), plus `independent` and `fullyIndependent`; rank with
  `rankableBoards()` / `valueLeaders()`, never `entries`. See `src/lib/data/benchmarks.ts`.
- Model pages lead the provider table with `spreadSummary()` — a generated sentence naming
  the cheapest full-context option and the catch when the outright cheapest has one.

## Deployment (Vercel)

- Project `modelsdevweb` (team `sutraworks-lab`), linked via `.vercel/project.json`.
- **Git integration connected to `nranjan2code/modelsdevweb`** — every push to `main`
  deploys (the old `DEPLOY_HOOK_URL` mechanism was removed from the workflow).
- Secrets: GitHub Actions secret `TAVILY_API_KEY`; Vercel env `NEXT_PUBLIC_SITE_URL`,
  optional Vercel `TAVILY_API_KEY`. Local dev uses `.env.local` (gitignored).

## Verify after changes

```bash
pnpm lint && npx tsc --noEmit && pnpm test && pnpm check:style
pnpm gate --offline                              # data invariants over committed snapshots
vercel ls                                        # deployment status
gh run list --limit 3                            # sync workflow health
```

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
