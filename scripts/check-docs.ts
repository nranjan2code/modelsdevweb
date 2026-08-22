/**
 * Documentation rot gate.
 *
 * README.md, AGENTS.md, docs/brand.md and docs/voice.md are binding specs — an
 * agent reads them before touching the code, so a stale claim is worse than a
 * missing one. Prose cannot be typechecked, but three kinds of rot can:
 *
 *   1. a path that no longer exists,
 *   2. a reference to something that was deliberately deleted,
 *   3. a tuning constant quoted in prose that has since changed in source.
 *
 * Everything here is mechanical. Judgement about whether the *meaning* is still
 * right stays with the author.
 */
import { readFile, access } from "node:fs/promises";
import path from "node:path";

const ROOT = path.dirname(import.meta.dirname);
const DOCS = ["README.md", "AGENTS.md", "docs/brand.md", "docs/voice.md"];

/** Files created at runtime by a script rather than committed. */
const RUNTIME_PATHS = new Set([
  "events/notified.json",
  "snapshots/latest/external-signals.json",
]);

/** Directories whose contents are generated at build time and gitignored. */
const GENERATED_PREFIXES = ["public/og/", "public/badge/", "out/"];

/**
 * Things removed on purpose. Naming one in a doc means the doc is describing a
 * site that no longer exists — the exact failure this gate is for.
 */
const DELETED: { term: string; why: string }[] = [
  { term: "src/lib/data/story.ts", why: "deleted; editorial logic lives in src/lib/data/brief.ts" },
  { term: "moversLosers", why: "replaced by marketMoves() + collapseByModel()" },
  { term: "modelOfWeek", why: "removed — it was a daily modulo lottery presented as an editorial pick" },
  { term: "headToHeads", why: "removed — pairs were formed by array adjacency, not competitive relevance" },
  { term: "labScorecards", why: "removed with the old homepage" },
  { term: "pulseSeries", why: "replaced by frontierIndex() over the permanent archive" },
  { term: "activityCalendar", why: "removed with the old homepage" },
  { term: "leadStory", why: "replaced by lede() in src/lib/data/brief.ts" },
];

/**
 * Tuning constants a doc quotes by value. The doc must state the current value
 * somewhere near the constant's name, so changing one forces changing the
 * other. Proximity rather than an exact phrasing, because prose legitimately
 * writes "(30)", "30 days" or "30-day".
 */
const CONSTANTS: { name: string; file: string }[] = [
  { name: "RETENTION_DAYS", file: "scripts/sync.ts" },
  { name: "INDEX_MIN_DAYS", file: "src/lib/data/brief.ts" },
  { name: "PRICE_OUTLIER_FACTOR", file: "src/lib/data/market.ts" },
  { name: "CORROBORATION_FACTOR", file: "src/lib/data/market.ts" },
];

/** How far from the constant's name the value may appear. */
const CONSTANT_PROXIMITY = 120;

const PATH_RE = /`((?:src|scripts|snapshots|events|news|docs|public|out)\/[A-Za-z0-9_.[\]/-]+)`/g;

async function exists(p: string): Promise<boolean> {
  try {
    await access(path.join(ROOT, p));
    return true;
  } catch {
    return false;
  }
}

/** Read a `const NAME = <number>` from a source file. */
async function constantValue(file: string, name: string): Promise<string | null> {
  const src = await readFile(path.join(ROOT, file), "utf8");
  const m = src.match(new RegExp(`(?:export\\s+)?const\\s+${name}\\s*=\\s*([0-9._]+)`));
  return m ? m[1].replace(/_/g, "") : null;
}

async function main(): Promise<void> {
  const problems: string[] = [];
  const docs = new Map<string, string>();
  for (const d of DOCS) docs.set(d, await readFile(path.join(ROOT, d), "utf8"));

  // 1. Paths named in prose must resolve.
  for (const [doc, text] of docs) {
    for (const m of text.matchAll(PATH_RE)) {
      const ref = m[1];
      if (RUNTIME_PATHS.has(ref)) continue;
      if (GENERATED_PREFIXES.some((p) => ref.startsWith(p))) continue;
      // Bracketed route segments are globs, not literal files.
      if (ref.includes("[") || ref.includes("<")) continue;
      if (!(await exists(ref))) problems.push(`${doc}: path \`${ref}\` does not exist`);
    }
  }

  // 2. Deliberately removed things must not be described as current.
  for (const [doc, text] of docs) {
    for (const { term, why } of DELETED) {
      // AGENTS.md documents *why* some of these were removed, which is correct
      // and must stay; flag only when the surrounding line reads as current.
      for (const line of text.split("\n")) {
        if (!line.includes(term)) continue;
        const isHistorical = /remov|delet|replac|no longer|was |used to|instead of|until it|not restor/i.test(line);
        if (!isHistorical) problems.push(`${doc}: mentions removed \`${term}\` as current — ${why}`);
      }
    }
  }

  // 3. Constants quoted in prose must match source.
  for (const { name, file } of CONSTANTS) {
    const value = await constantValue(file, name);
    if (value == null) {
      problems.push(`${file}: constant ${name} not found — check-docs needs updating`);
      continue;
    }
    const near = new RegExp(`(?<![\\d.])${value.replace(".", "\\.")}(?![\\d.])`);
    for (const [doc, text] of docs) {
      let idx = text.indexOf(name);
      while (idx !== -1) {
        const window = text.slice(
          Math.max(0, idx - CONSTANT_PROXIMITY),
          idx + name.length + CONSTANT_PROXIMITY,
        );
        if (!near.test(window)) {
          problems.push(
            `${doc}: mentions ${name} without its current value (${value}, from ${file})`,
          );
        }
        idx = text.indexOf(name, idx + 1);
      }
    }
  }

  if (problems.length > 0) {
    console.error(`✗ docs gate failed — ${problems.length} issue(s):\n`);
    for (const p of problems) console.error(`  ${p}`);
    console.error("\nDocs are binding specs (AGENTS.md, docs/brand.md, docs/voice.md).");
    process.exit(1);
  }
  console.log(`✓ docs gate passed — ${DOCS.length} docs, paths and constants agree with source.`);
}

main().catch((err) => {
  console.error("[check-docs] failed:", err);
  process.exit(1);
});
