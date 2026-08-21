import type { Metadata } from "next";
import Link from "next/link";
import { getCatalog } from "@/lib/data";

export const metadata: Metadata = { title: "Providers" };

export default async function ProvidersPage() {
  const catalog = await getCatalog();
  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-50">Inference providers</h1>
        <p className="text-sm text-zinc-500">{catalog.providers.length} providers serving models across the catalog.</p>
      </header>
      <div className="card overflow-x-auto">
        <table className="w-full min-w-[560px] text-sm">
          <thead>
            <tr className="border-b border-zinc-800 text-left text-xs uppercase tracking-wide text-zinc-500">
              <th className="px-4 py-3 font-medium">Provider</th>
              <th className="px-4 py-3 font-medium text-right">Listings</th>
              <th className="px-4 py-3 font-medium">SDK package</th>
              <th className="px-4 py-3 font-medium">Docs</th>
            </tr>
          </thead>
          <tbody>
            {catalog.providers.map((p) => (
              <tr key={p.id} className="border-b border-zinc-800/60 last:border-0 hover:bg-zinc-900/50">
                <td className="px-4 py-2.5">
                  <Link href={`/provider/${p.id}`} className="font-medium text-zinc-100 hover:text-emerald-400 transition-colors">
                    {p.name}
                  </Link>
                  <span className="ml-2 text-xs text-zinc-500">{p.id}</span>
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums text-zinc-400">{p.modelCount}</td>
                <td className="px-4 py-2.5 font-mono text-xs text-zinc-500">{p.npm ?? "—"}</td>
                <td className="px-4 py-2.5 text-xs">
                  {p.doc ? (
                    <a href={p.doc} target="_blank" rel="noreferrer" className="text-emerald-400 hover:text-emerald-300">
                      docs ↗
                    </a>
                  ) : (
                    <span className="text-zinc-600">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
