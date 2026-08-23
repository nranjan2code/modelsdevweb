# Model Pulse — Brand & Design System

The single source of truth for how Model Pulse looks. Every page, component,
OG card, badge and feed must follow this guide. `docs/voice.md` covers how we
sound; this document covers how we look. Enforced by `pnpm check:style`.

---

## 1. Brand foundation

| | |
|---|---|
| **Name** | Model Pulse (two words, both capitalized, never "ModelPulse" / "model pulse") |
| **Tagline** | "Every AI model. Every provider. Every change." |
| **One-liner** | The front page of the AI model market — prices, releases and repricings, tracked hourly. |
| **Data source credit** | Always "Built on open data from models.dev" (linked). |
| **Personality** | A trusted market desk for AI infrastructure. Precise, current and editorial without becoming a newspaper pastiche or a trading-terminal costume. |

## 2. Design language — the AI market desk

Model Pulse is a **daylight market desk** for people choosing and buying AI
infrastructure. It combines the scan speed of a price ledger with the hierarchy
of a concise market brief. Surfaces are neutral, type is compact and sturdy,
and signal blue identifies navigation and action. It should feel useful at
9:30am on a work laptop: dense enough to compare, calm enough to read daily.

The visual strategy is restrained: blue occupies less than 10% of most product
surfaces, while semantic colors appear only when the market meaning requires
them. The homepage lede and dark footer provide the stronger brand moments.

Hard rules:

1. **Borders are quiet hairlines** (`black/10`–`black/15`). Strong 2px borders
   are reserved for the primary call to action and exceptional focus states.
2. **Depth is restrained.** Cards are border-led; the named `shadow-hard*`
   compatibility tokens are limited to compact controls and transient menus,
   with an 8px blur ceiling.
3. **Corners are compact and controlled**: `rounded-md` for controls,
   `rounded-lg` for cards/search, and `rounded-full` for status chips only.
4. **Daylight canvas.** The working product is light; the dark ink footer is an
   intentional brand anchor, not a second theme.
5. **Motion is brief and optional**: small lifts at 150ms, with a global
   `prefers-reduced-motion` fallback.

## 3. Color system

### 3.1 Semantic tokens (the only palette)

All colors are defined once in `@theme` in `src/app/globals.css`. Components may
use **only these names** (plus ink-alpha steps) — never raw Tailwind palette
classes (`text-emerald-700`, `bg-blue-50`, …) and never raw hex codes in TSX.

| Token | Value | Role |
|---|---|---|
| `ink` | `oklch(0.22 0.035 255)` | Blue-black text, footer and structural emphasis. |
| `paper` | `oklch(0.975 0.006 250)` | Near-neutral daylight canvas. |
| `surface` | `oklch(1 0 0)` | Tables, panels, inputs and menus. |
| `surface-tint` | `oklch(0.947 0.014 250)` | Table headers, toolbars and quiet panels. |
| `accent` | `oklch(0.52 0.2 258)` | Signal blue: links, selection, primary action and first chart series. |
| `pos` | `oklch(0.47 0.13 155)` | Good for the buyer: price cuts, savings and independently measured value. |
| `neg` | `oklch(0.52 0.19 25)` | Costly or gone: price hikes, errors and deprecations. |
| `warn` | `oklch(0.48 0.12 70)` | Attention without judgment: spreads, records and capability shifts. |
| `special` | `oklch(0.48 0.14 306)` | Market machinery: repricings and reseller moves. |

Soft backgrounds (`-soft`, the 50-level tints) and border alphas exist per hue:

| Hue | base | soft bg | border alpha |
|---|---|---|---|
| accent | signal blue | `bg-accent-soft` | `border-accent/30` |
| pos | buyer green | `bg-pos-soft` | `border-pos/30` |
| neg | cost red | `bg-neg-soft` | `border-neg/30` |
| warn | evidence ochre | `bg-warn-soft` | `border-warn/30` |
| special | market violet | `bg-special-soft` | `border-special/30` |

### 3.2 Meaning is fixed — hue encodes kind, never identity

