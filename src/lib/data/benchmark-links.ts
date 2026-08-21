/**
 * Canonical homes for well-known benchmarks, used to credit the original
 * projects wherever their scores appear. Matching is done on a normalized
 * name (lowercase, alphanumeric only) so variants like "SWE-Bench Pro",
 * "SWE Bench Pro" and "SWE-bench Pro" resolve to the same project.
 *
 * Only benchmarks with an unambiguous official home are listed — no guesses.
 */

const EXACT: Record<string, string> = {
  aiderpolyglot: "https://aider.chat/docs/leaderboards/",
  arcagi1: "https://arcprize.org",
  arcagi2: "https://arcprize.org",
  arcagi3: "https://arcprize.org",
  browsecomp: "https://openai.com/index/browsecomp/",
  frontiermath: "https://epoch.ai/frontiermath",
  gpqa: "https://huggingface.co/datasets/idavidrein/gpqa",
  gpqadiamond: "https://huggingface.co/datasets/idavidrein/gpqa",
  humanityslastexam: "https://lastexam.ai",
  livecodebench: "https://livecodebench.github.io",
  livecodebenchpro: "https://livecodebench.github.io",
  mmmu: "https://mmmu-benchmark.github.io",
  mmmupro: "https://mmmu-benchmark.github.io",
  mmlu: "https://github.com/hendrycks/test",
  mmlupro: "https://huggingface.co/datasets/TIGER-Lab/MMLU-Pro",
  osworld: "https://os-world.github.io",
  osworldverified: "https://os-world.github.io",
};

const PREFIXES: [string, string][] = [
  ["swebench", "https://www.swebench.com"],
  ["swemarathon", "https://www.swebench.com"],
  ["frontierswe", "https://www.swebench.com"],
  ["terminalbench", "https://github.com/laude-institute/terminal-bench"],
  ["artificialanalysis", "https://artificialanalysis.ai"],
  ["tau2bench", "https://github.com/sierra-research/tau2-bench"],
  ["tau3telecom", "https://github.com/sierra-research/tau2-bench"],
  ["tau2benchtelecom", "https://github.com/sierra-research/tau2-bench"],
];

function normalize(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function benchmarkHome(name: string): string | null {
  const n = normalize(name);
  if (EXACT[n]) return EXACT[n];
  for (const [prefix, url] of PREFIXES) {
    if (n.startsWith(prefix)) return url;
  }
  return null;
}
