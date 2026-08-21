import type { Metadata } from "next";
import { SearchUI } from "@/components/search-ui";

export const metadata: Metadata = { title: "Search" };

export default function SearchPage() {
  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <p className="mono-label">Find anything</p>
        <h1 className="text-3xl font-bold tracking-tight text-black sm:text-4xl">Search</h1>
        <p className="max-w-2xl text-sm leading-relaxed text-black/55">
          Full-text search across all model, provider and lab pages. Powered by Pagefind, runs entirely in
          your browser.
        </p>
      </header>
      <SearchUI />
    </div>
  );
}
