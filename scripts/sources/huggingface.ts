import type { ModelGroup } from "../../src/lib/data";
import type { ExternalSignal } from "../../src/lib/pipeline/external-types";
import { resolveExternalIds, type ExternalCandidate } from "../../src/lib/pipeline/external-resolver";

export const HF_API = "https://huggingface.co/api";
/** Batch size cap keeps a single request small; HF caps ?ids= around 100. */
const MAX_MODELS = 90;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface HFModelSummary {
  id: string;
  downloads: number | null;
  likes: number | null;
  trendingScore: number | null;
  pipeline_tag: string | null;
  tags: string[];
}

async function fetchHFModelsBatch(ids: string[]): Promise<HFModelSummary[]> {
  if (ids.length === 0) return [];
  const url = `${HF_API}/models?ids=${encodeURIComponent(ids.join(","))}&limit=${ids.length}`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(20_000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return (await res.json()) as HFModelSummary[];
  } catch (err) {
    console.warn(`[hf] batch fetch failed:`, err instanceof Error ? err.message : err);
    return [];
  }
}

interface HFDailyPaper {
  paper: { id: string; title: string; summary: string; upvotes: number };
}

/**
 * Resolve a model NAME to its real HF repo via the search API. The top hit is
 * accepted only when its id/name is clearly the same model — a wrong match
 * would poison popularity stats, so anything below 0.8 similarity is dropped.
 */
export async function searchHFModel(name: string): Promise<HFModelSummary | null> {
  try {
    const url = `${HF_API}/models?search=${encodeURIComponent(name)}&limit=5&sort=downloads&direction=-1`;
    const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const results = (await res.json()) as HFModelSummary[];
    let best: HFModelSummary | null = null;
    let bestScore = 0;
    for (const r of results) {
      const tail = r.id.split("/").slice(1).join("/") || r.id;
      const score = Math.max(similarity(tail, name), similarity(r.id, name));
      if (score > bestScore) {
        bestScore = score;
        best = r;
      }
    }
    return bestScore >= 0.8 ? best : null;
  } catch (err) {
    console.warn(`[hf] search "${name}" failed:`, err instanceof Error ? err.message : err);
    return null;
  }
}

export function similarity(a: string, b: string): number {
  const na = normalizeName(a);
  const nb = normalizeName(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  if (na.includes(nb) || nb.includes(na)) return 0.9;
  const setA = new Set(na.split("-").filter(Boolean));
  const setB = new Set(nb.split("-").filter(Boolean));
  const inter = [...setA].filter((t) => setB.has(t)).length;
  return inter / new Set([...setA, ...setB]).size;
}

async function fetchHFDailyPapers(): Promise<HFDailyPaper[]> {
  try {
    const res = await fetch(`${HF_API}/daily_papers`, { signal: AbortSignal.timeout(20_000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return (await res.json()) as HFDailyPaper[];
  } catch (err) {
    console.warn(`[hf] daily_papers fetch failed:`, err instanceof Error ? err.message : err);
    return [];
  }
}

function isLanguageModel(m: HFModelSummary): boolean {
  const lmTags = ["text-generation", "conversational"];
  return lmTags.includes(m.pipeline_tag ?? "") || m.tags.some((t) => lmTags.includes(t));
}

/**
 * Popularity + research-buzz signals from the HF Hub.
 * Models are chosen by open-weight presence and provider spread so the batch
 * stays bounded; papers contribute a per-model "paper" signal when a trending
 * paper title mentions the model family.
 */
export async function fetchHFSignals(groups: ModelGroup[]): Promise<ExternalSignal[]> {
  const openWeights = groups.filter((g) => g.canonical?.openWeights === true);
  const wide = [...groups]
    .filter((g) => g.listings.length >= 2 && g.best != null)
    .sort((a, b) => b.listings.length - a.listings.length);
  const pool = [...openWeights, ...wide].slice(0, MAX_MODELS);

  const candidates: ExternalCandidate[] = pool.map((g) => ({
    id: g.canonical?.id ?? g.id,
    name: g.canonical?.name ?? g.name,
    metadata: { labId: g.labId },
  }));
  const mappings = resolveExternalIds("hf", candidates, groups);

  const fetchedAt = new Date().toISOString();
  const signals: ExternalSignal[] = [];

  // First pass: batch fetch by id. HF repo ids are case-sensitive and our
  // canonical ids usually differ, so whatever the batch misses gets resolved
  // by name search below.
  const batches: string[][] = [];
  for (let i = 0; i < mappings.length; i += 50) batches.push(mappings.slice(i, i + 50).map((m) => m.externalId));

  const byMappingId = new Map<string, HFModelSummary>();
  for (const batch of batches) {
    for (const m of await fetchHFModelsBatch(batch)) {
      const mapping = mappings.find((x) => x.externalId.toLowerCase() === m.id.toLowerCase());
      if (mapping) byMappingId.set(mapping.externalId, m);
    }
    await sleep(250);
  }

  // Second pass: resolve misses via HF search (real repo casing), validated by
  // name similarity so we never attach stats from an unrelated repo.
  const missed = mappings.filter((m) => !byMappingId.has(m.externalId));
  for (const mapping of missed.slice(0, 40)) {
    const group = groups.find((g) => g.id === mapping.groupId);
    const name = group?.canonical?.name ?? group?.name ?? "";
    if (!name) continue;
    const found = await searchHFModel(name);
    if (found && !isLanguageModel(found)) continue;
    if (!found) continue;
    byMappingId.set(mapping.externalId, found);
    console.log(`[hf] resolved "${mapping.externalId}" -> ${found.id}`);
    await sleep(250);
  }

  for (const [externalId, m] of byMappingId) {
    const mapping = mappings.find((x) => x.externalId === externalId)!;
    const base = {
      source: "hf" as const,
      modelId: mapping.groupId,
      fetchedAt,
      license: "hub metadata / model-specific",
      attributionUrl: `https://huggingface.co/${m.id}`,
    };
    if ((m.downloads ?? 0) > 0) {
      signals.push({ ...base, signalType: "downloads", value: m.downloads!, metadata: { hfId: m.id } });
    }
    if ((m.likes ?? 0) > 0) {
      signals.push({ ...base, signalType: "likes", value: m.likes!, metadata: { hfId: m.id } });
    }
    if ((m.trendingScore ?? 0) > 0) {
      signals.push({ ...base, signalType: "trending", value: m.trendingScore!, metadata: { hfId: m.id } });
    }
  }

  const papers = await fetchHFDailyPapers();
  if (papers.length > 0) {
    for (const mapping of mappings) {
      const group = groups.find((g) => g.id === mapping.groupId);
      const name = group?.canonical?.name ?? group?.name;
      if (!name) continue;
      const tokens = normalizeName(name).split("-").filter((t) => t.length > 1);
      const mentions = papers.filter((p) => {
        const t = p.paper.title.toLowerCase();
        return tokens.some((tok) => t.includes(tok));
      }).length;
      if (mentions > 0) {
        signals.push({
          source: "hf",
          signalType: "paper",
          modelId: mapping.groupId,
          value: mentions,
          metadata: { window: "daily_papers" },
          fetchedAt,
          license: "paper metadata via HF API",
          attributionUrl: `https://huggingface.co/papers?q=${encodeURIComponent(name)}`,
        });
      }
    }
  }

  return signals;
}

export function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}