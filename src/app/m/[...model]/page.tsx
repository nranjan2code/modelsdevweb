import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { existsSync } from "node:fs";
import path from "node:path";
import { getModel, getCatalog } from "@/lib/data";
import { SITE_URL } from "@/lib/site";
import { getPriceHistory } from "@/lib/data/history";
import { slugify } from "@/lib/data/benchmarks";
import { PriceTable } from "@/components/price-table";
import { PriceHistory } from "@/components/price-history";
import { fmtDate, fmtPerM, fmtTokens } from "@/lib/format";

export async function generateStaticParams() {
  const catalog = await getCatalog();
  return catalog.groups.map((g) => ({ model: g.id.split("/") }));
}

export async function generateMetadata({ params }: { params: Promise<{ model: string[] }> }): Promise<Metadata> {
  const { model } = await params;
  const group = await getModel(model.join("/"));
  if (!group) return { title: "Model not found" };
  const ogPath = `/og/m/${group.id}.png`;
  const hasOg = existsSync(path.join(process.cwd(), "public", ogPath));
  return {
    title: `${group.name} — prices across ${group.listings.length} providers`,
    openGraph: {
      images: [`${SITE_URL}${hasOg ? ogPath : "/og/site.png"}`],
    },
    twitter: { card: "summary_large_image" },
  };
}

export default async function ModelPage({ params }: { params: Promise<{ model: string[] }> }) {
  const { model } = await params;
  const id = model.join("/");
  const group = await getModel(id);
  if (!group) notFound();
  const c = group.canonical;
  const history = await getPriceHistory(id);

  return (
    <div className="space-y-8">
      <nav className="text-sm text-black/45">
        <Link href="/browse" className="transition-colors hover:text-blue-600">
          Browse
        </Link>
        <span className="mx-1.5">/</span>
        <Link href={`/lab/${group.labId}`} className="transition-colors hover:text-blue-600">
          {group.labId}
        </Link>
      </nav>

      <header className="space-y-2">
        <p className="mono-label">Model</p>
        <h1 className="text-3xl font-bold tracking-tight text-black sm:text-4xl">{group.name}</h1>
        {c?.description && <p className="max-w-3xl leading-relaxed text-black/60">{c.description}</p>}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-black/50">
          <span>{group.listings.length} providers</span>
          {c?.releaseDate && <span>released {fmtDate(c.releaseDate)}</span>}
          {c?.knowledge && <span>knowledge cutoff {c.knowledge}</span>}
          {c?.openWeights != null && (
            <span
              className={
                c.openWeights
                  ? "rounded-full border border-emerald-600/30 bg-emerald-50 px-2 py-0.5 font-medium text-emerald-700"
                  : "rounded-full border border-black/10 bg-black/[0.03] px-2 py-0.5 text-black/45"
              }
            >
              {c.openWeights ? "open weights" : "closed weights"}
            </span>
          )}
        </div>
      </header>

      {group.best && (
        <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="card px-4 py-3">
            <div className="font-mono text-lg font-bold tabular-nums text-blue-700">{fmtPerM(group.best.input)}</div>
            <div className="mono-label mt-0.5">best input /M · {group.best.providerName}</div>
          </div>
          <div className="card px-4 py-3">
            <div className="font-mono text-lg font-bold tabular-nums text-blue-700">{fmtPerM(group.best.output)}</div>
            <div className="mono-label mt-0.5">best output /M</div>
          </div>
          <div className="card-flat px-4 py-3">
            <div className="font-mono text-lg font-bold tabular-nums text-black">
              {fmtTokens(c?.limit?.context ?? Math.max(...group.listings.map((l) => l.limit.context ?? 0)))}
            </div>
            <div className="mono-label mt-0.5">context window</div>
          </div>
          <div className="card-flat px-4 py-3">
            <div className="font-mono text-lg font-bold tabular-nums text-black">
              {fmtTokens(c?.limit?.output ?? Math.max(...group.listings.map((l) => l.limit.output ?? 0)))}
            </div>
            <div className="mono-label mt-0.5">max output</div>
          </div>
        </section>
      )}

      <section className="space-y-4">
        <h2 className="font-hand text-3xl font-bold tracking-tight text-black">
          Compare providers{" "}
          <span className="align-middle font-sans text-sm font-normal text-black/45">
            (sorted by listed input price)
          </span>
        </h2>
        <PriceTable listings={group.listings} />
      </section>

      <PriceHistory points={history} />

      {(c?.benchmarks.length || c?.weights.length) ? (
        <section className="grid gap-6 md:grid-cols-2">
          {c.benchmarks.length > 0 && (
            <div className="space-y-4">
              <h2 className="font-hand text-3xl font-bold tracking-tight text-black">Benchmarks</h2>
              <ul className="card divide-y divide-black/10 text-sm">
                {c.benchmarks.map((b, i) => (
                  <li key={i} className="flex items-center justify-between gap-2 px-4 py-2.5">
                    <Link href={`/benchmarks/${slugify(b.name)}`} className="transition-colors hover:text-blue-600">
                      {b.name}
                      {b.metric ? <span className="ml-1 text-xs text-black/45">({b.metric})</span> : null}
                    </Link>
                    <span className="font-mono font-semibold tabular-nums text-black">{b.score}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {c.weights.length > 0 && (
            <div className="space-y-4">
              <h2 className="font-hand text-3xl font-bold tracking-tight text-black">Weights</h2>
              <ul className="card divide-y divide-black/10 text-sm">
                {c.weights.map((w, i) => (
                  <li key={i} className="px-4 py-2.5">
                    <a
                      href={w.url}
                      target="_blank"
                      rel="noreferrer"
                      className="font-medium text-blue-600 underline decoration-wavy underline-offset-4 hover:text-blue-700"
                    >
                      {w.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      ) : null}

      <p className="text-xs leading-relaxed text-black/40">
        Prices are per million tokens (USD). “—” means the provider does not publicly list a price for this
        model. Data from models.dev; verify with the provider before purchasing.
      </p>
    </div>
  );
}
