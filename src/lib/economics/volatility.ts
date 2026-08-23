/**
 * Price stability, from the permanent archive.
 *
 * A procurement fact, not a trading one: a model that has repriced three times
 * in a month is a different purchase from one that has held its price since
 * launch, even at the same $/M. Nothing here is a forecast — this measures what
 * has already happened and says how little it has seen.
 *
 * Every figure is gated on `MIN_OBSERVATION_DAYS`. With three days of archive
 * the honest output is "not enough history", and that is what this returns; a
 * volatility number computed over two intervals would be a ranking of which
 * models happened to reprice during the window we started watching.
 */

import { seriesOf, type PriceArchive } from "../data/archive";
import { DEFAULT_WORKLOAD, flatCost, ratePerMillion, type Workload } from "./workload";

/**
 * Below this, a stability claim is an artefact of when we started collecting.
 * Matches the index's publication bar for the same reason.
 */
export const MIN_OBSERVATION_DAYS = 14;

/** A move smaller than this is rounding in the upstream feed, not a reprice. */
export const MATERIAL_MOVE = 0.005;

export type Stability = "unchanged" | "steady" | "active" | "unknown";

export interface VolatilityReport {
  id: string;
  /** Days of archive backing this figure. */
  days: number;
  /** Distinct repricings observed. */
  moves: number;
  /** Repricings per 30 days, extrapolated from the observed window. */
  movesPerMonth: number;
  /** Largest single-day move, as a fraction. */
  largestMove: number;
  /** Net change across the whole window. */
  netChange: number;
  stability: Stability;
  /** False when the archive is too short to say anything. */
  ready: boolean;
}

const NOT_READY = (id: string, days: number): VolatilityReport => ({
  id, days, moves: 0, movesPerMonth: 0, largestMove: 0, netChange: 0,
  stability: "unknown", ready: false,
});

export function volatilityOf(
  archive: PriceArchive,
  id: string,
  w: Workload = DEFAULT_WORKLOAD,
): VolatilityReport {
  const series = seriesOf(archive, id).filter((p) => p.input != null && p.output != null);
  if (series.length < MIN_OBSERVATION_DAYS) return NOT_READY(id, series.length);

  const rates = series
    .map((p) => ratePerMillion(flatCost(p.input!, p.output!), w))
    .filter(Number.isFinite);
  if (rates.length < MIN_OBSERVATION_DAYS) return NOT_READY(id, rates.length);

  let moves = 0;
  let largestMove = 0;
  for (let i = 1; i < rates.length; i++) {
    const prev = rates[i - 1];
    if (!(prev > 0)) continue;
    const change = rates[i] / prev - 1;
    if (Math.abs(change) < MATERIAL_MOVE) continue;
    moves++;
    if (Math.abs(change) > Math.abs(largestMove)) largestMove = change;
  }

  const first = rates[0];
  const last = rates[rates.length - 1];
  const days = rates.length;
  const movesPerMonth = (moves / days) * 30;

  return {
    id,
    days,
    moves,
    movesPerMonth,
    largestMove,
    netChange: first > 0 ? last / first - 1 : 0,
    stability: moves === 0 ? "unchanged" : movesPerMonth < 1 ? "steady" : "active",
    ready: true,
  };
}

/** Human label that never overstates what the window supports. */
export function stabilityLabel(r: VolatilityReport): string {
  if (!r.ready) {
    return `Not enough history — ${r.days} of ${MIN_OBSERVATION_DAYS} days needed`;
  }
  switch (r.stability) {
    case "unchanged":
      return `Held its price for all ${r.days} observed days`;
    case "steady":
      return `${r.moves} reprice${r.moves === 1 ? "" : "s"} in ${r.days} days`;
    default:
      return `${r.moves} reprices in ${r.days} days — actively repriced`;
  }
}
