import type { Metadata } from "next";
import { SearchUI } from "@/components/search-ui";

export const metadata: Metadata = { title: "Search" };

export default function SearchPage() {
  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-50">Search</h1>
        <p className="text-sm text-zinc-500">
          Full-text search across all model, provider and lab pages. Powered by Pagefind, runs entirely in
          your browser.
        </p>
      </header>
      <SearchUI />
    </div>
  );
}