A color means the same thing everywhere on the site. This table is binding:

| Concept | Treatment |
|---|---|
| Cheaper / cut / savings / Free / launch / pts-$ winner | `pos` text on `pos-soft`, `border-pos/30` |
| Pricier / hike / deprecation / removed-value | `neg` text on `neg-soft`, `border-neg/30` |
| Repriced event / repricings chip / reseller move / secondary series | `special` |
| Capability change / price-spread multiple / record cards | `warn` |
| Context change / new provider / informational events / links / quiet-week lede | `accent` |
| Removals (model/provider left) | neutral gray chip (`black/5` bg, `black/15` border) |
| Capability present / filter active / "on" state in tables | `pos` (present = good for the buyer) |
| Benchmark provenance: `Independent` | `pos` badge |
| Benchmark provenance: `Self-reported` / `Marketplace` / `Unsourced` | `muted` badge — never `neg`; the score is not *wrong*, it is unattributed |
| Charts, two series | pair `accent` + `special`; a binary attribute of one domain is solid vs hollow (`accent` fill vs `surface` fill + `accent` stroke), never a second hue |

Rules that follow:

- **One shade per hue.** Never `emerald-600` vs `emerald-700` side by side; if
  you need emphasis use weight (`font-bold`), not shade.
- **Money values are ink.** Prices render `font-mono tabular-nums text-black`
  by default. `pos`/`neg` colors are reserved for *deltas* (chips, sparklines),
  winners (✓, best-in-row) and explicitly positive labels ("Free"). Links stay
  `accent`. When in doubt: black number, colored delta.
- **Charts use one ramp, not competing hues.** Intensity ramps derive from the
  token via alpha (`bg-accent/20 … bg-accent/90`). Two-series charts pair
  `accent` + `special`. Green in a chart always means the buyer won.
- **Readable text starts at `/60`.** `/35` and `/45` are restricted to
  non-text decoration. Lines use `/5` footer rules, `/10` hairlines and `/15`
  quiet borders.
- **Who moved is encoded, not just written.** First-party boards render on
  `card` (elevated, full weight); reseller boards render on `card-flat` (quiet).
  The hierarchy is structural so it survives being skimmed — a reader
  should see which board matters before reading either.
- **Provenance never uses `neg`.** A self-reported score is unattributed, not
  false. Reserve `neg` for things that cost the buyer money or take a model
  away.

### 3.3 Forbidden forever

Raw hex/rgb in TSX files, Tailwind palette classes (`*-600` etc.), soft
shadows, `!important` color overrides (`!text-*`), teal/cyan/indigo/violet/
slate/gray/stone/lime/yellow/orange/rose/pink/fuchsia/sky/zinc/neutrals*,
new hues without amending this doc first.

\* exception: `neutral` utilities are banned too — use ink alphas.

## 4. Logo & marks

The lockup is `<BrandMark />` + wordmark ("Model Pulse", IBM Plex Sans bold).
The mark is an ink tile containing a white market pulse with a signal-blue peak
and buyer-green terminal point. It represents movement plus a decision, not a
generic analytics chart. Never recolor, outline or rotate it. The favicon
(`/icon.svg`) uses the same geometry.

OG images, badges and feeds reuse the same three inks; see
`scripts/og.tsx` / `scripts/badges.ts`.

## 5. Typography

Three fonts, three jobs — nothing else ships:

| Font | Variable | Job |
|---|---|---|
| IBM Plex Sans | `--font-sans` | Body, navigation, controls and headings. |
| IBM Plex Mono | `--font-mono` | Prices, IDs, dates, table headers and `.mono-label`. Always use `tabular-nums` for numeric data. |
| IBM Plex Sans | `--font-hand` compatibility alias | Keeps existing display hooks on the same product family. |

Scale (binding):

