/**
 * How much history the site actually has, so no module claims a window it
 * cannot cover.
 *
 * The failure this exists to prevent: a homepage stat labelled "7-day tape"
 * reading 170 on an event log two days old, where 121 of those events were the
 * first sync's cold-start diff rather than anything the market did. Counting a
 * cold start as news is the same class of error as drawing a flat price index —
 * a real number under a caption that misdescribes it.
 */

import type { Event } from "../pipeline/types";
import { archiveDepth, type PriceArchive } from "./archive";

/**
 * The first sync diffs an empty state against the whole catalog, so its event
 * count is a function of catalog size, not of market activity. Nothing may
 * describe that day as a day of changes.
 */
export const COLD_START_MULTIPLE = 5;

/** Below this many days, a "most repriced" ranking is noise ranked by luck. */
export const MIN_RANKING_DAYS = 7;

export interface Coverage {
  /** Distinct days the event log covers. */
  eventDays: number;
  /** Distinct days the permanent price archive covers. */
  archiveDays: number;
  /** Earliest observed date, or null when there is nothing. */
  since: string | null;
  /** Latest observed date. */
  through: string | null;
  /**
   * The day the log begins, when its volume marks it as a cold-start diff
   * rather than a day of trading. Excluded from every rate and ranking.
   */
  coldStartDate: string | null;
  /** Days of genuine observation, excluding any cold start. */
  observedDays: number;
  /** Enough history for a "most X" ranking to mean anything. */
  rankable: boolean;
}

export function coverage(events: Event[], archive: PriceArchive): Coverage {
  const byDate = new Map<string, number>();
  for (const e of events) byDate.set(e.date, (byDate.get(e.date) ?? 0) + 1);
  const dates = [...byDate.keys()].sort();

  const coldStartDate = detectColdStart(dates, byDate);
  const observed = dates.filter((d) => d !== coldStartDate);

  return {
    eventDays: dates.length,
    archiveDays: archiveDepth(archive),
    since: dates[0] ?? null,
    through: dates[dates.length - 1] ?? null,
    coldStartDate,
    observedDays: observed.length,
    rankable: observed.length >= MIN_RANKING_DAYS,
  };
}

/**
 * The earliest day counts as a cold start when it dwarfs the median of the days
 * after it. Requires at least two later days, so a genuinely busy first day in a
 * short log is never silently discarded.
 */
function detectColdStart(dates: string[], byDate: Map<string, number>): string | null {
  if (dates.length < 3) return null;
  const [first, ...rest] = dates;
  const counts = rest.map((d) => byDate.get(d) ?? 0).sort((a, b) => a - b);
  const mid = Math.floor(counts.length / 2);
  const median = counts.length % 2 === 1 ? counts[mid] : (counts[mid - 1] + counts[mid]) / 2;
  if (!(median > 0)) return null;
  return (byDate.get(first) ?? 0) >= median * COLD_START_MULTIPLE ? first : null;
}

/** Events inside the observation window — cold-start diffs excluded. */
export function observedEvents(events: Event[], c: Coverage): Event[] {
  return c.coldStartDate ? events.filter((e) => e.date !== c.coldStartDate) : events;
}

/** "the last 6 days" / "the last day" — a caption that is always true. */
export function windowLabel(c: Coverage): string {
  if (c.observedDays <= 0) return "no full day yet";
  if (c.observedDays === 1) return "the last day";
  return `the last ${c.observedDays} days`;
}
