import type { Event, EventType } from "./types";
import type { ExternalSignal } from "./external-types";
import { CONTEXT_REVIEW_THRESHOLD, contextReview } from "./context-review";

export interface QualityIssue {
  check: string;
  message: string;
}

export interface QualityResult {
  errors: QualityIssue[];
  warnings: QualityIssue[];
  ok: boolean;
}

/** Everything runQuality needs. Structural so fixtures are easy to build in tests. */
export interface QualityInput {
  now: Date;
  snapshotDate: string | null;
  fetchedAt: string | null;
  /** Raw provider→models map as persisted in snapshots/latest/api.json. */
  apiRaw: Record<string, { models?: unknown }>;
  groups: GroupFacts[];
  stats: StatsFacts;
  labIds: string[];
  canonicalLabs: Set<string>;
  canonicalIds: Set<string>;
  events: Event[];
  news: NewsFacts[];
  /** External signals from Hugging Face and GitHub. */
  externalSignals?: ExternalSignal[];
  /** Open-weight licence/gating facts from Hugging Face model cards. */
  weights?: WeightsFactsLike[];
  /** Fresh upstream fetch; when omitted the upstream-completeness check is skipped. */
  liveApiRaw?: Record<string, { models?: unknown }> | null;
}

export interface GroupFacts {
  id: string;
  labId: string;
  labKnown: boolean;
  free: boolean;
  best: { input: number | null; output: number | null; listingKey: string } | null;
  releaseDate: string | null;
  listings: { key: string; canonicalId: string | null; active: boolean; zeroPriced: boolean }[];
}

export interface StatsFacts {
  providers: number;
  listings: number;
  /** Lab-attributed models — what the site publishes as its model count. */
  models: number;
  /** Attributed models at least one provider still serves. */
  activeModels: number;
  /** Every group, attributed or not. */
  catalogEntries: number;
  labs: number;
}

/** Structural view of one weights record, as the gate needs it. */
export interface WeightsFactsLike {
  groupId: string;
  repoId: string;
  licenceClass: string;
  access: string;
  cardUrl: string;
  parameters: number | null;
  fetchedAt: string;
}

export interface NewsFacts {
  id?: unknown;
  title?: unknown;
  url?: unknown;
  publishedAt?: unknown;
  modelIds?: unknown;
}

export const MAX_SNAPSHOT_AGE_HOURS = 26;

/**
 * Lab-attributed groups per upstream canonical model. Healthy is ~1.0 (a few
 * canonical entries have no live listing). The fragmentation bug scored ~6x.
 */
export const IDENTITY_MAX_RATIO = 1.5;
export const IDENTITY_MIN_RATIO = 0.5;
/** Below this many canonical models the ratio is noise, not signal. */
export const IDENTITY_MIN_CANONICAL = 50;
export const NEW_RELEASE_WINDOW_DAYS = 3;
export const EVENT_RETENTION_DAYS = 14;
export const NEWS_MAX_AGE_HOURS = 48;
const MAX_LABS = 64;
const MAX_LISTED = 5;

function isoDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function addDays(iso: string, days: number): string {
  return isoDay(new Date(new Date(`${iso}T00:00:00Z`).getTime() + days * 86_400_000));
}

function* rawListings(apiRaw: Record<string, { models?: unknown }>): Generator<{ pid: string; mid: string; entry: Record<string, unknown> }> {
  for (const [pid, p] of Object.entries(apiRaw)) {
    const models = (p?.models ?? {}) as Record<string, unknown>;
    for (const [mid, entry] of Object.entries(models)) {
      yield { pid, mid, entry: (entry ?? {}) as Record<string, unknown> };
    }
  }
}

function cap(list: string[]): string {
  const shown = list.slice(0, MAX_LISTED).join(", ");
  return list.length > MAX_LISTED ? `${shown} (+${list.length - MAX_LISTED} more)` : shown;
}