| Role | Spec |
|---|---|
| Page title (h1) | `text-3xl font-bold tracking-tight sm:text-4xl` (homepage lede may reach `sm:text-5xl`) |
| Section head (h2) | `font-hand text-2xl font-bold tracking-[-0.025em] sm:text-3xl` via `<SectionHead>` |
| Card/board title (h3) | `font-hand text-2xl font-bold` |
| Body | `text-sm` (dense contexts) / `text-base` (prose) |
| Stat value | `font-mono font-bold tabular-nums text-xl`–`4xl` |
| Label / market metadata | `.mono-label` (12px IBM Plex Mono, sentence case, `black/60`) |
| Fine print / attribution | `.micro-label` (12px IBM Plex Sans, sentence case, `black/60`) |
| Chip/badge | `<Badge>` internals only — no ad-hoc `text-[Npx]` anywhere else (`check:style` enforces) |

Case rules: headings, labels and buttons use sentence case; never ALL CAPS by
typing caps.

## 6. Component vocabulary

Use the shared primitives before writing any bespoke markup:

| Primitive | File | Use for |
|---|---|---|
| `.card` | globals.css | Border-led white panel with no decorative shadow. |
| `.card-flat` | globals.css | Framed panel without shadow (tables, stat tiles, menus). |
| `.card-dashed` | globals.css | Ghost/placeholder frame. |
| `.press` / `.lift` | globals.css | Pressable / hoverable motion. Combine with `.card*`. |
| `.input` | globals.css | All text inputs, selects, native controls. |
| `.pill` | globals.css | Status pill with dot (e.g. "Live · synced 12m ago"). |
| `.mono-label` | globals.css | Eyebrows, field labels, micro-headings. Tone via token class (`text-special`, …). |
| `.micro-label` | globals.css | Attribution lines, axis captions, fine print. |
| `.wavy` (+ tone) | globals.css | Compatibility name for the restrained editorial link underline. |
| `.table-base` | globals.css | Every data table. |
| `<SortableTh>` / `<TablePager>` | components/data-table.tsx | Shared sortable headers, result ranges, page sizes and paging controls. |
| `<Badge tone>` | components/ui.tsx | Every chip/tag/count pill. Tones: `neutral·accent·pos·neg·warn·special·muted`. |
| `<DeltaChip>` | components/ui.tsx | Any ▼/▲ percentage delta. |
| `<SectionHead>` | components/ui.tsx | Every section heading + "view all" link. |
| `<Bar>` | components/ui.tsx | Every horizontal meter/mini-bar, with semantic tone and an accessible label. |
| `<EmptyState>` | components/ui.tsx | Every empty list/table/message. |

New primitives require an entry here first. If a page needs something none of
these do, extend a primitive — don't fork styling locally.

### 6.1 The lede

The homepage's lead story is the hero and the one place the site makes a claim
rather than reporting a number, so its form is fixed:

- A quiet bordered surface with no decorative rail, grid or gradient. Story
  kind is carried by the badge — `pos` for cuts and launches, `neg` for rises
  and sunsets, `special` for reseller moves, `accent` for a quiet week.
- Kind badge and sync stamp above; headline at display size; body at
  `text-base`/`sm:text-lg` and never more than two sentences.
- Exactly one story CTA, one changelog link, then the rule disclosure in
  `.micro-label`. The adjacent model lookup turns the claim into a buying action;
  it is not a second editorial story.
- **The rail class is written out, never interpolated.** Tailwind resolves class
  names statically, so `` `bg-${tone}` `` compiles to nothing — map kind → class
  in a lookup object.

### 6.2 Pending states are a component, not an omission

When a view needs more data than exists, render `.card-dashed` with what is
missing, when it arrives, and how much has accumulated. Never render the live
component with degenerate values (a flat sparkline, `▼ 0.0%`, a zeroed bar).
This is a visual rule with a data cause — see `AGENTS.md`, editorial rules.

### 6.3 Navigation exposes the product

- The header shows every user-facing product page directly. Never put core tools
  behind a generic “More” menu or an unlabeled overflow control.
- Links are grouped by user intent: Explore (Models, Compare), Decide
  (Calculator, Self-host), Market (Market pulse, Changes, Deprecations), Evidence
  (Benchmarks, Providers, Methodology), and Follow (Digest, News).
