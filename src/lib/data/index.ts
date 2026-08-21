import { readFile } from "node:fs/promises";
import path from "node:path";
import { normalizeApi, normalizeModels, unlistedPrice } from "../pipeline/normalize";
import type { CanonicalModel, Event, Listing, Provider } from "../pipeline/types";
import { rawApi, rawModels } from "../pipeline/schema";

const LATEST = () => path.join(process.cwd(), "snapshots", "latest");

export interface BestPrice {
  input: number;
  output: number;
  cacheRead: number | null;
  providerId: string;
  providerName: string;
  listingKey: string;
}

export interface ModelGroup {
  id: string;
  labId: string;
  name: string;
  canonical: CanonicalModel | null;
  listings: Listing[];
  best: BestPrice | null;
  deprecatedCount: number;
}

export interface Lab {
  id: string;
  modelCount: number;
}

export interface Stats {
  providers: number;
  listings: number;
  models: number;
  labs: number;
  deprecated: number;
  openWeights: number;
  snapshotDate: string | null;
}

export interface Catalog {
  groups: ModelGroup[];
  groupById: Map<string, ModelGroup>;
  providers: Provider[];
  labs: Lab[];
  stats: Stats;
}

export function blendPrice(input: number, output: number): number {
  return (input * 3 + output) / 4;
}

function bestOf(listings: Listing[]): BestPrice | null {
  let best: BestPrice | null = null;
  for (const l of listings) {
    if (l.status === "deprecated") continue;
    if (unlistedPrice(l.cost)) continue;
    if (l.cost.input == null || l.cost.output == null) continue;
    if (!best || blendPrice(l.cost.input, l.cost.output) < blendPrice(best.input, best.output)) {
      best = {
        input: l.cost.input,
        output: l.cost.output,
        cacheRead: l.cost.cacheRead,
        providerId: l.providerId,
        providerName: l.providerName,
        listingKey: l.key,
      };
    }
  }
  return best;
}

function groupListings(listings: Listing[], canonicalById: Map<string, CanonicalModel>): ModelGroup[] {
  const map = new Map<string, Listing[]>();
  for (const l of listings) {
    const gid = l.canonicalId ?? l.key;
    const arr = map.get(gid);
    if (arr) arr.push(l);
    else map.set(gid, [l]);
  }
  const groups: ModelGroup[] = [];
  for (const [gid, ls] of map) {
    const canonical = canonicalById.get(gid) ?? null;
    const sorted = [...ls].sort((a, b) => {
      const pa = a.status === "deprecated" ? 1 : 0;
      const pb = b.status === "deprecated" ? 1 : 0;
      if (pa !== pb) return pa - pb;
      const ia = a.cost.input ?? Number.POSITIVE_INFINITY;
      const ib = b.cost.input ?? Number.POSITIVE_INFINITY;
      return ia - ib;
    });
    groups.push({
      id: gid,
      labId: canonical?.labId ?? gid.split("/")[0],
      name: canonical?.name ?? sorted[0]?.name ?? gid,
      canonical,
      listings: sorted,
      best: bestOf(sorted),
      deprecatedCount: sorted.filter((l) => l.status === "deprecated").length,
    });
  }
  return groups.sort((a, b) => a.id.localeCompare(b.id));
}

let catalogCache: Catalog | null = null;

interface SnapshotMeta {
  date?: string;
}

async function readMeta(): Promise<SnapshotMeta | null> {
  try {
    return JSON.parse(await readFile(path.join(LATEST(), "meta.json"), "utf8")) as SnapshotMeta;
  } catch {
    return null;
  }
}

export async function getCatalog(): Promise<Catalog> {
  if (catalogCache) return catalogCache;
  const [apiBuf, modelsBuf, meta] = await Promise.all([
    readFile(path.join(LATEST(), "api.json"), "utf8"),
    readFile(path.join(LATEST(), "models.json"), "utf8"),
    readMeta(),
  ]);
  const parsedModels = rawModels.parse(JSON.parse(modelsBuf));
  const { models, index } = normalizeModels(parsedModels);
  const canonicalById = new Map(models.map((m) => [m.id, m]));
  const parsedApi = rawApi.parse(JSON.parse(apiBuf));
  const { providers, listings } = normalizeApi(parsedApi, index);

  const groups = groupListings(listings, canonicalById);
  const labMap = new Map<string, number>();
  for (const g of groups) labMap.set(g.labId, (labMap.get(g.labId) ?? 0) + 1);
  const labs: Lab[] = [...labMap.entries()]
    .map(([id, modelCount]) => ({ id, modelCount }))
    .sort((a, b) => b.modelCount - a.modelCount);

  catalogCache = {
    groups,
    groupById: new Map(groups.map((g) => [g.id, g])),
    providers: providers.sort((a, b) => b.modelCount - a.modelCount),
    labs,
    stats: {
      providers: providers.length,
      listings: listings.length,
      models: groups.length,
      labs: labs.length,
      deprecated: listings.filter((l) => l.status === "deprecated").length,
      openWeights: groups.filter((g) => g.canonical?.openWeights === true).length,
      snapshotDate: meta?.date ?? null,
    },
  };
  return catalogCache;
}

let eventsCache: Event[] | null = null;

export async function getEvents(): Promise<Event[]> {
  if (eventsCache) return eventsCache;
  try {
    const buf = await readFile(path.join(process.cwd(), "events", "index.json"), "utf8");
    eventsCache = JSON.parse(buf) as Event[];
  } catch {
    eventsCache = [];
  }
  return eventsCache;
}

export async function getModel(id: string): Promise<ModelGroup | null> {
  const catalog = await getCatalog();
  return catalog.groupById.get(id) ?? null;
}
