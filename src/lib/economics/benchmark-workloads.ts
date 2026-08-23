/**
 * Which token profile a benchmark actually exercises.
 *
 * "Points per dollar" is meaningless without one. SWE-Bench Verified runs an
 * agent loop that re-sends a growing transcript and thinks between tool calls;
 * GPQA Diamond is a single hard question with a long chain of thought and no
 * retrieval at all. Pricing both at a chat blend flatters whichever model is
 * cheap on the axis the benchmark does not use.
 *
 * The map is **allow-listed, not pattern-matched** — the same rule the licence
 * classifier follows, for the same reason: a benchmark we have not looked at is
 * marked uncalibrated and priced at the site default, and the page says so.
 * Guessing a profile from the word "SWE" in a name would silently reorder a
 * value ranking on the strength of a substring.
 */

import { workloadById, type Workload } from "./workload";

/** Benchmark slug → workload id. Slugs come from `slugify()` in data/benchmarks. */
const CALIBRATION: Record<string, string> = {
  // Agentic coding: tool loops, growing transcripts, heavy prefix caching.
  "swe-bench-pro": "agentic",
  "swe-bench-verified": "agentic",
  "swe-bench-multilingual": "agentic",
  "terminal-bench": "agentic",
  "terminal-bench-hard": "agentic",
  "terminal-bench-2-1": "agentic",
  "aider-polyglot": "agentic",
  "deepswe": "agentic",
  "osworld-verified": "agentic",
  "browsecomp": "agentic",
  "mcp-atlas": "agentic",
  "toolathlon": "agentic",
  "automationbench": "agentic",
  "nl2repo": "agentic",
  "artificial-analysis-coding-agent-index": "agentic",

  // Long-context comprehension: a repository or corpus per question.
  "swe-atlas-codebase-qna": "long-context",
  "swe-atlas-refactoring": "long-context",
  "swe-atlas-test-writing": "long-context",
  "gdm-mrcr": "long-context",

  // Hard single-shot reasoning: little input, a great deal of thinking.
  "gpqa-diamond": "reasoning",
  "humanity-s-last-exam": "reasoning",
  "frontiermath": "reasoning",
  "arc-agi-2": "reasoning",
  "scicode": "reasoning",
  "frontiercode": "reasoning",
  "charxiv-reasoning": "reasoning",
  "mmmu-pro": "reasoning",

  // Mixed professional task suites — closest to a general chat profile.
  "gdpval": "chat",
  "gdpval-aa": "chat",
  "artificial-analysis-coding-index": "chat",
};

export interface BenchmarkCalibration {
  workload: Workload;
  /**
   * False when the benchmark is not in the allow-list. The figure is still
   * computed at the site default, but no page may present it as tuned to this
   * benchmark.
   */
  calibrated: boolean;
}

export function calibrationFor(slug: string): BenchmarkCalibration {
  const id = CALIBRATION[slug];
  return { workload: workloadById(id), calibrated: id != null };
}

export function calibratedSlugs(): string[] {
  return Object.keys(CALIBRATION);
}
