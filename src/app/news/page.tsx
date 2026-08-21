import type { Metadata } from "next";
import Link from "next/link";
import { getCatalog, getNews } from "@/lib/data";
import { fmtAgo } from "@/lib/format";

export const metadata: Metadata = { title: "Model news" };

export default async function NewsPage() {
  const [news, catalog] = await Promise.all([getNews(), getCatalog()]);
  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <p className="mono-label">Daily briefing</p>
        <h1 className="text-3xl font-bold tracking-tight text-black sm:text-4xl">Model news</h1>
        <p className="max-w-2xl text-sm leading-relaxed text-black/55">
          Daily headlines around the freshest and most-listed models in the catalog, fetched via Tavily.
          Also available as{" "}
          <a href="/rss.xml" className="font-medium text-blue-600 underline decoration-wavy underline-offset-4 hover:text-blue-700">
            RSS
          </a>{" "}
          or{" "}
          <a href="/api/news.json" className="font-medium text-blue-600 underline decoration-wavy underline-offset-4 hover:text-blue-700">
            JSON
          </a>
          .
        </p>
      </header>
      {news.length === 0 ? (
        <p className="card-dashed p-6 text-sm text-black/50">
          No news fetched yet — the daily Tavily job will populate this after its next run.
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {news.map((n) => {
            const modelId = n.modelIds.find((id) => catalog.groupById.has(id));
            return (
              <article key={n.id} className="card lift flex flex-col gap-1.5 p-4">
                <a
                  href={n.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-black transition-colors hover:text-blue-600"
                >
                  {n.title}
                </a>
                <p className="line-clamp-2 text-xs leading-relaxed text-black/55">{n.snippet}</p>
                <div className="flex items-center gap-1.5 text-xs text-black/45">
                  {n.favicon && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={n.favicon} alt="" width={12} height={12} className="h-3 w-3 rounded-sm" />
                  )}
                  <span className="truncate">{n.source}</span>
                  {n.publishedAt && <span>· {fmtAgo(n.publishedAt)}</span>}
                  {modelId && (
                    <>
                      <span>·</span>
                      <Link
                        href={`/m/${modelId}`}
                        className="shrink-0 rounded-full border border-black/15 bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-700 transition-colors hover:border-blue-600"
                      >
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