/** meta.json must exist and be recent — catches a silently dead hourly sync. */
function checkFreshness(i: QualityInput): QualityIssue[] {
  const out: QualityIssue[] = [];
  if (!i.fetchedAt) {
    out.push({ check: "freshness", message: "snapshots/latest/meta.json missing or unreadable" });
    return out;
  }
  const ageH = (i.now.getTime() - new Date(i.fetchedAt).getTime()) / 3_600_000;
  if (!Number.isFinite(ageH) || ageH < -1) {
    out.push({ check: "freshness", message: `meta.json fetchedAt is invalid or in the future: ${i.fetchedAt}` });
  } else if (ageH > MAX_SNAPSHOT_AGE_HOURS) {
    out.push({ check: "freshness", message: `snapshot is ${Math.round(ageH)}h old (max ${MAX_SNAPSHOT_AGE_HOURS}h) — sync may be silently failing` });
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(i.snapshotDate ?? "")) {
    out.push({ check: "freshness", message: `meta.json date is missing/malformed: ${String(i.snapshotDate)}` });
  }
  return out;
}

/** Every upstream provider/model must exist in the snapshot — catches partial writes and lost syncs. */
function checkUpstreamComplete(i: QualityInput): QualityIssue[] {
  if (!i.liveApiRaw) return [];
  const out: QualityIssue[] = [];
  const snapKeys = new Set<string>();
  for (const [pid, p] of Object.entries(i.apiRaw)) {
    for (const mid of Object.keys((p.models ?? {}) as Record<string, unknown>)) snapKeys.add(`${pid}/${mid}`);
  }
  const missing: string[] = [];
  let total = 0;
  for (const { pid, mid } of rawListings(i.liveApiRaw)) {
    total++;
    if (!snapKeys.has(`${pid}/${mid}`)) missing.push(`${pid}/${mid}`);
  }
  if (missing.length === 0) return out;
  // A handful of new upstream listings is normal drift between hourly syncs;
  // wholesale divergence means the snapshot is broken or the sync silently failed.
  const driftBudget = Math.max(25, Math.ceil(total * 0.01));
  const message = `${missing.length}/${total} upstream listings missing from snapshot: ${cap(missing)}`;
  if (missing.length > driftBudget) out.push({ check: "upstream-complete", message });
  else out.push({ check: "upstream-drift", message: `${message} (within drift budget — next sync will pick them up)` });
  return out;
}

/**
 * The ox-alpha class of bug: a brand-new upstream release must be discoverable
 * via its group's dates (home "freshest", /browse newest sort, API release_date).
 */
function checkNewReleaseVisibility(i: QualityInput): QualityIssue[] {
  const out: QualityIssue[] = [];
  const today = isoDay(i.now);
  const cutoff = addDays(today, -NEW_RELEASE_WINDOW_DAYS);
  const upper = addDays(today, 1);
  const byKey = new Map<string, GroupFacts>();
  for (const g of i.groups) for (const l of g.listings) byKey.set(l.key, g);

  const dropped: string[] = [];
  const undated: string[] = [];
  for (const { pid, mid, entry } of rawListings(i.apiRaw)) {
    const d = typeof entry.release_date === "string" ? entry.release_date : typeof entry.last_updated === "string" ? entry.last_updated : null;
    if (!d || d < cutoff || d > upper) continue;
    const key = `${pid}/${mid}`;
    const group = byKey.get(key);
    if (!group) {
      dropped.push(key);
    } else if (!(group.releaseDate && group.releaseDate >= d)) {
      undated.push(`${key} (listed ${d}, catalog says ${group.releaseDate ?? "nothing"})`);
    }
  }
  if (dropped.length > 0) out.push({ check: "new-release-visibility", message: `recent releases dropped during normalization: ${cap(dropped)}` });
  if (undated.length > 0) out.push({ check: "new-release-visibility", message: `recent releases whose group date predates the listing (would never surface on home/trends/browse): ${cap(undated)}` });
  return out;
}

/** Orphan groups keyed by lowercased modelId must not collide with each other or with canonical ids. */
function checkFragmentation(i: QualityInput): QualityIssue[] {
  const out: QualityIssue[] = [];
  const seen = new Map<string, Set<string>>();
  for (const g of i.groups) {
    const k = g.id.toLowerCase();
    const set = seen.get(k) ?? new Set<string>();
    set.add(g.id);
    seen.set(k, set);
  }
  const dupes: string[] = [];
  for (const ids of seen.values()) {
    if (ids.size > 1) dupes.push([...ids].join(" vs "));
  }
  if (dupes.length > 0) out.push({ check: "fragmentation", message: `same model split into multiple groups (merge broken): ${cap(dupes)}` });

  const unresolved = i.groups.reduce((n, g) => n + g.listings.filter((l) => l.canonicalId == null).length, 0);
  const total = i.stats.listings || 1;
  if (unresolved / total >= 0.95) {
    out.push({ check: "fragmentation", message: `${unresolved}/${total} listings have no canonical mapping — models.dev canonical index may be failing to load` });
  }
  return out;
}

