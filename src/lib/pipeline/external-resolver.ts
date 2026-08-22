import type { ModelGroup } from "../data";
import type { ExternalSource, EntityMapping } from "./external-types";

/**
 * Manually curated external-id → group-id links. Confidence 1.0 by definition;
 * anything resolvable without this table goes through exact/fuzzy paths below.
 */
const MANUAL_OVERRIDES: Record<ExternalSource, Record<string, string>> = {
  hf: {
    "meta-llama/Llama-3.1-8B-Instruct": "meta-llama/llama-3.1-8b-instruct",
    "meta-llama/Llama-3.3-70B-Instruct": "meta-llama/llama-3.3-70b-instruct",
    "mistralai/Mistral-7B-Instruct-v0.3": "mistralai/mistral-7b-instruct-v0.3",
    "google/gemma-2-27b-it": "google/gemma-2-27b-it",
    "microsoft/Phi-3.5-mini-instruct": "microsoft/phi-3.5-mini-instruct",
  },
  github: {
    "facebookresearch/llama": "meta-llama/llama-3.3-70b-instruct",
    "meta-llama/llama3": "meta-llama/llama-3.1-8b-instruct",
    "mistralai/mistral-src": "mistralai/mistral-7b-instruct-v0.3",
    "google-deepmind/gemma": "google/gemma-2-27b-it",
    "deepseek-ai/DeepSeek-V2": "deepseek/deepseek-v2-chat",
    "zai-org/GLM-4.5": "zai-org/glm-4.5",
    "moonshotai/Kimi-K2": "moonshotai/kimi-k2",
    "QwenLM/Qwen2.5": "qwen/qwen-2.5-72b-instruct",
    "QwenLM/Qwen3": "qwen/qwen3-235b-a22b",
    "allenai/OLMo": "allenai/olmo-2-1124-13b",
    "stability-ai/stablelm": "stabilityai/stable-lm-3b-4e1t",
    "EleutherAI/gpt-neox": "eleutherai/gpt-neox-20b",
  },
};

function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function jaccardTokens(a: string, b: string): number {
  const setA = new Set(normalizeName(a).split("-").filter(Boolean));
  const setB = new Set(normalizeName(b).split("-").filter(Boolean));
  if (setA.size === 0 || setB.size === 0) return 0;
  const intersection = [...setA].filter((x) => setB.has(x)).length;
  return intersection / new Set([...setA, ...setB]).size;
}

export function computeSimilarity(a: string, b: string): number {
  const na = normalizeName(a);
  const nb = normalizeName(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  if (na.includes(nb) || nb.includes(na)) return 0.85;
  return jaccardTokens(a, b);
}

export interface ExternalCandidate {
  id: string;
  name?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Resolve external items to our canonical ModelGroup ids.
 * Precedence: manual override > exact id match > exact normalized-name match >
 * token similarity ≥ 0.75. Each group claims at most one external item so
 * popularity cannot double-count across aliases of the same model.
 */
export function resolveExternalIds(
  source: ExternalSource,
  candidates: ExternalCandidate[],
  groups: ModelGroup[],
): EntityMapping[] {
  const groupById = new Map(groups.map((g) => [g.id.toLowerCase(), g.id]));
  const groupNameToId = new Map<string, string>();
  for (const g of groups) {
    groupNameToId.set(normalizeName(g.name), g.id);
    if (g.canonical) groupNameToId.set(normalizeName(g.canonical.name), g.id);
  }

  const overrides = MANUAL_OVERRIDES[source];
  const mappings: EntityMapping[] = [];
  const claimedGroups = new Set<string>();

  for (const item of candidates) {
    let groupId: string | null = null;
    let confidence = 0;
    let method: EntityMapping["method"] = "fuzzy";

    const manual = overrides[item.id];
    if (manual && groups.some((g) => g.id === manual)) {
      groupId = manual;
      confidence = 1;
      method = "manual";
    } else {
      const byId = groupById.get(item.id.toLowerCase());
      const byName = groupNameToId.get(normalizeName(item.name ?? item.id));
      if (byId) {
        groupId = byId;
        confidence = 1;
        method = "exact";
      } else if (byName) {
        groupId = byName;
        confidence = 0.9;
        method = "exact";
      } else if (item.name) {
        let bestId: string | null = null;
        let bestScore = 0;
        for (const g of groups) {
          const score = Math.max(
            computeSimilarity(item.name, g.name),
            g.canonical ? computeSimilarity(item.name, g.canonical.name) : 0,
          );
          if (score > bestScore) {
            bestScore = score;
            bestId = g.id;
          }
        }
        if (bestId && bestScore >= 0.75) {
          groupId = bestId;
          confidence = bestScore;
        }
      }
    }

    if (groupId && !claimedGroups.has(groupId)) {
      mappings.push({ source, externalId: item.id, groupId, confidence, method, metadata: item.metadata });
      claimedGroups.add(groupId);
    }
  }

  return mappings;
}