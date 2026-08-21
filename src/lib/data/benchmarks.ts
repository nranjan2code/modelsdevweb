import { getCatalog } from "./index";
import type { Benchmark } from "../pipeline/types";

export interface BenchmarkEntry {
  groupId: string;
  groupName: string;
  labId: string;
  score: number;
  metric: string | null;
  source: string | null;
  bestInput: number | null;
  bestOutput: number | null;
}

export interface BenchmarkBoard {
  name: string;
  slug: string;
  metric: string | null;
  entries: BenchmarkEntry[];
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
      const entry: BenchmarkEntry = {
        groupId: g.id,
        groupName: g.name,
        labId: g.labId,
        score: b.score,
        metric: b.metric,
        source: b.source,
        bestInput: best?.input ?? null,
        bestOutput: best?.output ?? null,
      };
      if (arr) arr.push(entry);
      else byName.set(b.name, [entry]);
      if (!metrics.has(b.name)) metrics.set(b.name, b.metric);
    }
  }
  cache = [...byName.entries()]
    .map(([name, entries]) => ({
      name,
      slug: slugify(name),
      metric: metrics.get(name) ?? null,
      entries: entries.sort((a, b) => b.score - a.score),
    }))
    .sort((a, b) => b.entries.length - a.entries.length);
  return cache;
}

export async function getBenchmarkBoard(slug: string): Promise<BenchmarkBoard | null> {
  const boards = await getBenchmarkBoards();
  return boards.find((b) => b.slug === slug) ?? null;
}