/** Labs must be real labs (canonical prefixes), never provider/gateway fallbacks like "kilo" or "nano-gpt". */
function checkLabHygiene(i: QualityInput): QualityIssue[] {
  const out: QualityIssue[] = [];
  const pseudo = i.labIds.filter((l) => !i.canonicalLabs.has(l));
  if (pseudo.length > 0) {
    out.push({ check: "lab-hygiene", message: `non-lab entries counted as labs (provider fallback leaked into aggregation): ${cap(pseudo)}` });
  }
  if (i.stats.labs !== i.labIds.length) {
    out.push({ check: "lab-hygiene", message: `stats.labs=${i.stats.labs} but ${i.labIds.length} known labs aggregated` });
  }
  if (i.labIds.length > MAX_LABS) {
    out.push({ check: "lab-hygiene", message: `${i.labIds.length} labs exceeds sanity bound of ${MAX_LABS}` });
  }
  const badGroups = i.groups.filter((g) => !g.labId);
  if (badGroups.length > 0) {
    out.push({ check: "lab-hygiene", message: `${badGroups.length} groups have an empty labId` });
  }
  return out;
}

/** Recomputed counts must match published stats — catches normalization drift. */
function checkStatsIntegrity(i: QualityInput): QualityIssue[] {
  const out: QualityIssue[] = [];
  const providers = Object.keys(i.apiRaw).length;
  const listings = i.groups.reduce((n, g) => n + g.listings.length, 0);
  if (i.stats.providers !== providers) out.push({ check: "stats-integrity", message: `stats.providers=${i.stats.providers}, api.json has ${providers}` });
  if (i.stats.listings !== listings) out.push({ check: "stats-integrity", message: `stats.listings=${i.stats.listings}, groups hold ${listings}` });
  const attributed = i.groups.filter((g) => g.labKnown).length;
  if (i.stats.catalogEntries !== i.groups.length) out.push({ check: "stats-integrity", message: `stats.catalogEntries=${i.stats.catalogEntries}, catalog has ${i.groups.length} groups` });
  if (i.stats.models !== attributed) out.push({ check: "stats-integrity", message: `stats.models=${i.stats.models}, ${attributed} groups are lab-attributed` });
  return out;
}

/**
 * Retirement is per-listing, so a model can be withdrawn at one venue and live
 * at another. Two things must never happen: a group's advertised best price
 * coming from an endpoint nobody serves any more, and the site's active-model
 * count including groups every provider has dropped. Both were reachable before
 * the retirement layer existed — the lab pages printed withdrawn endpoints as
 * available providers.
 */
function checkRetirementIntegrity(i: QualityInput): QualityIssue[] {
  const out: QualityIssue[] = [];
  for (const g of i.groups) {
    if (!g.best) continue;
    const backing = g.listings.find((l) => l.key === g.best!.listingKey);
    if (!backing) {
      out.push({ check: "retirement-integrity", message: `${g.id}: best price cites ${g.best.listingKey}, which is not one of its listings` });
    } else if (!backing.active) {
      out.push({ check: "retirement-integrity", message: `${g.id}: best price comes from ${g.best.listingKey}, a withdrawn endpoint` });
    }
  }
  const active = i.groups.filter((g) => g.labKnown && g.listings.some((l) => l.active)).length;
  if (i.stats.activeModels !== active) {
    out.push({ check: "retirement-integrity", message: `stats.activeModels=${i.stats.activeModels}, ${active} attributed groups have a live listing` });
  }
  return out;
}

/**
 * Weights facts drive statements about what a reader may legally ship, so they
 * are held to a stricter standard than popularity signals: every record must
 * point at a model we list, carry its source card for verification, and use a
 * known classification. A wrong licence here is worse than a missing one.
 */
const WEIGHTS_LICENCE_CLASSES = new Set(["permissive", "community", "non-commercial", "unknown"]);
const WEIGHTS_ACCESS_CLASSES = new Set(["open", "gated", "unknown"]);
/** Licence terms change slowly, but a record this old is no longer evidence. */
export const WEIGHTS_MAX_AGE_DAYS = 45;

