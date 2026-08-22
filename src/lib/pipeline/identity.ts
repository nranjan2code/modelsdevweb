/**
 * Canonical model identity.
 *
 * models.dev's api.json lets every provider name a model however it likes, so
 * one real model arrives as a dozen strings: "GPT-5.6 Sol", "GPT-5.6 Sol
 * (Azure)", "OpenAI: GPT-5.6 Sol (50% off)", "openai.gpt-5.6-sol",
 * "gpt-5-6-sol", "gpt-5.6-sol@eu". Keying groups off those strings shattered
 * 355 real models into 3,109 catalog entries and promoted resellers
 * (databricks, gitlab, venice) to "labs".
 *
 * The fix is a slug that survives all of that spelling variance while refusing
 * to collapse genuinely different models — "GPT-5.6 Sol Pro" and "GPT-5.6 Sol"
 * must stay apart, so nothing here does prefix or fuzzy matching. Slugs are
 * compared for exact equality only, and a slug claimed by two different
 * canonical models is poisoned rather than guessed at.
 */

/** Region, tier and deployment suffixes providers bolt onto an otherwise identical id. */
const ID_SUFFIX_NOISE =
  /[@:](eu|us|global|latest|preview|stable|v\d+|[a-z]{2}-[a-z]+-\d+)$/i;

/** A leading "<vendor>:" or "<vendor> —" label some gateways prepend to display names. */
const NAME_LABEL_PREFIX = /^[a-z0-9 .+-]{2,20}[:—|]\s*/i;

/**
 * Tokens that identify who is *selling* rather than what is being sold. Stripped
 * only when they lead a name that still has substance behind them.
 */
const VENDOR_TOKENS = new Set([
  "openai", "anthropic", "google", "googleai", "deepmind", "meta", "metaai",
  "mistral", "mistralai", "cohere", "ai21", "amazon", "aws", "bedrock", "azure",
  "microsoft", "nvidia", "alibaba", "qwen", "deepseek", "moonshot", "moonshotai",
  "tencent", "baidu", "zhipu", "zai", "xai", "perplexity", "together", "fireworks",
  "groq", "cerebras", "databricks", "vertex", "vertexai", "openrouter", "novita",
  "hyperbolic", "deepinfra", "sambanova", "inference", "venice", "requesty",
  "digitalocean", "cloudflare", "vercel", "kilo", "nanogpt", "edenai", "ofox",
]);

/** Lowercase alphanumeric reduction — the comparison form. */
function reduce(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/**
 * Strip parentheticals, bracketed asides and vendor labels from a display name.
 * "GPT-5.6 Sol (Azure)" and "OpenAI: GPT-5.6 Sol (50% off)" both reduce to the
 * same core as plain "GPT-5.6 Sol".
 */
export function cleanModelName(name: string): string {
  let s = name
    .replace(/\([^)]*\)/g, " ")
    .replace(/\[[^\]]*\]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const labelled = s.replace(NAME_LABEL_PREFIX, "").trim();
  if (labelled.length >= 3) s = labelled;
  // Drop a leading vendor word only when real name remains behind it:
  // "OpenAI GPT-5.6 Sol" -> "GPT-5.6 Sol", but "Qwen Flash" keeps "Qwen".
  const words = s.split(" ");
  if (words.length >= 3 && VENDOR_TOKENS.has(reduce(words[0]))) {
    const rest = words.slice(1).join(" ");
    if (reduce(rest).length >= 3) s = rest;
  }
  return s.trim();
}

/**
 * Every spelling under which a listing might be recognised, most trustworthy
 * first. Callers try them in order against the canonical slug index.
 */
