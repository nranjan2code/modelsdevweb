import { readFile } from "node:fs/promises";
import path from "node:path";
import { buildIdentityIndex, isGenericModelId } from "../pipeline/identity";
import { normalizeApi, normalizeModels, unlistedPrice } from "../pipeline/normalize";
import type { GroupFacts } from "../pipeline/quality";
import type { CanonicalModel, Cost, Event, Listing, NewsItem, Provider, VerifiedOffer } from "../pipeline/types";
import { DEFAULT_WORKLOAD, ratePerMillion, type Workload } from "../economics/workload";
import { rawApi, rawModels } from "../pipeline/schema";

const LATEST = () => path.join(process.cwd(), "snapshots", "latest");

export interface BestPrice {
  input: number;
  output: number;
  cacheRead: number | null;
  /**
   * The whole rate card, not just the headline pair — tiers and cache terms are
   * what `costOf` needs, and a group-level figure that drops them is the scalar
   * price this codebase no longer publishes.
   */
  cost: Cost;
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
  /**
   * Lab-attributed models at least one provider still serves. `models` includes
   * groups every provider has withdrawn, which are kept for the record but are
   * not something anyone can buy — the headline count uses this.
   */
  activeModels: number;
  /** Tracked models with no live listing anywhere. */
  retiredModels: number;
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

/**
 * Ranking key for a group, under a named workload. Replaces the old fixed 3:1
 * input:output blend — that constant was a chat workload asserted site-wide,
 * and it inverted for anything that reasons or retrieves.
 */
export function groupRate(g: ModelGroup, w: Workload = DEFAULT_WORKLOAD): number {
  return g.best ? ratePerMillion(g.best.cost, w) : Number.POSITIVE_INFINITY;
}

/** Active listings, kept as a helper so counts never silently include sunsets. */
export function liveListings(g: ModelGroup): Listing[] {
  return g.listings.filter((l) => l.status !== "deprecated");
}

/** A provider is an organisation; one provider may publish several endpoint variants. */
export function providerCount(g: ModelGroup): number {
  return new Set(liveListings(g).map((l) => l.providerId)).size;
}

/** Providers with at least one real, published input/output price pair. */
export function pricedProviderCount(g: ModelGroup): number {
  return new Set(
    liveListings(g)
      .filter((l) => l.cost.input != null && l.cost.output != null && !unlistedPrice(l.cost))
      .map((l) => l.providerId),
  ).size;
}

/** True input-price minimum; distinct from the workload-blended cheapest listing. */
export function lowestInputListing(g: ModelGroup): Listing | null {
  return (
    liveListings(g)
      .filter((l) => l.cost.input != null && !unlistedPrice(l.cost))
      .sort((a, b) => a.cost.input! - b.cost.input!)[0] ?? null
  );
}

/** True output-price minimum; distinct from the workload-blended cheapest listing. */
export function lowestOutputListing(g: ModelGroup): Listing | null {
  return (
    liveListings(g)
      .filter((l) => l.cost.output != null && !unlistedPrice(l.cost))
      .sort((a, b) => a.cost.output! - b.cost.output!)[0] ?? null
  );
}

/**
 * Cheapest live listing under the default workload. Which listing wins is now
 * workload-dependent for tiered models, so callers comparing under a different
 * workload should rank listings themselves rather than trusting `best`.
 */
function bestOf(listings: Listing[]): BestPrice | null {
  let best: BestPrice | null = null;
  let bestRate = Number.POSITIVE_INFINITY;
  for (const l of listings) {
    if (l.status === "deprecated") continue;
    if (unlistedPrice(l.cost)) continue;
    if (l.cost.input == null || l.cost.output == null) continue;
    const rate = ratePerMillion(l.cost, DEFAULT_WORKLOAD);
    if (rate < bestRate) {
      bestRate = rate;
      best = {
        input: l.cost.input,
        output: l.cost.output,
        cacheRead: l.cost.cacheRead,
        cost: l.cost,
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
    best: g.best ? { input: g.best.input, output: g.best.output, listingKey: g.best.listingKey } : null,
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

export interface PipelineStatusItem {
  id: string;
  label: string;
  description: string;
  cadence: string;
  fetchedAt: string | null;
  state: "current" | "scheduled" | "unknown";
}

export interface PipelineStatus {
  runAt: string | null;
  snapshotDate: string | null;
  providers: number;
  listings: number;
  models: number;
  groups: number;
  archiveDays: number;
  events: number;
  newsItems: number;
  externalSignals: number;
  weightedModels: number;
  items: PipelineStatusItem[];
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

/** The public, human-readable view of the last committed data run. */
export async function getPipelineStatus(): Promise<PipelineStatus> {
  const [catalog, meta, newsRaw, weightsRaw, externalRaw, events] = await Promise.all([
    getCatalog(),
    getSnapshotMeta(),
    readJsonFile<{ fetchedAt?: string; items?: unknown[] }>(path.join(process.cwd(), "news", "index.json")),
    readJsonFile<{ fetchedAt?: string; models?: Record<string, unknown> }>(path.join(LATEST(), "weights.json")),
    readJsonFile<{ fetchedAt?: string; signals?: unknown[] }>(path.join(LATEST(), "external-signals.json")),
    getEvents(),
  ]);
  const archive = await readJsonFile<{ dates?: string[] }>(path.join(process.cwd(), "snapshots", "price-archive.json"));

  return {
    runAt: meta.fetchedAt,
    snapshotDate: meta.date,
    providers: catalog.stats.providers,
    listings: catalog.stats.listings,
    models: catalog.stats.models,
    groups: catalog.stats.catalogEntries,
    archiveDays: archive?.dates?.length ?? 0,
    events: events.length,
    newsItems: newsRaw?.items?.length ?? 0,
    externalSignals: externalRaw?.signals?.length ?? 0,
    weightedModels: Object.keys(weightsRaw?.models ?? {}).length,
    items: [
      {
        id: "models",
        label: "Models and prices",
        description: "Provider listings, price cards, capabilities and endpoint status.",
        cadence: "Every hour",
        fetchedAt: meta.fetchedAt,
        state: "current",
      },
      {
        id: "news",
        label: "Model news",
        description: "A curated daily brief, refreshed from the latest market coverage.",
        cadence: "Every 4 hours",
        fetchedAt: newsRaw?.fetchedAt ?? null,
        state: newsRaw?.fetchedAt ? "current" : "unknown",
      },
      {
        id: "weights",
        label: "Open-weight facts",
        description: "Licence, access and parameter facts resolved from model cards.",
        cadence: "Daily",
        fetchedAt: weightsRaw?.fetchedAt ?? null,
        state: weightsRaw?.fetchedAt ? "current" : "unknown",
      },
      {
        id: "signals",
        label: "External signals",
        description: "Hugging Face and GitHub activity, resolved to canonical models.",
        cadence: "Every hour",
        fetchedAt: externalRaw?.fetchedAt ?? null,
        state: externalRaw?.fetchedAt ? "current" : "unknown",
      },
      {
        id: "quality",
        label: "Quality gates",
        description: "Identity, pricing, retirement, enrichment and freshness checks.",
        cadence: "Every run",
        fetchedAt: meta.fetchedAt,
        state: "current",
      },
    ],
  };
}

async function readJsonFile<T>(file: string): Promise<T | null> {
  try {
    return JSON.parse(await readFile(file, "utf8")) as T;
  } catch {
    return null;
  }
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
  const trackedActive = tracked.filter((g) => liveListings(g).length > 0).length;

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
      activeModels: trackedActive,
      retiredModels: tracked.length - trackedActive,
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

let offersCache: VerifiedOffer[] | null = null;

export async function getVerifiedOffers(): Promise<VerifiedOffer[]> {
  if (offersCache) return offersCache;
  try {
    const buf = await readFile(path.join(process.cwd(), "offers", "index.json"), "utf8");
    offersCache = (JSON.parse(buf) as { offers?: VerifiedOffer[] }).offers ?? [];
  } catch {
    offersCache = [];
  }
  return offersCache;
}

export async function getModel(id: string): Promise<ModelGroup | null> {
  const catalog = await getCatalog();
  return catalog.groupById.get(id) ?? null;
}

export interface ProviderRow {
  listing: Listing;
  groupId: string;
  groupName: string;
  /**
   * The model is still served somewhere else. Distinguishes a withdrawal the
   * buyer can route around from one that ends the model.
   */
  availableElsewhere: boolean;
}

export async function getProvider(
  id: string,
): Promise<{ provider: Provider; rows: ProviderRow[] } | null> {
  const catalog = await getCatalog();
  const provider = catalog.providers.find((p) => p.id === id);
  if (!provider) return null;
  const rows: ProviderRow[] = catalog.groups.flatMap((g) => {
    const liveAnywhere = liveListings(g).length > 0;
    return g.listings
      .filter((l) => l.providerId === id)
      .map((l) => ({
        listing: l,
        groupId: g.id,
        groupName: g.name,
        availableElsewhere:
          liveAnywhere && liveListings(g).some((other) => other.providerId !== id),
      }));
  });
  rows.sort(
    (a, b) =>
      (a.listing.cost.input ?? Number.POSITIVE_INFINITY) - (b.listing.cost.input ?? Number.POSITIVE_INFINITY),
  );
  return { provider, rows };
}

export * from "./external";
