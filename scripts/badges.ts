import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { getCatalog } from "../src/lib/data";

const ROOT = path.dirname(import.meta.dirname);
const OUT_DIR = path.join(ROOT, "public", "badge");

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** Approximate rendered width of a string at the badge font size. */
function textWidth(s: string, size = 11): number {
  return Math.round(s.length * size * 0.58);
}

function fmtPerM(v: number): string {
  if (v === 0) return "$0";
  if (v < 0.01) return `$${v.toFixed(4)}`;
  if (v < 1) return `$${v.toFixed(3).replace(/0+$/, "").replace(/\.$/, "")}`;
  return `$${v.toFixed(2).replace(/\.00$/, "")}`;
}

function badge(label: string, value: string, valueColor: string, valueTextColor = "#fff"): string {
  const pad = 6;
  const lw = textWidth(label) + pad * 2;
  const vw = textWidth(value) + pad * 2;
  const w = lw + vw;
  const h = 20;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" role="img" aria-label="${esc(label)}: ${esc(value)}">
  <title>${esc(label)}: ${esc(value)}</title>
  <linearGradient id="s" x2="0" y2="100%"><stop offset="0" stop-color="#bbb" stop-opacity=".1"/><stop offset="1" stop-opacity=".1"/></linearGradient>
  <clipPath id="r"><rect width="${w}" height="${h}" rx="3" fill="#fff"/></clipPath>
  <g clip-path="url(#r)">
    <rect width="${lw}" height="${h}" fill="#0a0a0a"/>
    <rect x="${lw}" width="${vw}" height="${h}" fill="${valueColor}"/>
    <rect width="${w}" height="${h}" fill="url(#s)"/>
  </g>
  <g fill="#fff" text-anchor="middle" font-family="Verdana,Geneva,DejaVu Sans,sans-serif" font-size="11">
    <text x="${lw / 2}" y="14" fill="#fff">${esc(label)}</text>
    <text x="${lw + vw / 2}" y="14" fill="${valueTextColor}">${esc(value)}</text>
  </g>
</svg>
`;
}

async function main(): Promise<void> {
  const catalog = await getCatalog();
  await rm(OUT_DIR, { recursive: true, force: true });
  await mkdir(OUT_DIR, { recursive: true });

  let i = 0;
  for (const g of catalog.groups) {
    let svg: string;
    if (g.best && g.best.input != null) {
      svg = badge(
        "LLM Pulse",
        `${fmtPerM(g.best.input)} in · ${fmtPerM(g.best.output ?? 0)} out per M`,
        "#2563eb",
      );
    } else {
      svg = badge("LLM Pulse", "price unlisted", "#737373");
    }
    const file = path.join(OUT_DIR, `${g.id}.svg`);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, svg);
    i++;
  }
  console.log(`[badges] wrote ${i} SVG badges to public/badge/`);
}

main().catch((err) => {
  console.error("[badges] failed:", err);
  process.exit(1);
});
