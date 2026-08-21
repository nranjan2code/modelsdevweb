import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getModel, getCatalog } from "@/lib/data";
import { getPriceHistory } from "@/lib/data/history";
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
  return { title: `${group.name} — prices across ${group.listings.length} providers` };
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
      <nav className="text-sm text-zinc-500">
        <Link href="/browse" className="hover:text-zinc-300">
          Browse
        </Link>
        <span className="mx-1.5">/</span>
        <Link href={`/lab/${group.labId}`} className="hover:text-zinc-300">
          {group.labId}
        </Link>
      </nav>

      <header className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-50">{group.name}</h1>
        {c?.description && <p className="max-w-3xl text-zinc-400">{c.description}</p>}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-zinc-500">
          <span>{group.listings.length} providers</span>
          {c?.releaseDate && <span>released {fmtDate(c.releaseDate)}</span>}
          {c?.knowledge && <span>knowledge cutoff {c.knowledge}</span>}
          {c?.openWeights != null && (
            <span className={c.openWeights ? "text-emerald-400" : ""}>
              {c.openWeights ? "open weights" : "closed weights"}
            </span>
          )}
        </div>
      </header>

      {group.best && (
        <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="card px-4 py-3">
            <div className="text-lg font-semibold text-emerald-400 font-mono tabular-nums">
              {fmtPerM(group.best.input)}
            </div>
            <div className="text-xs text-zinc-500">best input /M · {group.best.providerName}</div>
          </div>
          <div className="card px-4 py-3">
            <div className="text-lg font-semibold text-emerald-400 font-mono tabular-nums">
              {fmtPerM(group.best.output)}
            </div>
            <div className="text-xs text-zinc-500">best output /M</div>
          </div>
          <div className="card px-4 py-3">
            <div className="text-lg font-semibold text-zinc-50 font-mono tabular-nums">
              {fmtTokens(c?.limit?.context ?? Math.max(...group.listings.map((l) => l.limit.context ?? 0)))}
            </div>
            <div className="text-xs text-zinc-500">context window</div>
          </div>
          <div className="card px-4 py-3">
            <div className="text-lg font-semibold text-zinc-50 font-mono tabular-nums">
              {fmtTokens(c?.limit?.output ?? Math.max(...group.listings.map((l) => l.limit.output ?? 0)))}
            </div>
            <div className="text-xs text-zinc-500">max output</div>
          </div>
        </section>
      )}

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-zinc-100">
          Compare providers <span className="text-sm font-normal text-zinc-500">(sorted by listed input price)</span>
        </h2>
        <PriceTable listings={group.listings} />
      </section>

      <PriceHistory points={history} />

      {(c?.benchmarks.length || c?.weights.length) ? (
        <section className="grid gap-6 md:grid-cols-2">
          {c.benchmarks.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-lg font-semibold text-zinc-100">Benchmarks</h2>
              <ul className="card divide-y divide-zinc-800/60 text-sm">
                {c.benchmarks.map((b, i) => (
                  <li key={i} className="px-4 py-2.5 flex items-center justify-between gap-2">
                    <span>
                      {b.name}
                      {b.metric ? <span className="ml-1 text-xs text-zinc-500">({b.metric})</span> : null}
                    </span>
                    <span className="font-mono tabular-nums text-zinc-100">{b.score}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {c.weights.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-lg font-semibold text-zinc-100">Weights</h2>
              <ul className="card divide-y divide-zinc-800/60 text-sm">
                {c.weights.map((w, i) => (
                  <li key={i} className="px-4 py-2.5">
                    <a href={w.url} target="_blank" rel="noreferrer" className="text-emerald-400 hover:text-emerald-300">
                      {w.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      ) : null}

      <p className="text-xs text-zinc-600">
        Prices are per million tokens (USD). “—” means the provider does not publicly list a price for this
        model. Data from models.dev; verify with the provider before purchasing.
      </p>
    </div>
  );
}
