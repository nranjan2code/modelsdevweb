import type { Metadata } from "next";
import { getCatalog } from "@/lib/data";
import { ProvidersTable } from "@/components/catalog-tables";

export const metadata: Metadata = {
  title: "Providers",
  description: "Every inference provider serving AI models, with per-model input, output and cache pricing.",
  alternates: { canonical: "/providers" },
};

export default async function ProvidersPage() {
  const catalog = await getCatalog();
  return (
    <div className="space-y-6">
      <header className="page-intro page-intro-split">
        <p className="mono-label">Infrastructure</p>
        <h1 className="text-3xl font-bold tracking-tight text-black sm:text-4xl">Inference providers</h1>
        <p className="max-w-2xl text-sm leading-relaxed text-black/60">
          {catalog.providers.length} providers serving models across the catalog.
        </p>
      </header>
      <ProvidersTable rows={catalog.providers} />
    </div>
  );
}
