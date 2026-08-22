import { readFile } from "node:fs/promises";
import path from "node:path";
import { buildIdentityIndex, isGenericModelId } from "../pipeline/identity";
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
  /** Lab-attributed models — the number the site reports and reasons over. */
  models: number;
  /** Every group including gateway-only variants with no canonical backing. */
  catalogEntries: number;
  labs: number;
  deprecated: number;
  openWeights: number;
  snapshotDate: string | null;
}

export interface Catalog {
  /** Every group, including unattributed gateway-only entries. Browse shows these. */
  groups: ModelGroup[];
  /**
   * Groups backed by a canonical lab entry. Every aggregate on the site —
   * indices, distributions, scorecards, records — runs over these, because
   * unattributed gateway rows carry unreliable metadata and would weight the
   * numbers by how many resellers list a model rather than by model.
   */
  tracked: ModelGroup[];
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

/**
 * Groups with no canonical lab are attributed here rather than to whoever
 * happens to sell them. Crediting `databricks` or `gitlab` as the *lab* behind
 * GPT-5.6 Sol was how resellers ended up on the lab scoreboard.
 */
export const UNATTRIBUTED_LAB = "unattributed";

export function groupListings(
  listings: Listing[],
  canonicalById: Map<string, CanonicalModel>,
  canonicalLabs: Set<string>,
): ModelGroup[] {
  // One real model reaches us under many provider spellings. Resolve each
  // listing to a canonical identity so the catalog counts models, not listings.
  const identity = buildIdentityIndex([...canonicalById.values()], (m) => ({ id: m.id, name: m.name }));

  const map = new Map<string, Listing[]>();
  const canonicalOf = new Map<string, CanonicalModel | null>();
  for (const l of listings) {
    let gid: string;
    let canonical: CanonicalModel | null;
    if (l.canonicalId && canonicalById.has(l.canonicalId)) {
      gid = l.canonicalId;
      canonical = canonicalById.get(l.canonicalId) ?? null;
    } else if (isGenericModelId(l.name, l.modelId)) {
      // "auto" / "default" name a router, not a model — keep them per provider.
      gid = l.key;
      canonical = null;
    } else {
      const { target, slug } = identity.resolve(l.name, l.modelId);
      // No canonical match still merges every provider that spells the model
      // the same way, so unlisted models form one group instead of N.
      gid = target?.id ?? slug;
      canonical = target ?? null;
    }
    canonicalOf.set(gid, canonical);
    const arr = map.get(gid);
    if (arr) arr.push(l);
    else map.set(gid, [l]);
  }

  const groups: ModelGroup[] = [];
  for (const [gid, ls] of map) {
    const canonical = canonicalById.get(gid) ?? canonicalOf.get(gid) ?? null;
    // Cheapest real offer first; listings with no published price ($0/$0 or
    // null upstream) are not offers, so they sort below every priced one
    // instead of heading the table at an apparent price of zero.
    const rank = (l: Listing): number => {
      if (l.status === "deprecated") return 2;
      return l.cost.input == null || unlistedPrice(l.cost) ? 1 : 0;
    };
    const sorted = [...ls].sort((a, b) => {
      const ra = rank(a);
      const rb = rank(b);
      if (ra !== rb) return ra - rb;
      const ia = a.cost.input ?? Number.POSITIVE_INFINITY;
      const ib = b.cost.input ?? Number.POSITIVE_INFINITY;
      return ia - ib;
    });
    const slashLab = gid.includes("/") ? gid.split("/")[0] : null;
    const labKnown = canonical != null || (slashLab != null && canonicalLabs.has(slashLab));
    const labId = canonical?.labId ?? (labKnown && slashLab ? slashLab : UNATTRIBUTED_LAB);
    groups.push({
      id: gid,
      labId,
      labKnown,
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

/**
 * Plausibility ceiling for context windows. Largest real shipping claim is
 * ~10M tokens (Llama 4 Scout); everything observed above this in the wild has
 * been gateway placeholder junk (qiniu-ai published 20M for a 2M model and
 * 99999999 for another). The quality gates warn on ANY claim >= 10M
 * (CONTEXT_REVIEW_THRESHOLD) so a genuinely larger model surfaces for review
 * instead of being silently trusted.
 */
export const IMPLAUSIBLE_CONTEXT_TOKENS = 16_000_000;
/**
 * Gateways sometimes publish typo'd limits (20M where every other provider of
 * the same model says 2M). With enough sources, values far above the group
 * median are treated as single-provider errors rather than truth.
 */
const CONTEXT_OUTLIER_FACTOR = 4;

/** Largest known context window across canonical data and listings, defended
 *  against implausible placeholders and single-provider outliers. */
export function groupContext(g: ModelGroup): number | null {
  const plausible = (v: number | null | undefined): v is number =>
    typeof v === "number" && Number.isFinite(v) && v > 0 && v < IMPLAUSIBLE_CONTEXT_TOKENS;

  let values: number[] = [];
  if (plausible(g.canonical?.limit?.context)) values.push(g.canonical.limit.context);
  for (const l of g.listings) if (plausible(l.limit.context)) values.push(l.limit.context);
  if (values.length === 0) return null;

  if (values.length >= 3) {
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    const median = sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
    const cap = median * CONTEXT_OUTLIER_FACTOR;
    // The median itself always survives its own cap, so this never empties.
    values = values.filter((v) => v <= cap);
  }
  return Math.max(...values);
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
  fetchedAt?: string;
}

export interface SnapshotMetaInfo {
  date: string | null;
  fetchedAt: string | null;
}

let metaCache: SnapshotMetaInfo | null = null;

/** When the current snapshot was pulled — powers "synced Xh ago" freshness stamps. */
export async function getSnapshotMeta(): Promise<SnapshotMetaInfo> {
  if (metaCache) return metaCache;
  try {
    const meta = JSON.parse(await readFile(path.join(LATEST(), "meta.json"), "utf8")) as SnapshotMeta;
    metaCache = { date: meta.date ?? null, fetchedAt: meta.fetchedAt ?? null };
  } catch {
    metaCache = { date: null, fetchedAt: null };
  }
  return metaCache;
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

  const tracked = groups.filter((g) => g.labKnown);

  catalogCache = {
    groups,
    tracked,
    groupById: new Map(groups.map((g) => [g.id, g])),
    providers: providers.sort((a, b) => b.modelCount - a.modelCount),
    labs,
    stats: {
      providers: providers.length,
      listings: listings.length,
      models: tracked.length,
      catalogEntries: groups.length,
      labs: labs.length,
      deprecated: listings.filter((l) => l.status === "deprecated").length,
      openWeights: tracked.filter((g) => g.canonical?.openWeights === true).length,
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

export * from "./external";