function checkWeights(i: QualityInput): QualityIssue[] {
  const out: QualityIssue[] = [];
  const facts = i.weights ?? [];
  if (facts.length === 0) return out;
  const groupIds = new Set(i.groups.map((g) => g.id));

  for (const f of facts) {
    if (!groupIds.has(f.groupId)) {
      out.push({ check: "weights-orphan", message: `weights record ${f.repoId} references unknown model ${f.groupId}` });
    }
    if (!WEIGHTS_LICENCE_CLASSES.has(f.licenceClass)) {
      out.push({ check: "weights-integrity", message: `${f.repoId} has unknown licence class "${f.licenceClass}"` });
    }
    if (!WEIGHTS_ACCESS_CLASSES.has(f.access)) {
      out.push({ check: "weights-integrity", message: `${f.repoId} has unknown access class "${f.access}"` });
    }
    // Without the card URL a reader cannot check the licence we summarised.
    if (!f.cardUrl || !/^https:\/\/huggingface\.co\//.test(f.cardUrl)) {
      out.push({ check: "weights-integrity", message: `${f.repoId} is missing a Hugging Face card URL` });
    }
    if (f.parameters != null && (!Number.isFinite(f.parameters) || f.parameters <= 0)) {
      out.push({ check: "weights-integrity", message: `${f.repoId} has implausible parameter count ${f.parameters}` });
    }
    const age = (i.now.getTime() - Date.parse(f.fetchedAt)) / 86_400_000;
    if (!Number.isFinite(age) || age > WEIGHTS_MAX_AGE_DAYS) {
      out.push({ check: "weights-stale", message: `${f.repoId} licence data is ${Math.round(age)}d old` });
    }
  }
  return out;
}

/**
 * Catalog identity: one real model must be one group.
 *
 * Regression guard for the fragmentation bug where provider-side ids keyed the
 * groups, so GPT-5.6 Sol existed 15 times and resellers (databricks, gitlab,
 * venice) were promoted to labs. Two invariants catch any recurrence: the
 * attributed model count has to track the upstream canonical count, and no lab
 * may share an id with a provider.
 */
function checkCatalogIdentity(i: QualityInput): QualityIssue[] {
  const out: QualityIssue[] = [];
  const canonical = i.canonicalIds.size;
  const attributed = i.groups.filter((g) => g.labKnown).length;
  if (canonical >= IDENTITY_MIN_CANONICAL) {
    const ratio = attributed / canonical;
    if (ratio > IDENTITY_MAX_RATIO) {
      out.push({
        check: "catalog-identity",
        message: `${attributed} lab-attributed groups for ${canonical} canonical models (${ratio.toFixed(2)}x) — model grouping is fragmenting`,
      });
    }
    if (ratio < IDENTITY_MIN_RATIO) {
      out.push({
        check: "catalog-identity",
        message: `only ${attributed} lab-attributed groups for ${canonical} canonical models (${ratio.toFixed(2)}x) — grouping is over-merging or canonical load failed`,
      });
    }
  }
  const providerIds = new Set(Object.keys(i.apiRaw));
  const resellerLabs = i.labIds.filter((l) => providerIds.has(l) && !i.canonicalLabs.has(l));
  if (resellerLabs.length > 0) {
    out.push({
      check: "catalog-identity",
      message: `provider ids leaked in as labs: ${cap(resellerLabs)}`,
    });
  }
  return out;
}

/** Free ($0/$0) tiers must be flagged and must not be hidden behind a "no price" state. */
function checkFreeIntegrity(i: QualityInput): QualityIssue[] {
  const out: QualityIssue[] = [];
  for (const g of i.groups) {
    const active = g.listings.filter((l) => l.active);
    const zeros = active.filter((l) => l.zeroPriced);
    const allFree = active.length > 0 && zeros.length === active.length;
    if (allFree && (!g.free || g.best != null)) {
      out.push({ check: "free-integrity", message: `${g.id}: every active listing is $0/$0 but free=${String(g.free)} best=${g.best ? "set" : "null"}` });
    }
    if (g.free && zeros.length === 0) {
      out.push({ check: "free-integrity", message: `${g.id}: marked free but has no active $0/$0 listing` });
    }
    if (g.best && g.best.input === 0 && g.best.output === 0) {
      out.push({ check: "free-integrity", message: `${g.id}: best price is $0/$0 — should be classified as free, not priced` });
    }
  }
  return out;
}

