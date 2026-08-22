import type { Metadata } from "next";
import { getCatalog, groupContext, groupReleaseDate } from "@/lib/data";
import type { Modality } from "@/lib/pipeline/types";
import { BrowseTable, type BrowseRow } from "@/components/browse-table";

export const metadata: Metadata = {
  title: "Browse models",
  description: "Filterable catalog of every AI model — best listed prices across all inference providers, context windows, capabilities and benchmark scores.",
  alternates: { canonical: "/browse" },
};

export default async function BrowsePage() {
  const catalog = await getCatalog();
  const sweScore = (g: (typeof catalog.groups)[number]): number | null => {
    const b = g.canonical?.benchmarks ?? [];
    const pro = b.find((x) => x.name === "SWE-Bench Pro");
    const verified = b.find((x) => x.name === "SWE-Bench Verified");
    return pro?.score ?? verified?.score ?? null;
  };
  const rows: BrowseRow[] = [...catalog.groups]
    .sort((a, b) => (groupReleaseDate(b) ?? "").localeCompare(groupReleaseDate(a) ?? ""))
    .map((g) => {
    const hasMod = (dir: "input" | "output", mod: Modality): boolean =>
      (g.canonical?.modalities?.[dir].includes(mod) ?? false) ||
      g.listings.some((l) => l.modalities[dir].includes(mod));
    const live = g.listings.filter((l) => l.status !== "deprecated");
    const statuses = new Set(live.map((l) => l.status).filter((s): s is "alpha" | "beta" => s != null));
    const flags: string[] = [];
    if (statuses.has("beta")) flags.push("beta");
    if (statuses.has("alpha")) flags.push("alpha");
    if (live.some((l) => l.experimental)) flags.push("experimental");
    return {
      id: g.id,
      name: g.name,
      lab: g.labId,
      input: g.best?.input ?? null,
      output: g.best?.output ?? null,
      free: g.free,
      ctx: groupContext(g),
      reasoning: g.canonical?.reasoning ?? g.listings.some((l) => l.reasoning),
      tools: g.canonical?.toolCall ?? g.listings.some((l) => l.toolCall),
      structured: g.canonical?.structuredOutput ?? g.listings.some((l) => l.structuredOutput === true),
      vision: g.canonical?.attachment ?? g.listings.some((l) => l.attachment),
      audio: hasMod("input", "audio") || hasMod("output", "audio"),
      video: hasMod("input", "video"),
      pdf: hasMod("input", "pdf"),
      open: g.canonical?.openWeights ?? false,
      released: groupReleaseDate(g),
      providers: g.listings.length,
      swe: sweScore(g),
      flags,
    };
  });

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <p className="mono-label">Catalog</p>
        <h1 className="text-3xl font-bold tracking-tight text-black sm:text-4xl">Browse models</h1>
        <p className="max-w-2xl text-sm leading-relaxed text-black/55">
          Best listed price across all serving providers. R = reasoning, T = tool call, S = structured output,
          V = vision/attachments, A = audio in/out. SWE-Bench = SWE-Bench Pro (fallback: Verified) score where
          published.
        </p>
      </header>
      <BrowseTable rows={rows} />
    </div>
  );
}
