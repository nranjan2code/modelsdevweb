import type { Metadata } from "next";
import Link from "next/link";
import { getCatalog } from "@/lib/data";

export const metadata: Metadata = {
  title: "Providers",
  description: "Every inference provider serving AI models, with per-model input, output and cache pricing.",
  alternates: { canonical: "/providers" },
};

export default async function ProvidersPage() {
  const catalog = await getCatalog();
  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <p className="mono-label">Infrastructure</p>
        <h1 className="text-3xl font-bold tracking-tight text-black sm:text-4xl">Inference providers</h1>
        <p className="max-w-2xl text-sm leading-relaxed text-black/55">
          {catalog.providers.length} providers serving models across the catalog.
        </p>
      </header>
      <div className="card overflow-x-auto">
        <table className="table-base min-w-[560px]">
          <thead>
            <tr>
              <th>Provider</th>
              <th className="text-right">Listings</th>
              <th>SDK package</th>
              <th>Docs</th>
            </tr>
          </thead>
          <tbody>
            {catalog.providers.map((p) => (
              <tr key={p.id}>
                <td>
                  <Link href={`/provider/${p.id}`} className="font-medium text-black transition-colors hover:text-blue-600">
                    {p.name}
                  </Link>
                  <span className="ml-2 font-mono text-xs text-black/45">{p.id}</span>
                </td>
                <td className="text-right tabular-nums text-black/55">{p.modelCount}</td>
                <td className="font-mono text-xs text-black/55">{p.npm ?? "—"}</td>
                <td className="text-xs">
                  {p.doc ? (
                    <a
                      href={p.doc}
                      target="_blank"
                      rel="noreferrer"
                      className="font-medium text-blue-600 underline decoration-wavy underline-offset-4 hover:text-blue-700"
                    >
                      docs ↗
                    </a>
                  ) : (
                    <span className="text-black/30">—</span>
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
