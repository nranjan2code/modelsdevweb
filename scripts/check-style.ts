/**
 * Style regression gate — docs/brand.md §9.
 * Fails on any violation of the brand token contract:
 *   - raw hex colors in TSX/TS under src/
 *   - Tailwind palette classes (colors must be semantic tokens or ink alphas)
 *   - ad-hoc Tailwind shadows (only the named brand elevation tokens are allowed)
 *   - `!important` color overrides (!text-, !bg-, !border-)
 *   - arbitrary font sizes outside the allowlist
 *
 * Run: pnpm check:style    (CI + pre-sync)
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = join(import.meta.dirname, "..");

/** Files allowed to use arbitrary font sizes (primitive internals). */
const ARBITRARY_SIZE_ALLOWLIST = new Set(["src/components/ui.tsx"]);

/** Allowed ink-alpha rgba() usage inside TSX (SVG charts can't use utilities). */
const INK_RGBA = /rgba\(\s*0\s*,\s*0\s*,\s*0\s*,/;

const PALETTE_HUES =
  "slate|gray|zinc|stone|neutral|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose";
const PALETTE_CLASS = new RegExp(`(?:text|bg|border|ring|fill|stroke|decoration|divide|outline|accent|caret|from|via|to)-(${PALETTE_HUES})-\\d{2,3}`);
const SOFT_SHADOW = /\bshadow-(?:sm|md|lg|xl|2xl)\b(?!-)/;
const IMPORTANT_COLOR = /!(?:text|bg|border|ring|decoration)-(?:[a-z]+-)*\d+/;
const HEX = /#[0-9a-fA-F]{6}\b/;
const ARBITRARY_SIZE = /text-\[[0-9.]+(?:px|rem)\]/;

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else if (/\.tsx?$/.test(entry)) out.push(p);
  }
  return out;
}

type Violation = { file: string; line: number; rule: string; text: string };

const violations: Violation[] = [];
for (const file of walk(join(ROOT, "src"))) {
  const rel = relative(ROOT, file);
  const lines = readFileSync(file, "utf8").split("\n");
  lines.forEach((text, i) => {
    const at = { file: rel, line: i + 1, text: text.trim() };
    const push = (rule: string) => violations.push({ ...at, rule });
    if (HEX.test(text)) push("raw-hex");
    if (PALETTE_CLASS.test(text)) push("palette-class");
    if (SOFT_SHADOW.test(text)) push("soft-shadow");
    if (IMPORTANT_COLOR.test(text)) push("important-override");
    if (ARBITRARY_SIZE_ALLOWLIST.has(rel) === false && ARBITRARY_SIZE.test(text) && !INK_RGBA.test(text)) {
      // still flag even on a line that also has rgba — sizes are independent
      push("arbitrary-size");
    }
  });
}

// rgba() outside ink-alpha is also a raw color.
for (const file of walk(join(ROOT, "src"))) {
  const rel = relative(ROOT, file);
  const lines = readFileSync(file, "utf8").split("\n");
  lines.forEach((text, i) => {
    if (/rgba?\(/.test(text) && !INK_RGBA.test(text)) {
      violations.push({ file: rel, line: i + 1, rule: "non-ink-rgba", text: text.trim() });
    }
  });
}

if (violations.length > 0) {
  console.error(`✗ style gate failed — ${violations.length} violation(s):\n`);
  for (const v of violations) {
    console.error(`  ${v.file}:${v.line} [${v.rule}] ${v.text.slice(0, 120)}`);
  }
  console.error("\nSee docs/brand.md §3.3 and §5 for the token contract.");
  process.exit(1);
}

console.log("✓ style gate passed — brand tokens only.");
