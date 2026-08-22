import type { ModelGroup } from "../../src/lib/data";
import type { ExternalSignal } from "../../src/lib/pipeline/external-types";
import { resolveExternalIds, type ExternalCandidate } from "../../src/lib/pipeline/external-resolver";

const HF_API = "https://huggingface.co/api";
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

  const batches: string[][] = [];
  for (let i = 0; i < mappings.length; i += 50) batches.push(mappings.slice(i, i + 50).map((m) => m.externalId));

  for (const batch of batches) {
    const models = await fetchHFModelsBatch(batch);
    for (const m of models) {
      const mapping = mappings.find((x) => x.externalId.toLowerCase() === m.id.toLowerCase());
      if (!mapping) continue;
      if (!isLanguageModel(m)) continue;

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
    await sleep(250);
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

function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}