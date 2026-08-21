import type { CanonicalModel, Cost, Limits, Listing, Modality, Modalities, Provider } from "./types";
import { rawApi, rawModels } from "./schema";

type RawEntry = Record<string, unknown>;

const MODALITIES = new Set<string>(["text", "image", "pdf", "audio", "video"]);

export function str(v: unknown): string | null {
  return typeof v === "string" && v.length > 0 ? v : null;
}

export function bool(v: unknown): boolean {
  return typeof v === "boolean" ? v : false;
}

export function boolOrNull(v: unknown): boolean | null {
  return typeof v === "boolean" ? v : null;
}

export function num(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function normModalities(v: unknown): Modalities {
  const m = (v ?? {}) as RawEntry;
  const pick = (x: unknown): Modality[] =>
    Array.isArray(x) ? x.filter((s): s is Modality => typeof s === "string" && MODALITIES.has(s)) : [];
  return { input: pick(m.input), output: pick(m.output) };
}

function normLimit(v: unknown): Limits {
  const l = (v ?? {}) as RawEntry;
  return { context: num(l.context), output: num(l.output), input: num(l.input) };
}

function normCost(v: unknown): Cost {
  const c = (v ?? {}) as RawEntry;
  return {
    input: num(c.input),
    output: num(c.output),
    cacheRead: num(c.cache_read),
    cacheWrite: num(c.cache_write),
    reasoning: num(c.reasoning),
    inputAudio: num(c.input_audio),
    outputAudio: num(c.output_audio),
    tiers: c.tiers != null || c.context_over_200k != null,
  };
}

export function unlistedPrice(cost: Cost): boolean {
  return cost.input === 0 && cost.output === 0;
}

export function labOf(canonicalId: string): string {
  const i = canonicalId.indexOf("/");
  return i > 0 ? canonicalId.slice(0, i) : canonicalId;
}

export function resolveCanonicalId(providerId: string, modelId: string, index: Set<string>): string | null {
  if (index.has(modelId)) return modelId;
  const joined = `${providerId}/${modelId}`;
  if (index.has(joined)) return joined;
  return null;
}

export function toListing(
  providerId: string,
  providerName: string,
  modelId: string,
  entry: RawEntry,
  canonicalIndex: Set<string>,
): Listing {
  const status = entry.status;
  return {
    key: `${providerId}/${modelId}`,
    providerId,
    providerName,
    modelId,
    canonicalId: resolveCanonicalId(providerId, modelId, canonicalIndex),
    name: str(entry.name) ?? modelId,
    family: str(entry.family),
    description: str(entry.description),
    status:
      status === "alpha" || status === "beta" || status === "deprecated" ? status : null,
    experimental: entry.experimental === true,
    attachment: bool(entry.attachment),
    reasoning: bool(entry.reasoning),
    toolCall: bool(entry.tool_call),
    structuredOutput: boolOrNull(entry.structured_output),
    temperature: entry.temperature !== false,
    openWeights: bool(entry.open_weights),
    knowledge: str(entry.knowledge),
    releaseDate: str(entry.release_date),
    lastUpdated: str(entry.last_updated),
    modalities: normModalities(entry.modalities),
    limit: normLimit(entry.limit),
    cost: normCost(entry.cost),
  };
}

export interface NormalizedApi {
  providers: Provider[];
  listings: Listing[];
}

export function normalizeApi(raw: unknown, canonicalIndex: Set<string>): NormalizedApi {
  const parsed = rawApi.parse(raw);
  const providers: Provider[] = [];
  const listings: Listing[] = [];
  for (const [providerId, p] of Object.entries(parsed)) {
    const models = p.models ?? {};
    providers.push({
      id: providerId,
      name: p.name ?? providerId,
      doc: p.doc ?? null,
      npm: p.npm ?? null,
      api: p.api ?? null,
      env: p.env ?? [],
      modelCount: Object.keys(models).length,
    });
    for (const [modelId, entry] of Object.entries(models)) {
      listings.push(toListing(providerId, p.name ?? providerId, modelId, entry, canonicalIndex));
    }
  }
  return { providers, listings };
}

export function normalizeModels(raw: unknown): { models: CanonicalModel[]; index: Set<string> } {
  const parsed = rawModels.parse(raw);
  const models: CanonicalModel[] = [];
  const index = new Set<string>();
  for (const [id, m] of Object.entries(parsed)) {
    index.add(id);
    models.push({
      id,
      labId: labOf(id),
      name: str(m.name) ?? id,
      description: str(m.description),
      family: str(m.family),
      attachment: boolOrNull(m.attachment),
      reasoning: boolOrNull(m.reasoning),
      toolCall: boolOrNull(m.tool_call),
      structuredOutput: boolOrNull(m.structured_output),
      temperature: boolOrNull(m.temperature),
      openWeights: boolOrNull(m.open_weights),
      knowledge: str(m.knowledge),
      releaseDate: str(m.release_date),
      lastUpdated: str(m.last_updated),
      modalities: m.modalities ? normModalities(m.modalities) : null,
      limit: m.limit ? normLimit(m.limit) : null,
      weights: Array.isArray(m.weights)
        ? m.weights.flatMap((w) => {
            const ww = (w ?? {}) as RawEntry;
            const url = str(ww.url);
            return url ? [{ label: str(ww.label) ?? "Weights", url }] : [];
          })
        : [],
      benchmarks: Array.isArray(m.benchmarks)
        ? m.benchmarks.flatMap((b) => {
            const bb = (b ?? {}) as RawEntry;
            const name = str(bb.name);
            const score = num(bb.score);
            return name != null && score != null
              ? [{ name, score, metric: str(bb.metric), source: str(bb.source) }]
              : [];
          })
        : [],
    });
  }
  return { models, index };
}
