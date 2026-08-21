import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import satori from "satori";
import { Resvg } from "@resvg/resvg-js";
import { getCatalog } from "../src/lib/data";
import type { ModelGroup } from "../src/lib/data";

const ROOT = path.dirname(import.meta.dirname);
const OUT_DIR = path.join(ROOT, "public", "og");
const TOP_MODELS = 300;
const WIDTH = 1200;
const HEIGHT = 630;

interface FontEntry {
  name: string;
  data: Buffer;
  weight: 400 | 500 | 700;
  style: "normal";
}

async function loadFonts(): Promise<FontEntry[]> {
  const weights: { w: 400 | 500 | 700; file: string }[] = [
    { w: 400, file: "latin-400-normal" },
    { w: 500, file: "latin-500-normal" },
    { w: 700, file: "latin-700-normal" },
  ];
  return Promise.all(
    weights.map(async ({ w, file }) => {
      const url = `https://cdn.jsdelivr.net/fontsource/fonts/inter@latest/${file}.ttf`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`font ${file} -> HTTP ${res.status}`);
      return { name: "Inter", data: Buffer.from(await res.arrayBuffer()), weight: w, style: "normal" as const };
    }),
  );
}

function fmtPerM(v: number): string {
  if (v === 0) return "$0";
  if (v < 0.01) return `$${v.toFixed(4)}`;
  if (v < 1) return `$${v.toFixed(3).replace(/0+$/, "").replace(/\.$/, "")}`;
  return `$${v.toFixed(2).replace(/\.00$/, "")}`;
}

function fmtTokens(v: number | null | undefined): string {
  if (v == null) return "—";
  if (v >= 1_000_000) return `${v / 1_000_000}M`;
  if (v >= 1000) return `${Math.round(v / 1000)}K`;
  return String(v);
}

const SHARED_STYLES = {
  display: "flex",
  flexDirection: "column",
  width: "100%",
  height: "100%",
  backgroundColor: "#09090b",
  color: "#e4e4e7",
  fontFamily: "Inter",
} as const;

function Brand({ right }: { right?: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
        <div style={{ width: "10px", height: "10px", borderRadius: "9999px", backgroundColor: "#34d399" }} />
        <div style={{ fontSize: "26px", fontWeight: 700, color: "#fafafa" }}>LLM Pulse</div>
      </div>
      {right && <div style={{ fontSize: "20px", color: "#a1a1aa" }}>{right}</div>}
    </div>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
      <div style={{ fontSize: "40px", fontWeight: 700, color: "#fafafa" }}>{value}</div>
      <div style={{ fontSize: "19px", color: "#71717a" }}>{label}</div>
    </div>
  );
}

function siteCard(stats: { models: number; providers: number; listings: number; labs: number }) {
  return (
    <div style={{ ...SHARED_STYLES, padding: "64px", justifyContent: "space-between" }}>
      <Brand />
      <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            fontSize: "54px",
            fontWeight: 700,
            lineHeight: 1.2,
            color: "#fafafa",
            maxWidth: "1000px",
          }}
        >
          Every AI model. Every provider.
          <span style={{ color: "#34d399" }}>&nbsp;Every change.</span>
        </div>
        <div style={{ fontSize: "26px", color: "#a1a1aa" }}>
          Live price comparison and changelog for AI models — diffed hourly from open data.
        </div>
      </div>
      <div
        style={{
          display: "flex",
          gap: "56px",
          borderTop: "1px solid #27272a",
          paddingTop: "32px",
        }}
      >
        <Stat value={String(stats.models)} label="models" />
        <Stat value={String(stats.providers)} label="providers" />
        <Stat value={String(stats.listings)} label="listings" />
        <Stat value={String(stats.labs)} label="labs" />
      </div>
    </div>
  );
}

function modelCard(g: ModelGroup) {
  const ctx = g.canonical?.limit?.context ?? Math.max(...g.listings.map((l) => l.limit.context ?? 0), 0);
  return (
    <div style={{ ...SHARED_STYLES, padding: "64px", justifyContent: "space-between" }}>
      <Brand right={g.labId} />
      <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        <div style={{ fontSize: "64px", fontWeight: 700, lineHeight: 1.1, color: "#fafafa" }}>{g.name}</div>
        {g.canonical?.description && (
          <div
            style={{
              fontSize: "23px",
              lineHeight: 1.4,
              color: "#a1a1aa",
              maxWidth: "980px",
              lineClamp: 2,
            }}
          >
            {g.canonical.description}
          </div>
        )}
      </div>
      <div style={{ display: "flex", gap: "56px", borderTop: "1px solid #27272a", paddingTop: "32px" }}>
        <Stat value={g.best ? fmtPerM(g.best.input) : "—"} label="best input /M" />
        <Stat value={g.best ? fmtPerM(g.best.output) : "—"} label="best output /M" />
        <Stat value={fmtTokens(ctx)} label="context" />
        <Stat value={String(g.listings.length)} label="providers" />
      </div>
    </div>
  );
}

async function renderPng(element: React.ReactNode, fonts: FontEntry[]): Promise<Buffer> {
  const svg = await satori(element, { width: WIDTH, height: HEIGHT, fonts });
  return new Resvg(svg, { fitTo: { mode: "width", value: WIDTH } }).render().asPng();
}

async function main(): Promise<void> {
  console.log("[og] loading fonts…");
  const fonts = await loadFonts();
  const catalog = await getCatalog();

  await mkdir(path.join(OUT_DIR, "m"), { recursive: true });
  await writeFile(path.join(OUT_DIR, "site.png"), await renderPng(siteCard(catalog.stats), fonts));
  console.log("[og] site.png");

  const top = [...catalog.groups]
    .sort((a, b) => {
      const fa = a.canonical?.releaseDate ?? "";
      const fb = b.canonical?.releaseDate ?? "";
      if (fa !== fb) return fb.localeCompare(fa);
      return b.listings.length - a.listings.length;
    })
    .slice(0, TOP_MODELS);

  let i = 0;
  for (const g of top) {
    const png = await renderPng(modelCard(g), fonts);
    const file = path.join(OUT_DIR, "m", `${g.id}.png`);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, png);
    i++;
    if (i % 50 === 0) console.log(`[og] ${i}/${top.length}`);
  }
  console.log(`[og] done: site + ${i} model cards`);
}

main().catch((err) => {
  console.error("[og] failed:", err);
  process.exit(1);
});
