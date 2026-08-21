import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { normalizeApi, normalizeModels } from "../pipeline/normalize";
import { rawApi, rawModels } from "../pipeline/schema";

export interface PricePoint {
  date: string;
  input: number | null;
  output: number | null;
  providers: number;
}

let cache: Map<string, PricePoint[]> | null = null;

export async function getAllPriceHistory(): Promise<Map<string, PricePoint[]>> {
  if (cache) return cache;
  const map = new Map<string, PricePoint[]>();
  let snapshotDirs: string[] = [];
  try {
    const entries = await readdir(path.join(process.cwd(), "snapshots"));
    snapshotDirs = entries.filter((n) => /^\d{4}-\d{2}-\d{2}$/.test(n)).sort();
  } catch {
    return map;
  }
  for (const date of snapshotDirs) {
    const dir = path.join(process.cwd(), "snapshots", date);
    try {
      const [apiBuf, modelsBuf] = await Promise.all([
        readFile(path.join(dir, "api.json"), "utf8"),
        readFile(path.join(dir, "models.json"), "utf8"),
      ]);
      const { index } = normalizeModels(rawModels.parse(JSON.parse(modelsBuf)));
      const { listings } = normalizeApi(rawApi.parse(JSON.parse(apiBuf)), index);
      const byCanonical = new Map<string, typeof listings>();
      for (const l of listings) {
        if (!l.canonicalId) continue;
        const arr = byCanonical.get(l.canonicalId);
        if (arr) arr.push(l);
        else byCanonical.set(l.canonicalId, [l]);
      }
      for (const [id, ls] of byCanonical) {
        const live = ls.filter((l) => l.status !== "deprecated");
        const priced = live.filter((l) => l.cost.input != null);
        const best = priced.length > 0 ? priced.reduce((a, b) => (b.cost.input! < a.cost.input! ? b : a)) : null;
        const point: PricePoint = {
          date,
          input: best?.cost.input ?? null,
          output: best?.cost.output ?? null,
          providers: live.length,
        };
        const series = map.get(id);
        if (series) series.push(point);
        else map.set(id, [point]);
      }
    } catch {
      continue;
    }
  }
  cache = map;
  return map;
}

export async function getPriceHistory(canonicalId: string): Promise<PricePoint[]> {
  const all = await getAllPriceHistory();
  return all.get(canonicalId) ?? [];
}