- The brand and model search occupy the utility row; the grouped product map has
  its own quieter navigation band. On narrow screens that complete map scrolls
  horizontally as one continuous, labeled navigation region.
- `aria-current="page"` and the accent-soft active state identify location. Group
  labels organize links but are never interactive controls.

Buttons have exactly two idioms:

- **Primary CTA** (max one per view): signal-blue fill, surface text, no decorative shadow.
- **Secondary CTA**: surface fill, quiet border, ink text.
- Everything else is a link: inline links are `text-accent` (hover `accent-strong`)
  and may use the restrained editorial underline; trailing-arrow links end in
  `→`; external links end in `↗`.

## 7. Data formatting (visual contract)

Numbers are part of the brand. Always:

- Prices: `$1.25/M`, `$0.15/$0.60 /M` (input/output), via `fmtPerM`.
- Deltas: signed percent, `▼` down / `▲` up arrows, one decimal (`▼ 4.2%`).
- Token counts / context: `fmtTokens` (`200K`, `1M`).
- **A ratio and the prices beside it share one basis.** Spread multiples are
  computed on blended price, so the prices shown next to them are blended too —
  printing an input rate beside a blended multiple reads as an arithmetic
  error, because it is one.
- Dates: `fmtDate` (`Aug 22, 2026`); relative time via `fmtAgo` (`3h ago`).
- Missing data is an em dash `—`, never "N/A", never blank.
- All numerals in tables/stat blocks: `font-mono tabular-nums`.

### 7.1 Tables are bounded decision tools

- Every dataset table uses `.data-table-shell`: toolbar, `.data-table-viewport`,
  then the shared `<TablePager>`. Headers remain visible while rows scroll.
- Default to 20 rows and offer 20 / 50 / 100. Never silently slice a dataset or
  render an unbounded catalog. The footer always states the visible range and total.
- Search applies to the row's identifying fields. Columns people compare or rank
  by use `<SortableTh>` with an announced direction; numeric columns align right.
- Empty filters render a full-width explicit message. Mobile tables keep readable
  column widths, scroll horizontally and announce that more columns are available.
- A deliberately small comparison matrix (2–4 models) is the sole pagination
  exception; it still uses the standard shell and bounded viewport.

### 7.2 Charts explain a decision

- Every chart states its measure, time basis and scale. A log scale is named in
  adjacent prose and in accessible chart text; printed values remain the source
  of truth.
- Legends sit with the chart and use both words and marks. Solid versus hollow
  distinguishes weight access; hue alone never carries that distinction.
- Dense SVGs keep a minimum canvas width and scroll horizontally on small
  screens rather than shrinking labels below legibility.
- Price history starts at zero, shows input and output as separate named series,
  and prints current values plus deltas above the plot.
- Scatter plots may highlight a computed efficient frontier, but must also list
  those models as links outside the graphic so the insight is keyboard- and
  screen-reader-accessible.
- The context-price explorer recomputes its Pareto frontier after every basis
  change and slice. It exposes input, output and the documented 75/25 blend;
  every selected dot prints all three prices, context, lab and provider count.
- Text generation is the default workload because transcription, embedding and
  generation context windows are not interchangeable. An explicit “all
  token-priced” slice remains available for expert exploration.
- Market regions are named and bounded in the legend: budget ≤ $0.25/M,
  mainstream $0.25–$3/M and premium ≥ $3/M. They are navigation aids, not
  quality judgments.

## 8. Accessibility floor

- Focus: `:focus-visible` global outline (2px ink, offset 2) — never remove.
- Contrast: `black/60` is the lightest text allowed on `surface`; lighter steps
  are restricted to non-text decoration.
- Interactive targets ≥ 28px tall; every icon-only control has `aria-label`.
- Color never carries meaning alone — deltas also carry ▼/▲, removals say "removed".

## 9. Enforcement

`pnpm check:style` greps the source for violations of §3.3, §5 and §6
(raw hexes, palette classes, soft shadows, important-overrides, stray
arbitrary sizes) and fails CI on any hit. Allowlisted files are listed in
`scripts/check-style.ts`. Changing the allowlist requires changing this doc
in the same PR.
