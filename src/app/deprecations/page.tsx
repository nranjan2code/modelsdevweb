import type { Metadata } from "next";
import Link from "next/link";
import { getCatalog } from "@/lib/data";
import { fmtDate, fmtPerM } from "@/lib/format";

export const metadata: Metadata = { title: "Deprecations" };

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
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-50">Deprecations</h1>
        <p className="text-sm text-zinc-500">
          Provider listings marked <span className="text-red-400">deprecated</span> — the model is no longer
          served on that provider&apos;s public API. Migrate before your pinned endpoint disappears.
        </p>
      </header>

      <div className="card overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="border-b border-zinc-800 text-left text-xs uppercase tracking-wide text-zinc-500">
              <th className="px-4 py-3 font-medium">Model</th>
              <th className="px-4 py-3 font-medium">Deprecated on</th>
              <th className="px-4 py-3 font-medium text-right">Last updated</th>
              <th className="px-4 py-3 font-medium text-right">Cheapest live price</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ group, deprecated }) => (
              <tr key={group.id} className="border-b border-zinc-800/60 last:border-0 hover:bg-zinc-900/50">
                <td className="px-4 py-3">
                  <Link href={`/m/${group.id}`} className="font-medium text-zinc-100 hover:text-emerald-400 transition-colors">
                    {group.name}
                  </Link>
                  <span className="ml-2 text-xs text-zinc-500">{group.labId}</span>
                </td>
                <td className="px-4 py-3">
                  <span className="inline-flex flex-wrap gap-1">
                    {deprecated.map((l) => (
                      <span key={l.key} className="rounded bg-red-500/10 px-1.5 py-0.5 text-[11px] text-red-400">
                        {l.providerName}
                      </span>
                    ))}
                  </span>
                </td>
                <td className="px-4 py-3 text-right text-xs text-zinc-500 whitespace-nowrap">
                  {fmtDate(deprecated[0]?.lastUpdated)}
                </td>
                <td className="px-4 py-3 text-right font-mono tabular-nums whitespace-nowrap">
                  {group.best ? (
                    <span className="text-emerald-400">{fmtPerM(group.best.input)}</span>
                  ) : (
                    <span className="text-zinc-600">none live</span>
                  )}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-zinc-500">
                  No deprecated listings in the current snapshot.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
