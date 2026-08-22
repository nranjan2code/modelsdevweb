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
| **Personality** | A modern market terminal with an editorial pulse. Precise numbers, human voice, zero corporate gloss. |

## 2. Design language — editorial market terminal

Model Pulse is a **modern editorial data product**: quiet surfaces, precise
hairlines, compact controls, strong typography and restrained depth. The
interface should feel current and trustworthy before it feels decorative.
Colour and motion explain state; they do not compete with the numbers.

Hard rules:

1. **Borders are quiet hairlines** (`black/10`–`black/15`). Strong 2px borders
   are reserved for the primary call to action and exceptional focus states.
2. **Depth is restrained** through the named `shadow-hard*` compatibility
   tokens. Despite their historical names, they now resolve to soft editorial
   elevation; raw Tailwind shadows remain forbidden so depth stays consistent.
3. **Corners are generous but controlled**: `rounded-lg` for compact controls,
   `rounded-xl` for cards/search, and `rounded-full` for status chips only.
4. **No dark mode.** The site is paper-on-light by design; `color-scheme: light`.
5. **Motion is brief and optional**: small lifts at 150ms, with a global
   `prefers-reduced-motion` fallback.

## 3. Color system

### 3.1 Semantic tokens (the only palette)

All colors are defined once in `@theme` in `src/app/globals.css`. Components may
use **only these names** (plus ink-alpha steps) — never raw Tailwind palette
classes (`text-emerald-700`, `bg-blue-50`, …) and never raw hex codes in TSX.

| Token | Value | Role |
|---|---|---|
| `ink` | `#101828` | Text and structural emphasis. The default ink of the site. |
| `paper` | `#f6f7fb` | Page background (body). |
| `surface` | `#ffffff` | Cards, inputs, nav dropdowns. |
| `surface-tint` | `#f0f2f7` | Table headers, footer and quiet controls. |
| `accent` | `#4f46e5` | Brand indigo: links, interactive affordances, primary chart color, focus accents. |
| `pos` | `#047857` | Good for the buyer: price cuts ▼, savings, launches, first-party moves, independently measured scores, pts/$ wins, "Free". |
| `neg` | `#dc2626` | Costly or gone: price hikes ▲, deprecations, errors. |
| `warn` | `#d97706` | Attention, not judgment: capability changes, price-spread multiples, records/superlatives. |
| `special` | `#9333ea` | Market machinery: repricing events/chips, reseller ("street") moves, secondary chart series. |

Soft backgrounds (`-soft`, the 50-level tints) and border alphas exist per hue:

