/**
 * What "open weights" actually costs you.
 *
 * The catalog carries `openWeights` as a boolean, which puts Qwen3 (Apache-2.0,
 * download it now) in the same bucket as Llama 3.1 (community licence with a
 * user-count clause, plus a manual access request) and Gemma (custom licence,
 * gated). For anyone making a self-host or build-vs-buy decision that boolean
 * is the least useful true statement available.
 *
 * Hugging Face publishes the two facts that matter — the licence on the model
 * card and whether the repo is gated — and this module turns them into a plain
 * answer. Licence terms are summarised, never reproduced; every model links
 * back to its card for the actual text.
 */

/** How freely the weights can be used, ignoring access mechanics. */
export type LicenceClass = "permissive" | "community" | "non-commercial" | "unknown";

/** How you obtain the weights. Orthogonal to the licence. */
export type AccessClass = "open" | "gated" | "unknown";

/**
 * Licence ids as they appear in HF card metadata. Kept as an explicit list
 * rather than pattern-matching, because guessing wrong here tells someone they
 * may ship a model commercially when they may not.
 */
const PERMISSIVE = new Set([
  "apache-2.0", "mit", "bsd", "bsd-2-clause", "bsd-3-clause", "cc0-1.0",
  "cc-by-4.0", "cc-by-sa-4.0", "unlicense", "isc", "artistic-2.0", "zlib",
  "openrail", "bigscience-openrail-m", "bigcode-openrail-m", "openrail++",
  "gpl-3.0", "lgpl-3.0", "agpl-3.0", "mpl-2.0",
]);

/**
 * Usable commercially but with conditions attached — user-count caps, naming
 * requirements, acceptable-use policies. These are the ones people most often
 * assume are unrestricted.
 */
const COMMUNITY = new Set([
  "llama2", "llama3", "llama3.1", "llama3.2", "llama3.3", "llama4",
  "gemma", "qwen", "qwen-research", "tongyi-qianwen", "yi-license",
  "deepseek", "deepseek-license", "falcon-180b-license", "stabilityai-ai-community",
  "nvidia-open-model-license", "cohere-lab-enterprise",
]);

const NON_COMMERCIAL = new Set([
  "cc-by-nc-4.0", "cc-by-nc-sa-4.0", "cc-by-nc-nd-4.0", "cc-by-nc-2.0",
  "creativeml-openrail-m", "research-only", "llama2-research",
]);

export function classifyLicence(licence: string | null | undefined): LicenceClass {
  if (!licence) return "unknown";
  const id = licence.trim().toLowerCase();
  if (PERMISSIVE.has(id)) return "permissive";
  if (COMMUNITY.has(id)) return "community";
  if (NON_COMMERCIAL.has(id)) return "non-commercial";
  // "-nc" is a reliable non-commercial marker across Creative Commons variants.
  if (/(^|-)nc(-|$)/.test(id)) return "non-commercial";
  if (id.startsWith("other")) return "unknown";
  return "unknown";
}

/** HF reports `gated` as false, "auto" or "manual". */
export function classifyAccess(gated: string | boolean | null | undefined): AccessClass {
  if (gated === false || gated === "false") return "open";
  if (gated === "auto" || gated === "manual" || gated === true) return "gated";
  return "unknown";
}

export interface WeightsFacts {
  /** Canonical group id this describes. */
  groupId: string;
  /** HF repo the facts came from. */
  repoId: string;
  licence: string | null;
  licenceClass: LicenceClass;
  access: AccessClass;
  /** Total parameters from safetensors metadata, when published. */
  parameters: number | null;
  /** Repo this was fine-tuned or derived from, when declared. */
  baseModel: string | null;
  /** Languages the card declares. */
  languages: string[];
  /** Always present — the card is the authority, this module is a summary. */
  cardUrl: string;
  fetchedAt: string;
}

export interface WeightsSnapshot {
  fetchedAt: string;
  /** Attribution for the whole set; per-model cards carry their own licence. */
  source: string;
  models: Record<string, WeightsFacts>;
}

export const EMPTY_WEIGHTS: WeightsSnapshot = {
  fetchedAt: "",
  source: "https://huggingface.co",
  models: {},
};

export const LICENCE_LABEL: Record<LicenceClass, string> = {
  permissive: "Permissive",
  community: "Conditional",
  "non-commercial": "Non-commercial",
  unknown: "Licence unclear",
};

/**
 * One sentence a buyer can act on. Deliberately cautious: an unknown licence
 * says "check the card", never "probably fine".
 */
export const LICENCE_NOTE: Record<LicenceClass, string> = {
  permissive: "Standard open-source terms. Commercial use without additional conditions.",
  community: "Commercial use allowed, but the lab attaches conditions — read them before shipping.",
  "non-commercial": "Commercial use is not permitted under this licence.",
  unknown: "No machine-readable licence on the model card. Check it before you rely on this.",
};

export const ACCESS_NOTE: Record<AccessClass, string> = {
  open: "Weights download without an access request.",
  gated: "Hugging Face requires you to accept terms, and the lab may approve access manually.",
  unknown: "Access terms not published.",
};

