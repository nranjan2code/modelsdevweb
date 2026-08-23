/**
 * Commercial relationships, kept structurally separate from everything that
 * ranks, prices or recommends.
 *
 * The site's only durable asset is that its orderings are trustworthy. A
 * referral programme is the natural revenue for a page that already tells a
 * reader "buy this model at Eden AI for $0.039" — it is bottom-funnel and
 * qualified — and it is also the single fastest way to destroy the asset. The
 * moment a ranking can read who pays, every ranking becomes suspect, including
 * the honest ones.
 *
 * So the rule is architectural, not a promise:
 *
 *   **No module under `src/lib/data/`, `src/lib/economics/`, `src/lib/scoring/`
 *   or `src/lib/pipeline/` may import this file.** `pnpm check:style` fails the
 *   build if one does. Ranking code cannot see commercial status because it
 *   cannot reach it.
 *
 * Presentation is where a partner link may appear, after the ordering is
 * already fixed, and always with disclosure. A partner is never promoted into a
 * position it did not earn, and a non-partner is never demoted.
 *
 * The registry is empty. It exists so that when the first relationship is
 * signed, the shape of the answer is already decided and nobody has to
 * improvise it under commercial pressure.
 */

export interface Partner {
  /** Provider id as it appears in the catalog — the join key. */
  providerId: string;
  /** Where the referral link points. */
  href: string;
  /**
   * What the reader is told, verbatim, next to the link. Not optional: an
   * undisclosed affiliate link is the thing this whole module exists to avoid.
   */
  disclosure: string;
}

/**
 * Signed referral relationships. Empty by design — adding an entry changes what
 * a link says and where it points, and nothing else.
 */
const PARTNERS: Record<string, Partner> = {};

export function partnerFor(providerId: string): Partner | null {
  return PARTNERS[providerId] ?? null;
}

export function hasPartners(): boolean {
  return Object.keys(PARTNERS).length > 0;
}

/**
 * The standing disclosure, shown wherever any partner link is rendered even if
 * the reader never clicks one. Placement is a layout decision; the wording is
 * not.
 */
export const STANDING_DISCLOSURE =
  "Some provider links are referral links. They never affect prices, rankings, or which provider we recommend — those are computed before commercial status is known.";
