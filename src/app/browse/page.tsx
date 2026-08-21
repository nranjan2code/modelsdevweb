import type { Metadata } from "next";
import { getCatalog } from "@/lib/data";
import { BrowseTable, type BrowseRow } from "@/components/browse-table";

export const metadata: Metadata = { title: "Browse models" };

export default async function BrowsePage() {
  const catalog = await getCatalog();
  const rows: BrowseRow[] = catalog.groups.map((g) => ({
    id: g.id,
    name: g.name,
    lab: g.labId,
    input: g.best?.input ?? null,
    output: g.best?.output ?? null,
    ctx:
      g.canonical?.limit?.context ??
      g.listings.reduce<number | null>((acc, l) => (l.limit.context != null && (acc == null || l.limit.context > acc) ? l.limit.context : acc), null),
    reasoning: g.canonical?.reasoning ?? g.listings.some((l) => l.reasoning),
    tools: g.canonical?.toolCall ?? g.listings.some((l) => l.toolCall),
    structured: g.canonical?.structuredOutput ?? g.listings.some((l) => l.structuredOutput === true),
    vision: g.canonical?.attachment ?? g.listings.some((l) => l.attachment),
    open: g.canonical?.openWeights ?? false,
    released: g.canonical?.releaseDate ?? null,
    providers: g.listings.length,
  }));

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-50">Browse models</h1>
        <p className="text-sm text-zinc-500">
          Best listed price across all serving providers. R = reasoning, T = tool call, S = structured output,
          V = vision/attachments.
        </p>
      </header>
      <BrowseTable rows={rows} />
    </div>
  );
}