/**
 * Does the repo's declared size agree with the model's name?
 *
 * HF name-search occasionally resolves to a neighbouring repo — a distill, a
 * quantisation, a different generation — and when it does, *every* fact we read
 * from it is wrong, licence included. Model names usually carry their size
 * ("Apertus 70B", "Qwen3 235B-A22B"), which gives a free cross-check: if the
 * name says 70B and the safetensors say 11B, we resolved the wrong repo.
 *
 * Returns null when the name states no size and the claim cannot be checked.
 */
export function parametersAgreeWithName(name: string, parameters: number | null): boolean | null {
  if (parameters == null || parameters <= 0) return null;
  const claimed = [...name.matchAll(/(\d+(?:\.\d+)?)\s*B\b/gi)].map((m) => Number(m[1]));
  if (claimed.length === 0) return null;
  const actualB = parameters / 1e9;
  // Mixture-of-experts names carry both total and active sizes
  // ("235B-A22B"); agreeing with either is enough.
  return claimed.some((c) => c > 0 && Math.max(c, actualB) / Math.min(c, actualB) <= NAME_SIZE_TOLERANCE);
}

/** A name-vs-metadata size gap beyond this means we matched the wrong repo. */
const NAME_SIZE_TOLERANCE = 1.5;

/** Packaging suffixes that do not change which model a repo holds. */
const NEUTRAL_SUFFIXES = [
  "instruct", "chat", "it", "hf", "base", "v01", "v1", "preview", "latest",
];

function reduceRepoName(v: string): string {
  let out = v
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  // Strip trailing packaging words, repeatedly: "glm-4.6-instruct-hf" -> "glm-4-6".
  let changed = true;
  while (changed) {
    changed = false;
    for (const suffix of NEUTRAL_SUFFIXES) {
      if (out.endsWith(`-${suffix}`)) {
        out = out.slice(0, -(suffix.length + 1));
        changed = true;
      }
    }
  }
  return out;
}

/**
 * Does this repo hold *this* model, strictly?
 *
 * The popularity resolver accepts substring containment, which is fine for
 * download counts and wrong for licences: "GLM-4.6" is a substring of
 * "GLM-4.6V-Flash", a different model with potentially different terms. Weights
 * facts therefore demand equality after packaging suffixes are removed —
 * resolving fewer models is much better than mislabelling one.
 */
export function repoMatchesModel(modelName: string, repoId: string): boolean {
  const tail = repoId.split("/").pop() ?? repoId;
  return reduceRepoName(tail) === reduceRepoName(modelName);
}

/** True when the weights are genuinely grab-and-go for a commercial product. */
export function isFreelyUsable(f: WeightsFacts): boolean {
  return f.licenceClass === "permissive" && f.access === "open";
}

export interface WeightsSummary {
  total: number;
  freelyUsable: number;
  conditional: number;
  nonCommercial: number;
  gated: number;
  unclear: number;
}

export function summarise(facts: WeightsFacts[]): WeightsSummary {
  return {
    total: facts.length,
    freelyUsable: facts.filter(isFreelyUsable).length,
    conditional: facts.filter((f) => f.licenceClass === "community").length,
    nonCommercial: facts.filter((f) => f.licenceClass === "non-commercial").length,
    gated: facts.filter((f) => f.access === "gated").length,
    unclear: facts.filter((f) => f.licenceClass === "unknown").length,
  };
}

/**
 * Models where "open weights" does not mean what a reader assumes: the licence
 * forbids commercial use, or the download needs approval. Apache-2.0 and
 * ungated needs no explanation, so it is left off — this list is the exceptions,
 * ordered by how badly the assumption would hurt.
 */
export function notableCaveats(facts: WeightsFacts[], limit = 6): WeightsFacts[] {
  const rank = (f: WeightsFacts): number => {
    if (f.licenceClass === "non-commercial") return 0;
    if (f.access === "gated" && f.licenceClass === "community") return 1;
    if (f.licenceClass === "community") return 2;
    if (f.access === "gated") return 3;
    return 99;
  };
  return facts
    .filter((f) => rank(f) < 99)
    .sort((a, b) => rank(a) - rank(b) || (b.parameters ?? 0) - (a.parameters ?? 0))
    .slice(0, limit);
}

let cache: WeightsSnapshot | null = null;

/** Weights facts as committed by the daily Hugging Face sync. */
export async function getWeights(): Promise<WeightsSnapshot> {
  if (cache) return cache;
  try {
    const { readFile } = await import("node:fs/promises");
    const path = await import("node:path");
    const buf = await readFile(
      path.join(process.cwd(), "snapshots", "latest", "weights.json"),
      "utf8",
    );
    const parsed = JSON.parse(buf) as Partial<WeightsSnapshot>;
    cache = {
      fetchedAt: parsed.fetchedAt ?? "",
      source: parsed.source ?? EMPTY_WEIGHTS.source,
      models: parsed.models ?? {},
    };
  } catch {
    cache = EMPTY_WEIGHTS;
  }
  return cache;
}

/** Human-readable parameter count: 8B, 685B, 1.2T. */
export function fmtParams(n: number | null): string | null {
  if (n == null || !Number.isFinite(n) || n <= 0) return null;
  if (n >= 1e12) return `${Number((n / 1e12).toFixed(2))}T`;
  if (n >= 1e9) return `${Number((n / 1e9).toFixed(n < 1e10 ? 1 : 0))}B`;
  if (n >= 1e6) return `${Math.round(n / 1e6)}M`;
  return String(n);
}
