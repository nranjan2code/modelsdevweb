import type { Metadata } from "next";
import Link from "next/link";
import { getCatalog, getNews } from "@/lib/data";
import { fmtAgo } from "@/lib/format";

export const metadata: Metadata = { title: "Model news" };

export default async function NewsPage() {
  const [news, catalog] = await Promise.all([getNews(), getCatalog()]);
  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-50">Model news</h1>
        <p className="text-sm text-zinc-500">
          Daily headlines around the freshest and most-listed models in the catalog, fetched via Tavily.
          Also available as{" "}
          <a href="/rss.xml" className="text-emerald-400 hover:text-emerald-300">
            RSS
          </a>{" "}
          or{" "}
          <a href="/api/news.json" className="text-emerald-400 hover:text-emerald-300">
            JSON
          </a>
          .
        </p>
      </header>
      {news.length === 0 ? (
        <p className="card p-6 text-sm text-zinc-500">
          No news fetched yet — the daily Tavily job will populate this after its next run.
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {news.map((n) => {
            const modelId = n.modelIds.find((id) => catalog.groupById.has(id));
            return (
              <article key={n.id} className="card p-4 flex flex-col gap-1.5">
                <a
                  href={n.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-zinc-100 hover:text-emerald-400 transition-colors"
                >
                  {n.title}
                </a>
                <p className="line-clamp-2 text-xs text-zinc-400">{n.snippet}</p>
                <div className="flex items-center gap-1.5 text-xs text-zinc-500">
                  {n.favicon && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={n.favicon} alt="" width={12} height={12} className="h-3 w-3 rounded-sm" />
                  )}
                  <span className="truncate">{n.source}</span>
                  {n.publishedAt && <span>· {fmtAgo(n.publishedAt)}</span>}
                  {modelId && (
                    <>
                      <span>·</span>
                      <Link href={`/m/${modelId}`} className="shrink-0 hover:text-emerald-400 transition-colors">
                        {catalog.groupById.get(modelId)?.name ?? modelId}
                      </Link>
                    </>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
