# Model Pulse — Design context

`docs/brand.md` is the binding visual source of truth. This file captures the
implemented design system in the format used by Impeccable.

## Visual direction

The interface is a daylight market desk used at 9:30am on a work laptop: a
reader is scanning a current story, then checking prices and evidence. The
canvas is light and near-neutral; structural ink, compact typography, quiet
hairlines, and small semantic color accents create hierarchy without turning
the product into a loud dashboard.

## Tokens

- Semantic colors live in `src/app/globals.css` as OKLCH tokens: `ink`,
  `paper`, `surface`, `surface-tint`, `accent`, `pos`, `neg`, `warn`, and
  `special`, with soft or strong variants where defined.
- IBM Plex Sans handles body, navigation, headings, and controls.
- IBM Plex Mono handles prices, IDs, dates, labels, and tabular figures.
- Money is ink by default; semantic hues communicate deltas, buyer-positive
  outcomes, costly changes, market machinery, or attention states.
- Borders are quiet hairlines. Depth is restrained and limited to the defined
  hard-shadow tokens for compact controls and transient menus.
- Controls and tags use compact corners; cards use controlled medium corners;
  circular rounding is reserved for status dots.

## Component vocabulary

Use existing primitives before adding new ones:

- `src/components/ui.tsx`: `Badge`, `DeltaChip`, `SectionHead`, `Bar`, and
  `EmptyState`.
- `src/app/globals.css`: `.card`, `.card-flat`, `.card-dashed`, `.press`,
  `.lift`, `.input`, `.pill`, `.mono-label`, `.micro-label`, `.table-base`,
  `.hero-shell`, and `.button-primary`.
- Navigation, search, brand mark, subscribe, tables, charts, and page-specific
  components already establish the remaining patterns.

## Layout and information hierarchy

- The homepage is a publication front page: lead story, wire, gap, boards,
  decision answers, then subscribe.
- The header exposes the product map and model search; the homepage does not
  duplicate that search control.
- Use full-width editorial rules and whitespace to separate modules. Avoid
  nested card grids when a list, table, or bordered section communicates better.
- Dense data views should remain legible through sentence-case labels, mono
  numeric alignment, responsive overflow, and explicit units.
- Mobile navigation is a single horizontally scrollable labeled region.

## Interaction and accessibility

- Focus states are visible and use the semantic accent/ink system.
- Shared controls provide comfortable touch targets and clear disabled states.
- Motion is brief, uses transform/color rather than layout animation, and must
  respect `prefers-reduced-motion`.
- Use semantic headings, landmarks, labels, table semantics, and links with
  explicit destinations.

## Guardrails

- No raw hex colors or Tailwind palette utilities in TSX.
- No decorative gradients, stripe/grid backgrounds, gradient text, colored
  side rails, soft ghost-card shadows, or over-rounded cards.
- No hard-coded market figures in copy when the value can be computed from the
  loaded catalog, board, archive, or snapshot.
- Keep display letter spacing at or above `-0.04em`; keep body measure around
  65–75 characters where prose is meant to be read.
- Preserve the editorial distinction between first-party, street, independent,
  self-reported, unlisted, pending, live, and withdrawn states.

## Verification

After UI changes, run `pnpm lint`, `npx tsc --noEmit`, `pnpm test`,
`pnpm check:style`, and the relevant data gate. For visual changes, verify
desktop fold behavior and narrow-screen overflow before shipping.
