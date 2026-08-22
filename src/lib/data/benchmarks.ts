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

let cache: BenchmarkBoard[] | null = null;

export async function getBenchmarkBoards(): Promise<BenchmarkBoard[]> {
  if (cache) return cache;
  const catalog = await getCatalog();
  const byName = new Map<string, BenchmarkEntry[]>();
  const metrics = new Map<string, string | null>();
  for (const g of catalog.groups) {
    const c = g.canonical;
    if (!c) continue;
    const best = g.best;
    for (const b of c.benchmarks as Benchmark[]) {
      const arr = byName.get(b.name);
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
      if (arr) arr.push(entry);
      else byName.set(b.name, [entry]);
      if (!metrics.has(b.name)) metrics.set(b.name, b.metric);
    }
  }
  cache = [...byName.entries()]
    .map(([name, entries]) => {
      const sorted = entries.sort((a, b) => b.score - a.score);
      const independent = sorted.filter((e) => e.provenance === "independent");
      return {
        name,
        slug: slugify(name),
        metric: metrics.get(name) ?? null,
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
