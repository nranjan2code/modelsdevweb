"use client";

import { useEffect, useRef, useState } from "react";

interface Result {
  url: string;
  title: string;
  excerpt: string;
}

interface PagefindApi {
  search: (q: string) => Promise<{ results: { data: () => Promise<{ url: string; meta?: Record<string, string>; excerpt: string }> }[] }>;
}

export function SearchUI() {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Result[]>([]);
  const [ready, setReady] = useState(false);
  const pf = useRef<PagefindApi | null>(null);

  useEffect(() => {
    const script = document.createElement("script");
    script.src = "/pagefind/pagefind.js";
    script.onload = () => {
      const load = new Function("return import('/pagefind/pagefind.js')") as () => Promise<PagefindApi>;
      load()
        .then((api) => {
          pf.current = api;
          setReady(true);
        })
        .catch(() => setReady(false));
    };
    document.body.appendChild(script);
    return () => {
      script.remove();
    };
  }, []);

  useEffect(() => {
    const needle = q.trim();
    if (!pf.current || needle.length < 2) {
      setResults([]);
      return;
    }
    let cancelled = false;
    const t = setTimeout(() => {
      pf.current!
        .search(needle)
        .then(async (res) => {
          const data = await Promise.all(res.results.slice(0, 20).map((r) => r.data()));
          if (!cancelled) {
            setResults(data.map((d) => ({ url: d.url, title: d.meta?.title ?? d.url, excerpt: d.excerpt })));
          }
        })
        .catch(() => {
          if (!cancelled) setResults([]);
        });
    }, 120);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [q]);

  return (
    <div className="space-y-4">
      <input
        className="input w-full max-w-xl"
        placeholder={ready ? "Search models, providers, labs…" : "Loading search index…"}
        value={q}
        onChange={(e) => setQ(e.target.value)}
        disabled={!ready}
        autoFocus
      />
      <div className="space-y-3">
        {results.map((r) => (
          <a
            key={r.url}
            href={r.url}
            className="card block p-4 hover:border-emerald-700/60 transition-colors"
          >
            <div className="font-medium text-zinc-100">{r.title}</div>
            <div
              className="mt-1 text-sm text-zinc-400 [&_mark]:bg-emerald-500/20 [&_mark]:text-emerald-300 [&_mark]:rounded [&_mark]:px-0.5"
              dangerouslySetInnerHTML={{ __html: r.excerpt }}
            />
          </a>
        ))}
        {q.trim().length >= 2 && results.length === 0 && ready && (
          <p className="text-sm text-zinc-500">No results for “{q}”.</p>
        )}
      </div>
    </div>
  );
}
