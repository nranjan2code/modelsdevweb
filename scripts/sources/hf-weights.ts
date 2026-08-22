/**
 * Hugging Face weights metadata.
 *
 * Licence and gating live on the individual model endpoint, not the list one,
 * so this fetches per repo. Anonymous reads are capped at 500 requests per
 * 300s window (`ratelimit-policy: q=500;w=300`), which comfortably covers the
 * open-weight models we track at the pacing below.
 *
 * We store facts HF publishes as structured metadata — licence id, gated flag,
 * parameter count, declared base model and languages — never card prose, and
 * every record carries the card URL so the licence text stays authoritative.
 */
import type { ModelGroup } from "../../src/lib/data";
import {
  resolveExternalIds,
  type ExternalCandidate,
} from "../../src/lib/pipeline/external-resolver";
import {
  classifyAccess,
  classifyLicence,
  parametersAgreeWithName,
  repoMatchesModel,
  type WeightsFacts,
} from "../../src/lib/data/weights";
import { HF_API, searchHFModel, similarity } from "./huggingface";

/** Well inside the 500/300s anonymous budget, with headroom for the signals job. */
const REQUEST_SPACING_MS = 350;
const MAX_REPOS = 220;

/**
 * Community re-uploads: quantisations, format conversions and merges. Their
 * licence, size and gating describe the derivative, not the model the lab
 * shipped — `RedHatAI/Apertus-70B-Instruct-2509-quantized.w4a16` reports 11B
 * "parameters" for a 70B model because 4-bit weights pack differently. Reading
 * a licence off one of these is how you tell somebody the wrong thing.
 */
const DERIVATIVE_MARKERS = [
  "quantized", "-gguf", "-awq", "-gptq", "-exl2", "-mlx", "-bnb", "-int4",
  "-int8", "-fp8", "-w4a16", "-w8a8", "-4bit", "-8bit", "-abliterated",
  "-uncensored", "-merge", "-lora", "-distill-",
];

export function isDerivativeRepo(repoId: string): boolean {
  const id = repoId.toLowerCase();
  return DERIVATIVE_MARKERS.some((m) => id.includes(m));
}

/** HF rate-limits anonymous reads; a 429 means abort, not "model not found". */
class RateLimited extends Error {}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface HFModelDetail {
  id: string;
  gated?: string | boolean;
  cardData?: {
    license?: string;
    base_model?: string | string[];
    language?: string | string[];
  };
  safetensors?: { total?: number };
}

async function fetchDetail(repoId: string): Promise<HFModelDetail | null> {
  const res = await fetch(`${HF_API}/models/${repoId}`, {
    signal: AbortSignal.timeout(20_000),
  }).catch(() => null);
  if (!res) return null;
  // Treating a rate-limited run as "everything unresolved" would silently
  // freeze the whole dataset; surface it so the caller keeps the previous file.
  if (res.status === 429) throw new RateLimited("Hugging Face rate limit reached");
  if (!res.ok) return null;
  return (await res.json().catch(() => null)) as HFModelDetail | null;
}

function firstOf(v: string | string[] | undefined): string | null {
  if (Array.isArray(v)) return v[0] ?? null;
  return v ?? null;
}

function listOf(v: string | string[] | undefined): string[] {
  if (Array.isArray(v)) return v.filter((x) => typeof x === "string");
  return typeof v === "string" ? [v] : [];
}

/**
 * Resolve every open-weight model we track to its HF repo and read the facts
 * that decide whether someone can actually use it.
 */
export interface WeightsFetchResult {
  facts: WeightsFacts[];
  /**
   * Groups whose resolved repo contradicted the model, as opposed to simply
   * failing to fetch. The caller must purge these: keeping a previously stored
   * record would preserve exactly the wrong licence we just detected.
   */
  rejected: string[];
}

export async function fetchWeightsFacts(groups: ModelGroup[]): Promise<WeightsFetchResult> {
  const openWeights = groups.filter((g) => g.canonical?.openWeights === true).slice(0, MAX_REPOS);
  if (openWeights.length === 0) return { facts: [], rejected: [] };

  const candidates: ExternalCandidate[] = openWeights.map((g) => ({
    id: g.canonical?.id ?? g.id,
    name: g.canonical?.name ?? g.name,
    metadata: { labId: g.labId },
  }));
  const mappings = resolveExternalIds("hf", candidates, groups);
  const groupOfCandidate = new Map(mappings.map((m) => [m.externalId, m.groupId]));

  const out: WeightsFacts[] = [];
  const fetchedAt = new Date().toISOString();
  let misses = 0;
  let derivatives = 0;
  let looseMatches = 0;
  const rejected: string[] = [];
  // A repo describes exactly one model. Letting GLM-4.6V-Flash back GLM-4.6,
  // GLM-4.6V and GLM-4.6V-Flash at once published one licence as three facts.
  const claimedRepos = new Set<string>();

  try {
  for (const mapping of mappings) {
    let detail = await fetchDetail(mapping.externalId);

    // Canonical ids rarely match HF repo casing/namespace, so fall back to the
    // same validated search the signals job uses.
    if (!detail) {
      const group = groups.find((g) => g.id === mapping.groupId);
      const found = group ? await searchHFModel(group.canonical?.name ?? group.name) : null;
      if (found && similarity(found.id, group?.name ?? "") >= 0.8) {
        detail = await fetchDetail(found.id);
      }
    }
    await sleep(REQUEST_SPACING_MS);

    if (!detail) {
      misses++;
      continue;
    }

    const groupId = groupOfCandidate.get(mapping.externalId);
    if (!groupId) continue;
    const group = groups.find((g) => g.id === groupId);

    if (isDerivativeRepo(detail.id)) {
      derivatives++;
      rejected.push(groupId);
      continue;
    }
    // Stricter than the popularity resolver on purpose — see repoMatchesModel.
    if (group && !repoMatchesModel(group.name, detail.id)) {
      looseMatches++;
      rejected.push(groupId);
      continue;
    }
    if (claimedRepos.has(detail.id.toLowerCase())) {
      rejected.push(groupId);
      continue;
    }

    const params = typeof detail.safetensors?.total === "number" ? detail.safetensors.total : null;

    // A size mismatch means we resolved a neighbouring repo, which makes the
    // licence we would publish wrong too. Drop the record rather than assert it.
    if (group && parametersAgreeWithName(group.name, params) === false) {
      rejected.push(groupId);
      continue;
    }

    claimedRepos.add(detail.id.toLowerCase());
    const cd = detail.cardData ?? {};
    const licence = cd.license ?? null;
    out.push({
      groupId,
      repoId: detail.id,
      licence,
      licenceClass: classifyLicence(licence),
      access: classifyAccess(detail.gated),
      parameters: params,
      baseModel: firstOf(cd.base_model),
      languages: listOf(cd.language),
      cardUrl: `https://huggingface.co/${detail.id}`,
      fetchedAt,
    });
  }

  } catch (err) {
    if (err instanceof RateLimited) {
      console.warn(`[hf-weights] ${err.message} after ${out.length} model(s) — stopping this run`);
      return { facts: [], rejected: [] };
    }
    throw err;
  }

  console.log(
    `[hf-weights] resolved ${out.length}/${mappings.length} open-weight models ` +
      `(${misses} unresolved, ${derivatives} re-uploads, ${looseMatches} loose name matches, ` +
      `${rejected.length} rejected in total)`,
  );
  return { facts: out, rejected };
}
