/**
 * Where a benchmark score came from.
 *
 * models.dev carries a `source` URL on every benchmark row and the site used to
 * render it as a bare link, which meant a number OpenAI published about its own
 * model was ranked in the same column as one Scale measured independently.
 * Those are not comparable claims and presenting them as one leaderboard is the
 * fastest way to lose an eval-literate reader.
 */

export type Provenance = "independent" | "vendor" | "aggregator" | "unclassified" | "unknown";

/**
 * Third parties that run the evaluation themselves. A score sourced here was
 * measured by someone with no stake in the result.
 */
const INDEPENDENT_HOSTS = new Set([
  "artificialanalysis.ai",
  "scale.com",
  "labs.scale.com",
  "aider.chat",
  "livebench.ai",
  "lmarena.ai",
  "epoch.ai",
  "epochai.org",
  "swebench.com",
  "vals.ai",
  "trackingai.org",
  "arcprize.org",
  "simple-bench.com",
]);

/** Marketplaces that republish whatever the lab told them. */
const AGGREGATOR_HOSTS = new Set(["openrouter.ai", "openrouter.com"]);

function hostOf(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return null;
  }
}

/**
 * Hosts not in an allow-list stay unclassified. They remain excluded from
 * rankings, but we do not call them self-reported without evidence that the
 * model's own lab produced the score.
 */
export function provenanceOf(source: string | null | undefined): Provenance {
  if (!source) return "unknown";
  const host = hostOf(source);
  if (!host) return "unknown";
  if (INDEPENDENT_HOSTS.has(host)) return "independent";
  if (AGGREGATOR_HOSTS.has(host)) return "aggregator";
  // Subdomains of an independent evaluator count too (labs.scale.com already
  // listed explicitly, but this catches future ones).
  for (const h of INDEPENDENT_HOSTS) if (host.endsWith(`.${h}`)) return "independent";
  return "unclassified";
}

export const PROVENANCE_LABEL: Record<Provenance, string> = {
  independent: "Independent",
  vendor: "Self-reported",
  aggregator: "Marketplace",
  unclassified: "Unclassified source",
  unknown: "Unsourced",
};

export const PROVENANCE_NOTE: Record<Provenance, string> = {
  independent: "Measured by a third-party evaluator with no stake in the result.",
  vendor: "Published by the model's own lab. Treat as a claim, not a measurement.",
  aggregator: "Republished by a marketplace from the lab's own figures.",
  unclassified: "A source URL is present, but its relationship to the model has not been classified.",
  unknown: "No source URL published upstream.",
};

/** Only independent scores are safe to rank models against each other. */
export function isComparable(p: Provenance): boolean {
  return p === "independent";
}
