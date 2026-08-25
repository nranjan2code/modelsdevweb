import type { Metadata } from "next";
import { getCatalog } from "@/lib/data";
import { Calculator, type CalcRow } from "@/components/calculator";

export const metadata: Metadata = {
  title: "Cost calculator",
  description: "What a workload actually costs on every model — cache writes, reasoning tokens and long-context price tiers included.",
  alternates: { canonical: "/calculator" },
};

export default async function CalculatorPage() {
  const catalog = await getCatalog();
  const rows: CalcRow[] = catalog.groups
    .filter((g) => g.best != null)
    .map((g) => ({
      id: g.id,
      name: g.name,
      lab: g.labId,
      input: g.best!.input,
      output: g.best!.output,
      cost: g.best!.cost,
    }));

  return (
    <div className="space-y-6">
      <header className="page-intro page-intro-split">
        <p className="mono-label">Plan your spend</p>
        <h1 className="text-3xl font-bold tracking-tight text-black sm:text-4xl">What the workload costs</h1>
        <p className="max-w-2xl text-sm leading-relaxed text-black/60">
          A sticker price is a rate, not a bill. Pick the shape of your traffic and see what each
          model would actually cost per month at its cheapest listed provider — including the cache
          writes, reasoning tokens and long-context tiers a headline $/M figure leaves out.
        </p>
      </header>
      <Calculator rows={rows} />
    </div>
  );
}
