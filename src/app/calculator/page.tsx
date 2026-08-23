import type { Metadata } from "next";
import { getCatalog } from "@/lib/data";
import { Calculator, type CalcRow } from "@/components/calculator";

export const metadata: Metadata = {
  title: "Cost calculator",
  description: "Estimate monthly AI API costs from your token mix, including cache-hit savings, across every model.",
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
      cacheRead: g.best!.cacheRead,
    }));

  return (
    <div className="space-y-6">
      <header className="page-intro">
        <p className="mono-label">Plan your spend</p>
        <h1 className="text-3xl font-bold tracking-tight text-black sm:text-4xl">Monthly cost calculator</h1>
        <p className="max-w-2xl text-sm leading-relaxed text-black/60">
          Set your token mix and see what each model would cost per month at its cheapest listed provider.
        </p>
      </header>
      <Calculator rows={rows} />
    </div>
  );
}
