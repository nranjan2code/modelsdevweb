import { blendPrice, getCatalog } from "./index";
import { provenanceOf, type Provenance } from "./provenance";
import type { Benchmark } from "../pipeline/types";

export interface BenchmarkEntry {
  groupId: string;
  groupName: string;
  labId: string;
  score: number;
  metric: string | null;
  source: string | null;
  /** Who produced the number — decides whether it can be ranked against others. */
  provenance: Provenance;
  bestInput: number | null;
  bestOutput: number | null;
  pointsPerDollar: number | null;
}

export interface BenchmarkBoard {
  name: string;
  slug: string;
  metric: string | null;
  entries: BenchmarkEntry[];
  /** Entries measured by a third party — the only ones safe to rank. */
  independent: BenchmarkEntry[];
  /**
   * Every score on this board was independently measured, so the ranking is
   * apples to apples. Mixed boards are ranked on their independent subset.
   */
  fullyIndependent: boolean;
}

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function entryPriority(entry: BenchmarkEntry): number {
  return entry.provenance === "independent" ? 1 : 0;
}

/**
 * Upstream sometimes repeats a benchmark under punctuation variants and can
 * publish several runs for one canonical model. A board is a model ranking,
 * so it has one stable route and one row per model. Prefer independently
 * measured observations, then the strongest recorded result within the same
 * provenance class.
 */
function collapseBoardEntries(entries: BenchmarkEntry[]): BenchmarkEntry[] {
  const byGroup = new Map<string, BenchmarkEntry>();
  for (const entry of entries) {
    const current = byGroup.get(entry.groupId);
    if (
      !current ||
      entryPriority(entry) > entryPriority(current) ||
      (entryPriority(entry) === entryPriority(current) && entry.score > current.score)
    ) {
      byGroup.set(entry.groupId, entry);
    }
  }
  return [...byGroup.values()].sort((a, b) => b.score - a.score);
}

let cache: BenchmarkBoard[] | null = null;

export async function getBenchmarkBoards(): Promise<BenchmarkBoard[]> {
  if (cache) return cache;
  const catalog = await getCatalog();
  const bySlug = new Map<string, { name: string; entries: BenchmarkEntry[]; metric: string | null }>();
  for (const g of catalog.groups) {
    const c = g.canonical;
    if (!c) continue;
    const best = g.best;
    for (const b of c.benchmarks as Benchmark[]) {
      const slug = slugify(b.name);
      const board = bySlug.get(slug) ?? { name: b.name, entries: [], metric: b.metric };
      let pointsPerDollar: number | null = null;
      if (best && best.input != null) {
        const blend = blendPrice(best.input, best.output);
        pointsPerDollar = blend <= 0 ? Number.POSITIVE_INFINITY : b.score / blend;
      }
      const entry: BenchmarkEntry = {
        groupId: g.id,
        groupName: g.name,
        labId: g.labId,
        score: b.score,
        metric: b.metric,
        source: b.source,
        provenance: provenanceOf(b.source),
        bestInput: best?.input ?? null,
        bestOutput: best?.output ?? null,
        pointsPerDollar,
      };
      board.entries.push(entry);
      bySlug.set(slug, board);
    }
  }
  cache = [...bySlug.entries()]
    .map(([slug, board]) => {
      const sorted = collapseBoardEntries(board.entries);
      const independent = sorted.filter((e) => e.provenance === "independent");
      return {
        name: board.name,
        slug,
        metric: board.metric,
        entries: sorted,
        independent,
        fullyIndependent: independent.length === sorted.length && sorted.length > 0,
      };
    })
    .sort((a, b) => b.entries.length - a.entries.length);
  return cache;
}

export async function getBenchmarkBoard(slug: string): Promise<BenchmarkBoard | null> {
  const boards = await getBenchmarkBoards();
  return boards.find((b) => b.slug === slug) ?? null;
}

/**
 * Boards worth ranking value on: enough independently-measured entries that the
 * ordering means something. A board of vendor claims is still browsable on its
 * own page, but it never drives a "best value" ranking.
 */
export const MIN_RANKABLE_ENTRIES = 4;

export function rankableBoards(boards: BenchmarkBoard[]): BenchmarkBoard[] {
  return boards
    .filter((b) => b.independent.length >= MIN_RANKABLE_ENTRIES)
    .sort((a, b) => b.independent.length - a.independent.length);
}

/** Independent entries with a real price, ranked by benchmark points per blended dollar. */
export function valueLeaders(board: BenchmarkBoard, limit = 5): BenchmarkEntry[] {
  return board.independent
    .filter((e) => e.pointsPerDollar != null && Number.isFinite(e.pointsPerDollar))
    .sort((a, b) => (b.pointsPerDollar ?? 0) - (a.pointsPerDollar ?? 0))
    .slice(0, limit);
}
