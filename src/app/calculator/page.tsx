import type { Metadata } from "next";
import { getCatalog } from "@/lib/data";
import { Calculator, type CalcRow } from "@/components/calculator";

export const metadata: Metadata = { title: "Cost calculator" };

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
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-50">Monthly cost calculator</h1>
        <p className="text-sm text-zinc-500">
          Set your token mix and see what each model would cost per month at its cheapest listed provider.
        </p>
      </header>
      <Calculator rows={rows} />
    </div>
  );
}