/** Removals describe state that has left the snapshot — their modelKey/canonicalId are absent by definition. */
const REMOVAL_TYPES = new Set<EventType>(["model_removed", "provider_removed"]);

/** Events must be well-formed and reference things that exist in the current snapshot window. */
function checkEvents(i: QualityInput): QualityIssue[] {
  const out: QualityIssue[] = [];
  const keys = new Set(i.groups.flatMap((g) => g.listings.map((l) => l.key)));
  const seen = new Set<string>();
  const dupes: string[] = [];
  const bad: string[] = [];
  const dangling: string[] = [];
  const tomorrow = addDays(isoDay(i.now), 1);
  const oldest = addDays(isoDay(i.now), -EVENT_RETENTION_DAYS);
  for (const e of i.events) {
    if (seen.has(e.id)) dupes.push(e.id);
    seen.add(e.id);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(e.date) || e.date > tomorrow) bad.push(`${e.id}@${e.date}`);
    if (e.date >= oldest) {
      if (REMOVAL_TYPES.has(e.type)) continue;
      if (!keys.has(e.modelKey)) dangling.push(`${e.id}:${e.modelKey}`);
      else if (e.canonicalId != null && !i.canonicalIds.has(e.canonicalId)) dangling.push(`${e.id}:canonical ${e.canonicalId}`);
    }
  }
  if (dupes.length > 0) out.push({ check: "events-integrity", message: `duplicate event ids: ${cap(dupes)}` });
  if (bad.length > 0) out.push({ check: "events-integrity", message: `events with invalid/future dates: ${cap(bad)}` });
  if (dangling.length > 0) out.push({ check: "events-integrity", message: `recent events reference listings/canonicals absent from the snapshot: ${cap(dangling)}` });
  return out;
}

/** News must stay fresh-ish and deep-links must resolve to catalog groups. */
function checkNews(i: QualityInput): QualityIssue[] {
  const out: QualityIssue[] = [];
  const urls = new Map<string, number>();
  const malformed: string[] = [];
  const groupIds = new Set(i.groups.map((g) => g.id));
  const deadLinks: string[] = [];
  let newest: number | null = null;
  for (const n of i.news) {
    const url = typeof n.url === "string" ? n.url : "";
    const title = typeof n.title === "string" ? n.title : "";
    if (!url || !title) malformed.push(String(n.id ?? url ?? "?"));
    if (url) urls.set(url, (urls.get(url) ?? 0) + 1);
    if (typeof n.publishedAt === "string") {
      const t = new Date(n.publishedAt).getTime();
      if (Number.isFinite(t) && (newest == null || t > newest)) newest = t;
      else if (!Number.isFinite(t)) malformed.push(String(n.id ?? url));
    }
    if (Array.isArray(n.modelIds)) {
      for (const id of n.modelIds) {
        if (typeof id === "string" && !groupIds.has(id)) deadLinks.push(id);
      }
    }
  }
  const dupeUrls = [...urls.entries()].filter(([, c]) => c > 1);
  if (dupeUrls.length > 0) out.push({ check: "news-integrity", message: `duplicate news URLs: ${cap(dupeUrls.map(([u]) => u))}` });
  if (malformed.length > 0) out.push({ check: "news-integrity", message: `news items missing title/url/date or with unparseable date: ${cap(malformed)}` });
  if (deadLinks.length > 0) out.push({ check: "news-links", message: `news tagged with model ids that resolve to no catalog group (deep-link chips dead): ${cap([...new Set(deadLinks)])}` });
  if (newest != null) {
    const ageH = (i.now.getTime() - newest) / 3_600_000;
    if (ageH > NEWS_MAX_AGE_HOURS) out.push({ check: "news-integrity", message: `newest news item is ${Math.round(ageH)}h old (max ${NEWS_MAX_AGE_HOURS}h)`, });
  }
  return out;
}

/** External signals must reference valid groups, have licenses, and not be stale. */
const EXTERNAL_SOURCES = new Set(["hf", "github"]);
const EXTERNAL_TYPES = new Set(["downloads", "likes", "trending", "stars", "forks", "paper"]);

