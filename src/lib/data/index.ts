import { readFile } from "node:fs/promises";
import path from "node:path";
import { normalizeApi, normalizeModels, unlistedPrice } from "../pipeline/normalize";
import type { GroupFacts } from "../pipeline/quality";
import type { CanonicalModel, Event, Listing, NewsItem, Provider } from "../pipeline/types";
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
  /** labId comes from the canonical dataset, not a provider-id fallback. */
  labKnown: boolean;
  name: string;
  canonical: CanonicalModel | null;
  listings: Listing[];
  best: BestPrice | null;
  /** Has at least one active listing priced at $0/$0 (genuinely free tier). */
  free: boolean;
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

export function groupListings(
  listings: Listing[],
  canonicalById: Map<string, CanonicalModel>,
  canonicalLabs: Set<string>,
): ModelGroup[] {
  const map = new Map<string, Listing[]>();
  // Case-insensitive canonical lookup: providers spell the same upstream model
  // id differently ("MiniMax-M2" vs "minimax-m2") — they must land in one group.
  const canonicalByLower = new Map<string, CanonicalModel>();
  // Bare gateway ids ("qwen-flash", "hy3") matching the tail segment of exactly
  // one canonical id ("qwen/qwen-flash", "tencent/hy3") resolve to that canonical.
  const canonicalByLowerTail = new Map<string, CanonicalModel>();
  for (const m of canonicalById.values()) {
    canonicalByLower.set(m.id.toLowerCase(), m);
    const segs = m.id.split("/");
    if (segs.length > 1) {
      const tail = segs[segs.length - 1].toLowerCase();
      if (canonicalByLowerTail.has(tail)) canonicalByLowerTail.set(tail, null as unknown as CanonicalModel);
      else canonicalByLowerTail.set(tail, m);
    }
  }
  for (const l of listings) {
    let gid: string;
    if (l.canonicalId) {
      gid = l.canonicalId;
    } else {
      // No canonical entry — merge listings that share the same model id across
      // providers so one real-world model doesn't fragment into N catalog rows.
      const lower = l.modelId.toLowerCase();
      const byExact = canonicalByLower.get(lower);
      const byTail = canonicalByLowerTail.get(lower);
      gid = byExact?.id ?? byTail?.id ?? lower;
    }
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
    const slashLab = gid.includes("/") ? gid.split("/")[0] : null;
    const labId =
      canonical?.labId ??
      (slashLab && canonicalLabs.has(slashLab)
        ? slashLab
        : (sorted.find((l) => l.status !== "deprecated") ?? sorted[0])?.providerId ??
          slashLab ??
          gid);
    groups.push({
      id: gid,
      labId,
      labKnown: canonical != null || (slashLab != null && canonicalLabs.has(slashLab)),
      name: canonical?.name ?? sorted[0]?.name ?? gid,
      canonical,
      listings: sorted,
      best: bestOf(sorted),
      free: sorted.some(
        (l) => l.status !== "deprecated" && l.cost.input === 0 && l.cost.output === 0,
      ),
      deprecatedCount: sorted.filter((l) => l.status === "deprecated").length,
    });
  }
  return groups.sort((a, b) => a.id.localeCompare(b.id));
}

/** Best-known release date: canonical first, then the freshest listing date. */
export function groupReleaseDate(g: ModelGroup): string | null {
  if (g.canonical?.releaseDate) return g.canonical.releaseDate;
  let latest: string | null = null;
  for (const l of g.listings) {
    const d = l.releaseDate ?? l.lastUpdated;
    if (d && (!latest || d > latest)) latest = d;
  }
  return latest;
}

/** Largest known context window across canonical data and listings. */
export function groupContext(g: ModelGroup): number | null {
  let max = g.canonical?.limit?.context ?? null;
  for (const l of g.listings) {
    if (l.limit.context != null && (max == null || l.limit.context > max)) max = l.limit.context;
  }
  return max;
}

/** Structural view of a group consumed by the data-quality gates. */
export function groupToFacts(g: ModelGroup): GroupFacts {
  return {
    id: g.id,
    labId: g.labId,
    labKnown: g.labKnown,
    free: g.free,
    best: g.best ? { input: g.best.input, output: g.best.output } : null,
    releaseDate: groupReleaseDate(g),
    listings: g.listings.map((l) => ({
      key: l.key,
      canonicalId: l.canonicalId,
      active: l.status !== "deprecated",
      zeroPriced: l.cost.input === 0 && l.cost.output === 0,
    })),
  };
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
  const canonicalLabs = new Set(models.map((m) => m.labId));
  const parsedApi = rawApi.parse(JSON.parse(apiBuf));
  const { providers, listings } = normalizeApi(parsedApi, index);

  const groups = groupListings(listings, canonicalById, canonicalLabs);
  const labMap = new Map<string, number>();
  for (const g of groups) {
    if (!g.labKnown) continue;
    labMap.set(g.labId, (labMap.get(g.labId) ?? 0) + 1);
  }
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

let newsCache: NewsItem[] | null = null;

export async function getNews(): Promise<NewsItem[]> {
  if (newsCache) return newsCache;
  try {
    const buf = await readFile(path.join(process.cwd(), "news", "index.json"), "utf8");
    newsCache = (JSON.parse(buf) as { items?: NewsItem[] }).items ?? [];
  } catch {
    newsCache = [];
  }
  return newsCache;
}

export async function getModel(id: string): Promise<ModelGroup | null> {
  const catalog = await getCatalog();
  return catalog.groupById.get(id) ?? null;
}

export interface ProviderRow {
  listing: Listing;
  groupId: string;
  groupName: string;
}

export async function getProvider(
  id: string,
): Promise<{ provider: Provider; rows: ProviderRow[] } | null> {
  const catalog = await getCatalog();
  const provider = catalog.providers.find((p) => p.id === id);
  if (!provider) return null;
  const rows: ProviderRow[] = catalog.groups.flatMap((g) =>
    g.listings.filter((l) => l.providerId === id).map((l) => ({ listing: l, groupId: g.id, groupName: g.name })),
  );
  rows.sort(
    (a, b) =>
      (a.listing.cost.input ?? Number.POSITIVE_INFINITY) - (b.listing.cost.input ?? Number.POSITIVE_INFINITY),
  );
  return { provider, rows };
}