export function identityCandidates(name: string, modelId: string): string[] {
  const out: string[] = [];
  const push = (v: string) => {
    if (v.length >= 3 && !out.includes(v)) out.push(v);
  };

  push(reduce(cleanModelName(name)));
  push(reduce(name));

  // Provider-scoped ids: "openai/gpt-5.6-sol", "openai.gpt-5.6-sol",
  // "global.openai.gpt-5.6-sol", "databricks-gpt-5-6-sol".
  const bare = modelId.replace(ID_SUFFIX_NOISE, "");
  const tail = bare.split("/").pop() ?? bare;
  push(reduce(tail));
  for (const seg of tail.split(".")) push(reduce(seg));
  push(reduce(bare));

  return out;
}

/**
 * Ids that carry no model identity — router aliases and placeholders. Several
 * unrelated providers ship a model literally called "auto", and merging those
 * into one group invents a model that does not exist.
 */
const GENERIC_IDS = new Set([
  "auto", "default", "router", "latest", "custom", "model", "chat", "base",
  "unknown", "none", "test", "any", "best",
]);

export function isGenericModelId(name: string, modelId: string): boolean {
  const tail = (modelId.split("/").pop() ?? modelId).toLowerCase();
  return GENERIC_IDS.has(tail) || GENERIC_IDS.has(reduce(name));
}

/** A slug claimed by two different canonical models — never auto-merged. */
const AMBIGUOUS = Symbol("ambiguous");
type SlugTarget<T> = T | typeof AMBIGUOUS;

/**
 * Labs publish the same model twice: a stable alias and a dated pin
 * ("anthropic/claude-haiku-4-5" and "anthropic/claude-haiku-4-5-20251001"),
 * which reduce to one slug. That is an alias pair, not an ambiguity — prefer
 * the stable alias so its listings still merge instead of being orphaned.
 */
function aliasPreference(a: string, b: string): "a" | "b" | null {
  const ra = reduce(a);
  const rb = reduce(b);
  if (ra === rb) return "a";
  if (rb.startsWith(ra)) return "a";
  if (ra.startsWith(rb)) return "b";
  return null;
}

export interface IdentityIndex<T> {
  /** Canonical entry for a slug, or null when unknown or ambiguous. */
  lookup(slug: string): T | null;
  /** First candidate slug that resolves, else the strongest candidate. */
  resolve(name: string, modelId: string): { target: T | null; slug: string };
  size: number;
}

/**
 * Build a slug -> canonical index. Each canonical model is registered under its
 * cleaned display name and its id tail. A collision between two *different*
 * canonical models poisons the slug so neither claims it.
 */
export function buildIdentityIndex<T>(
  entries: T[],
  keyOf: (t: T) => { id: string; name: string },
): IdentityIndex<T> {
  const map = new Map<string, SlugTarget<T>>();

  const register = (slug: string, entry: T, id: string) => {
    if (slug.length < 3 || GENERIC_IDS.has(slug)) return;
    const existing = map.get(slug);
    if (existing === undefined) {
      map.set(slug, entry);
      return;
    }
    if (existing === AMBIGUOUS) return;
    const heldId = keyOf(existing as T).id;
    if (heldId === id) return;
    const prefer = aliasPreference(heldId, id);
    if (prefer === "a") return;
    if (prefer === "b") map.set(slug, entry);
    else map.set(slug, AMBIGUOUS);
  };

  for (const entry of entries) {
    const { id, name } = keyOf(entry);
    register(reduce(cleanModelName(name)), entry, id);
    const tail = id.split("/").pop() ?? id;
    register(reduce(tail), entry, id);
  }

  const lookup = (slug: string): T | null => {
    const hit = map.get(slug);
    return hit === undefined || hit === AMBIGUOUS ? null : (hit as T);
  };

  return {
    lookup,
    size: map.size,
    resolve(name: string, modelId: string) {
      const candidates = identityCandidates(name, modelId);
      for (const slug of candidates) {
        const hit = lookup(slug);
        if (hit) return { target: hit, slug };
      }
      return { target: null, slug: candidates[0] ?? reduce(modelId) };
    },
  };
}
