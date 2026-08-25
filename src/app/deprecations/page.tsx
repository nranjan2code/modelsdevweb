import type { Metadata } from "next";
import { getCatalog } from "@/lib/data";
import { DeprecationsTable } from "@/components/catalog-tables";

export const metadata: Metadata = {
  title: "Deprecations",
  description: "Deprecated AI model listings — track sunset endpoints before your pinned provider removes them.",
  alternates: { canonical: "/deprecations" },
};

export default async function DeprecationsPage() {
  const catalog = await getCatalog();
  const rows = catalog.groups
    .map((g) => ({
      group: g,
      deprecated: g.listings.filter((l) => l.status === "deprecated"),
    }))
    .filter((r) => r.deprecated.length > 0)
    .sort((a, b) => {
      const ad = a.deprecated[0]?.lastUpdated ?? "";
      const bd = b.deprecated[0]?.lastUpdated ?? "";
      return bd.localeCompare(ad);
    });

  return (
    <div className="space-y-6">
      <header className="page-intro page-intro-split">
        <p className="mono-label">Sunset watch</p>
        <h1 className="text-3xl font-bold tracking-tight text-black sm:text-4xl">Deprecations</h1>
        <p className="max-w-2xl text-sm leading-relaxed text-black/60">
          Provider listings marked <span className="font-medium text-neg">deprecated</span> — the model is no
          longer served on that provider&apos;s public API. Migrate before your pinned endpoint disappears.
        </p>
      </header>

      <DeprecationsTable rows={rows.map(({ group, deprecated }) => ({ id: group.id, name: group.name, lab: group.labId, providers: deprecated.map((listing) => listing.providerName), lastUpdated: deprecated[0]?.lastUpdated ?? null, bestInput: group.best?.input ?? null }))} />
    </div>
  );
}
