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
      <header className="space-y-2">
        <p className="mono-label">Sunset watch</p>
        <h1 className="text-3xl font-bold tracking-tight text-black sm:text-4xl">Deprecations</h1>
        <p className="max-w-2xl text-sm leading-relaxed text-black/55">
          Provider listings marked <span className="font-medium text-red-600">deprecated</span> — the model is no
          longer served on that provider&apos;s public API. Migrate before your pinned endpoint disappears.
        </p>
      </header>

      <div className="card overflow-x-auto">
        <table className="table-base min-w-[720px]">
          <thead>
            <tr>
              <th>Model</th>
              <th>Deprecated on</th>
              <th className="text-right">Last updated</th>
              <th className="text-right">Cheapest live price</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ group, deprecated }) => (
              <tr key={group.id}>
                <td>
                  <Link href={`/m/${group.id}`} className="font-medium text-black transition-colors hover:text-blue-600">
                    {group.name}
                  </Link>
                  <span className="ml-2 text-xs text-black/45">{group.labId}</span>
                </td>
                <td>
                  <span className="inline-flex flex-wrap gap-1">
                    {deprecated.map((l) => (
                      <span
                        key={l.key}
                        className="rounded-full border border-red-500/30 bg-red-50 px-2 py-0.5 text-[11px] font-medium text-red-600"
                      >
                        {l.providerName}
                      </span>
                    ))}
                  </span>
                </td>
                <td className="whitespace-nowrap text-right text-xs text-black/45">
                  {fmtDate(deprecated[0]?.lastUpdated)}
                </td>
                <td className="whitespace-nowrap text-right font-mono tabular-nums">
                  {group.best ? (
                    <span className="font-semibold text-emerald-600">{fmtPerM(group.best.input)}</span>
                  ) : (
                    <span className="text-black/35">none live</span>
                  )}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={4} className="py-10 text-center text-sm text-black/45">
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
