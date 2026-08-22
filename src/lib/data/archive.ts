import { readFile } from "node:fs/promises";
import path from "node:path";

/**
 * The permanent price archive.
 *
 * Full daily snapshots are bulky and get pruned, which capped price history at
 * a fortnight and made every longitudinal claim on the site impossible. This
 * file is the compacted, append-only alternative: one row per model per day,
 * never pruned. It is the only asset here that compounds — six months of it
 * answers "what has actually happened to the cost of frontier intelligence?",
 * and that question cannot be answered retroactively.
 *
 * Columnar layout keeps it small: dates are stored once, and each model holds
 * parallel arrays indexed against them, with null for days it was not listed.
 */

export const ARCHIVE_FILE = path.join("snapshots", "price-archive.json");

export interface ArchivedModel {
  /** Display name at the most recent observation. */
  name: string;
  labId: string;
  /** Best (lowest blended) input price per date index; null when unlisted. */
  in: (number | null)[];
  out: (number | null)[];
  /** Live provider count per date index. */
  n: (number | null)[];
}

export interface PriceArchive {
  /** Ascending ISO dates; every model's arrays are indexed against this. */
  dates: string[];
  models: Record<string, ArchivedModel>;
}

export const EMPTY_ARCHIVE: PriceArchive = { dates: [], models: {} };

/** Structural shape the archive needs from a catalog group. */
export interface GroupLike {
  id: string;
  name: string;
  labId: string;
  free: boolean;
  best: { input: number; output: number } | null;
  listings: { status: string | null }[];
}

export interface ArchiveObservation {
  id: string;
  name: string;
  labId: string;
  input: number | null;
  output: number | null;
  providers: number;
}

/**
 * Append one day of observations. Re-running for a date already present
 * overwrites that column, so an hourly sync converges on the day's latest
 * reading instead of growing a row per run.
 */
export function appendDay(
  archive: PriceArchive,
  date: string,
  observations: ArchiveObservation[],
): PriceArchive {
  const dates = [...archive.dates];
  let col = dates.indexOf(date);
  if (col === -1) {
    // Dates only ever move forward; a late arrival is inserted in order so the
    // series stays monotonic for charting.
    col = dates.findIndex((d) => d > date);
    if (col === -1) {
      dates.push(date);
      col = dates.length - 1;
    } else {
      dates.splice(col, 0, date);
    }
  }
  const inserted = archive.dates.length !== dates.length;

  const models: Record<string, ArchivedModel> = {};
  const pad = (arr: (number | null)[]): (number | null)[] => {
    const next = [...arr];
    if (inserted) next.splice(col, 0, null);
    while (next.length < dates.length) next.push(null);
    return next;
  };
  for (const [id, m] of Object.entries(archive.models)) {
    models[id] = { ...m, in: pad(m.in), out: pad(m.out), n: pad(m.n) };
  }

  const blank = (): (number | null)[] => new Array(dates.length).fill(null);
  for (const o of observations) {
    const existing = models[o.id];
    const row: ArchivedModel = existing
      ? { ...existing, name: o.name, labId: o.labId }
      : { name: o.name, labId: o.labId, in: blank(), out: blank(), n: blank() };
    row.in[col] = o.input;
    row.out[col] = o.output;
    row.n[col] = o.providers;
    models[o.id] = row;
  }

  return { dates, models };
}

export interface SeriesPoint {
  date: string;
  input: number | null;
  output: number | null;
  providers: number;
}

/** Expand one model's columns back into dated points, dropping unlisted days. */
export function seriesOf(archive: PriceArchive, id: string): SeriesPoint[] {
  const m = archive.models[id];
  if (!m) return [];
  const out: SeriesPoint[] = [];
  for (let i = 0; i < archive.dates.length; i++) {
    if (m.in[i] == null && m.out[i] == null) continue;
    out.push({
      date: archive.dates[i],
      input: m.in[i],
      output: m.out[i],
      providers: m.n[i] ?? 0,
    });
  }
  return out;
}

/** One archive row per model that is live today and has a real price. */
export function toObservations(groups: GroupLike[]): ArchiveObservation[] {
  const out: ArchiveObservation[] = [];
  for (const g of groups) {
    const live = g.listings.filter((l) => l.status !== "deprecated");
    if (live.length === 0) continue;
    if (!g.best && !g.free) continue;
    out.push({
      id: g.id,
      name: g.name,
      labId: g.labId,
      input: g.best?.input ?? (g.free ? 0 : null),
      output: g.best?.output ?? (g.free ? 0 : null),
      providers: live.length,
    });
  }
  return out;
}

let cache: PriceArchive | null = null;

export async function getPriceArchive(): Promise<PriceArchive> {
  if (cache) return cache;
  try {
    const buf = await readFile(path.join(process.cwd(), ARCHIVE_FILE), "utf8");
    const parsed = JSON.parse(buf) as Partial<PriceArchive>;
    cache = {
      dates: Array.isArray(parsed.dates) ? parsed.dates : [],
      models: parsed.models ?? {},
    };
  } catch {
    cache = EMPTY_ARCHIVE;
  }
  return cache;
}

/** How many distinct days the archive covers — gates every longitudinal claim. */
export function archiveDepth(archive: PriceArchive): number {
  return archive.dates.length;
}