function checkExternalSignals(i: QualityInput): QualityIssue[] {
  const out: QualityIssue[] = [];
  const signals = i.externalSignals ?? [];
  if (signals.length === 0) return out;
  const groupIds = new Set(i.groups.map((g) => g.id));
  const maxAge = 30 * 24 * 3600 * 1000;

  for (const s of signals) {
    if (!groupIds.has(s.modelId)) {
      out.push({ check: "external-signal-orphan", message: `${s.source}:${s.signalType} references unknown model ${s.modelId}` });
    }
    if (!s.license) {
      out.push({ check: "external-signal-license", message: `${s.source}:${s.signalType} for ${s.modelId} missing license field` });
    }
    if (!EXTERNAL_SOURCES.has(s.source)) {
      out.push({ check: "external-signal-source", message: `${s.source} is not an allowed external source` });
    }
    if (!EXTERNAL_TYPES.has(s.signalType)) {
      out.push({ check: "external-signal-type", message: `${s.signalType} is not an allowed signal type` });
    }
    if (!Number.isFinite(s.value) || s.value < 0) {
      out.push({ check: "external-signal-value", message: `${s.source}:${s.signalType} for ${s.modelId} has invalid value ${s.value}` });
    }
    if (typeof s.fetchedAt !== "string" || !/^\d{4}-\d{2}-\d{2}T/.test(s.fetchedAt)) {
      out.push({ check: "external-signal-date", message: `${s.source}:${s.signalType} for ${s.modelId} has invalid fetchedAt` });
    } else {
      const age = i.now.getTime() - new Date(s.fetchedAt).getTime();
      if (age > maxAge) {
        out.push({ check: "external-signal-stale", message: `${s.source}:${s.signalType} for ${s.modelId} is ${Math.round(age / 3_600_000)}h old (max ${Math.round(maxAge / 3_600_000)}h)` });
      }
    }
    if (!s.attributionUrl) {
      out.push({ check: "external-signal-attribution", message: `${s.source}:${s.signalType} for ${s.modelId} missing attributionUrl` });
    }
  }
  return out;
}

/** Extreme claims require an exact, sourced decision; new or changed claims fail CI. */
function checkContextSanity(i: QualityInput): QualityIssue[] {
  const out: QualityIssue[] = [];
  for (const { pid, mid, entry } of rawListings(i.apiRaw)) {
    const limit = entry.limit as { context?: unknown } | undefined;
    const ctx = typeof limit?.context === "number" ? limit.context : null;
    if (ctx != null && ctx >= CONTEXT_REVIEW_THRESHOLD) {
      const review = contextReview(pid, mid);
      if (!review) {
        out.push({
          check: "context-sanity",
          message: `${pid}/${mid} claims ${(ctx / 1_000_000).toFixed(0)}M-token context without a sourced review decision`,
        });
      } else if (review.claimedContext !== ctx) {
        out.push({
          check: "context-sanity",
          message: `${pid}/${mid} changed its extreme context claim from ${review.claimedContext} to ${ctx}; review is stale`,
        });
      }
    }
  }
  return out;
}

export function runQuality(input: QualityInput): QualityResult {
  const errors: QualityIssue[] = [];
  const warnings: QualityIssue[] = [];
  const all = [
    ...checkFreshness(input),
    ...checkUpstreamComplete(input),
    ...checkNewReleaseVisibility(input),
    ...checkFragmentation(input),
    ...checkLabHygiene(input),
    ...checkStatsIntegrity(input),
    ...checkRetirementIntegrity(input),
    ...checkFreeIntegrity(input),
    ...checkEvents(input),
    ...checkNews(input),
    ...checkExternalSignals(input),
    ...checkCatalogIdentity(input),
    ...checkWeights(input),
    ...checkContextSanity(input),
  ];
  // News freshness, small upstream drift, and stale retained enrichments are
  // advisory. Broken news links, orphan signals, and unreviewed extreme claims
  // are hard failures because they can render false or dead facts.
  const soft = new Set([
    "news-integrity",
    "upstream-drift",
    "external-signal-stale",
    // A repo we could not resolve this run keeps its last known licence; that
    // is staleness to flag, not a reason to discard a good snapshot.
    "weights-orphan",
    "weights-stale",
  ]);
  for (const issue of all) {
    if (soft.has(issue.check)) warnings.push(issue);
    else errors.push(issue);
  }
  return { errors, warnings, ok: errors.length === 0 };
}
