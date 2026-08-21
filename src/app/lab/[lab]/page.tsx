import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getCatalog } from "@/lib/data";
import { fmtPerM, fmtTokens, fmtDate } from "@/lib/format";

export async function generateStaticParams() {
  const catalog = await getCatalog();
  return catalog.labs.map((l) => ({ lab: l.id }));
}

export async function generateMetadata({ params }: { params: Promise<{ lab: string }> }): Promise<Metadata> {
  const { lab } = await params;
  return { title: `${lab} models` };
}

export default async function LabPage({ params }: { params: Promise<{ lab: string }> }) {
  const { lab } = await params;
  const catalog = await getCatalog();
  const groups = catalog.groups.filter((g) => g.labId === lab);
  if (groups.length === 0) notFound();

  return (
    <div className="space-y-6">
      <nav className="text-sm text-black/45">
        <Link href="/browse" className="transition-colors hover:text-blue-600">
          Browse
        </Link>
        <span className="mx-1.5">/</span>
        <span className="font-medium text-black">{lab}</span>
      </nav>
      <header className="space-y-2">
        <p className="mono-label">Lab</p>
        <h1 className="text-3xl font-bold tracking-tight text-black sm:text-4xl">{lab}</h1>
        <p className="max-w-2xl text-sm leading-relaxed text-black/55">
          {groups.length} canonical models tracked ·{" "}
          <a
            href={`/feeds/${lab}/rss.xml`}
            className="font-medium text-blue-600 underline decoration-wavy underline-offset-4 hover:text-blue-700"
          >
            RSS feed for this lab
          </a>
        </p>
      </header>

      <div className="card overflow-x-auto">
        <table className="table-base min-w-[680px]">
          <thead>
            <tr>
              <th>Model</th>
              <th className="text-right">Best in /M</th>
              <th className="text-right">Best out /M</th>
              <th className="text-right">Context</th>
              <th className="text-right">Providers</th>
              <th>Released</th>
            </tr>
          </thead>
          <tbody>
            {groups
              .sort((a, b) => (b.canonical?.releaseDate ?? "").localeCompare(a.canonical?.releaseDate ?? ""))
              .map((g) => (
                <tr key={g.id}>
                  <td>
                    <Link href={`/m/${g.id}`} className="font-medium text-black transition-colors hover:text-blue-600">
                      {g.name}
                    </Link>
                  </td>
                  <td className="text-right font-mono tabular-nums">{fmtPerM(g.best?.input ?? null)}</td>
                  <td className="text-right font-mono tabular-nums">{fmtPerM(g.best?.output ?? null)}</td>
                  <td className="text-right font-mono tabular-nums">{fmtTokens(g.canonical?.limit?.context ?? null)}</td>
                  <td className="text-right tabular-nums text-black/55">{g.listings.length}</td>
                  <td className="whitespace-nowrap text-xs text-black/45">{fmtDate(g.canonical?.releaseDate)}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