| Hue | base | soft bg | border alpha |
|---|---|---|---|
| accent | `#2563eb` | `bg-accent-soft` (#eff6ff) | `border-accent/30` |
| pos | `#047857` | `bg-pos-soft` (#ecfdf5) | `border-pos/30` |
| neg | `#dc2626` | `bg-neg-soft` (#fef2f2) | `border-neg/30` |
| warn | `#d97706` | `bg-warn-soft` (#fffbeb) | `border-warn/30` |
| special | `#9333ea` | `bg-special-soft` (#faf5ff) | `border-special/30` |

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
- **Ink alpha scale is fixed** to `/35 faint · /45 muted · /60 secondary ·
  /70 strong-secondary` for text, `/10 hairlines · /15 quiet borders · /5
  footer rules` for lines. No other steps.
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

The lockup is `<BrandMark />` + wordmark ("Model Pulse", `font-bold tracking-tight`,
ink). The mark itself uses exactly three brand inks:

- glyph strokes: `ink`
- top bar: `warn` (the amber strike)
- backdrop glow: `accent` at low opacity

Never recolor, outline, rotate or place the mark on busy backgrounds. Clear
space = the height of the amber bar on all sides. The favicon (`/icon.svg`)
mirrors the same construction.

OG images, badges and feeds reuse the same three inks; see
`scripts/og.tsx` / `scripts/badges.ts`.

## 5. Typography

Three fonts, three jobs — nothing else ships:

| Font | Variable | Job |
|---|---|---|
| Inter | `--font-sans` | All body/UI text. |
| JetBrains Mono | `--font-mono` | Numbers, prices, IDs, code, table headers, `.mono-label`. Always with `tabular-nums` when numeric. |
| Inter display | `--font-hand` compatibility alias | Display headings. The alias remains so existing components inherit the modern display treatment. |

Scale (binding):

| Role | Spec |
|---|---|
| Page title (h1) | `text-3xl font-bold tracking-tight sm:text-5xl` (hero may go `leading-[1.08]`) |
| Section head (h2) | `font-hand text-2xl font-bold tracking-tight sm:text-3xl` via `<SectionHead>` |
| Card/board title (h3) | `font-hand text-2xl font-bold` |
| Body | `text-sm` (dense contexts) / `text-base` (prose) |
| Stat value | `font-mono font-bold tabular-nums text-xl`–`4xl` |
| Label / eyebrow | `.mono-label` (11px mono uppercase, tracking `0.08em`, `black/45`) |
| Fine print / attribution | `.micro-label` (10px mono uppercase, tracking `0.05em`, `black/35`) |
| Chip/badge | `<Badge>` internals only — no ad-hoc `text-[Npx]` anywhere else (`check:style` enforces) |

Case rules: headings sentence case; `.mono-label` eyebrows lowercase source
text (CSS uppercases them); buttons sentence case; never ALL CAPS by typing
caps.

## 6. Component vocabulary

Use the shared primitives before writing any bespoke markup:

| Primitive | File | Use for |
|---|---|---|
| `.card` | globals.css | Elevated white panel with quiet border and restrained depth. |
| `.card-flat` | globals.css | Framed panel without shadow (tables, stat tiles, menus). |
| `.card-dashed` | globals.css | Ghost/placeholder frame. |
| `.press` / `.lift` | globals.css | Pressable / hoverable motion. Combine with `.card*`. |
| `.input` | globals.css | All text inputs, selects, native controls. |
| `.pill` | globals.css | Status pill with dot (e.g. "Live · synced 12m ago"). |
| `.mono-label` | globals.css | Eyebrows, field labels, micro-headings. Tone via token class (`text-special`, …). |
| `.micro-label` | globals.css | Attribution lines, axis captions, fine print. |
| `.wavy` (+ tone) | globals.css | Decorative underline on display text. |
| `.table-base` | globals.css | Every data table. |
| `<Badge tone>` | components/ui.tsx | Every chip/tag/count pill. Tones: `neutral·accent·pos·neg·warn·special·muted`. |
| `<DeltaChip>` | components/ui.tsx | Any ▼/▲ percentage delta. |
| `<SectionHead>` | components/ui.tsx | Every section heading + "view all" link. |
| `<Bar>` | components/ui.tsx | Every horizontal meter/mini-bar. |
| `<EmptyState>` | components/ui.tsx | Every empty list/table/message. |

New primitives require an entry here first. If a page needs something none of
these do, extend a primitive — don't fork styling locally.

### 6.1 The lede

The homepage's lead story is the hero and the one place the site makes a claim
rather than reporting a number, so its form is fixed:

- A `.card` with a full-height colour rail on the left edge, keyed to the
  story kind — `pos` for cuts and launches, `neg` for rises and sunsets,
  `special` for reseller moves, `accent` for a quiet week.
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

Buttons have exactly two idioms:

- **Primary CTA** (max one per view): ink fill, surface text, restrained elevation.
- **Secondary CTA**: surface fill, quiet border, ink text.
- Everything else is a link: inline links are `text-accent` (hover `accent-strong`)
  optionally wavy-underlined; trailing-arrow links end in `→`; external in `↗`.

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

## 8. Accessibility floor

- Focus: `:focus-visible` global outline (2px ink, offset 2) — never remove.
- Contrast: `black/45` is the lightest text allowed on `surface`; lighter steps
  (`/35`) only for decorative/redundant info.
- Interactive targets ≥ 28px tall; every icon-only control has `aria-label`.
- Color never carries meaning alone — deltas also carry ▼/▲, removals say "removed".

## 9. Enforcement

`pnpm check:style` greps the source for violations of §3.3, §5 and §6
(raw hexes, palette classes, soft shadows, important-overrides, stray
arbitrary sizes) and fails CI on any hit. Allowlisted files are listed in
`scripts/check-style.ts`. Changing the allowlist requires changing this doc
in the same PR.
