"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

export interface SearchModel {
  id: string;
  name: string;
  lab: string;
}

export function ModelSearch({
  models,
  variant = "header",
}: {
  models: SearchModel[];
  variant?: "header" | "hero";
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const typing = target?.tagName === "INPUT" || target?.tagName === "TEXTAREA" || target?.isContentEditable;
      if (variant === "header" && event.key === "/" && !typing) {
        event.preventDefault();
        input.current?.focus();
        setOpen(true);
      }
      if (event.key === "Escape") setOpen(false);
    }
    function onPointer(event: PointerEvent) {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [variant]);

  const results = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return models.slice(0, 6);
    return models
      .filter((model) => `${model.name} ${model.lab} ${model.id}`.toLowerCase().includes(needle))
      .sort((a, b) => {
        const aStarts = a.name.toLowerCase().startsWith(needle);
        const bStarts = b.name.toLowerCase().startsWith(needle);
        return Number(bStarts) - Number(aStarts) || a.name.localeCompare(b.name);
      })
      .slice(0, 8);
  }, [models, query]);

  const hero = variant === "hero";
  return (
    <div ref={root} className={`relative ${hero ? "mx-auto w-full max-w-2xl" : "w-full md:w-64"}`}>
      <label htmlFor={`model-search-${variant}`} className="sr-only">
        Search canonical AI models
      </label>
      <div className={`search-shell ${hero ? "search-shell-hero" : ""}`}>
        <span aria-hidden="true" className="text-black/35">⌕</span>
        <input
          ref={input}
          id={`model-search-${variant}`}
          type="search"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder={hero ? "Search a model, lab, or capability…" : "Search models…"}
          autoComplete="off"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={open}
          aria-controls={`model-search-results-${variant}`}
          className={`min-w-0 flex-1 bg-transparent text-black outline-none placeholder:text-black/35 ${hero ? "text-base" : "text-sm"}`}
        />
        {!hero && <kbd className="kbd-hint">/</kbd>}
      </div>

      {open && (
        <div
          id={`model-search-results-${variant}`}
          className="search-results"
          role="listbox"
          aria-label="Model search results"
        >
          {results.length > 0 ? (
            results.map((model) => (
              <Link
                key={model.id}
                href={`/m/${model.id}`}
                role="option"
                aria-selected="false"
                onClick={() => setOpen(false)}
                className="search-result"
              >
                <span className="min-w-0 flex-1 truncate font-medium text-black">{model.name}</span>
                <span className="mono-label shrink-0">{model.lab}</span>
              </Link>
            ))
          ) : (
            <p className="px-3 py-4 text-sm text-black/45">No canonical models match.</p>
          )}
          <Link href="/browse" onClick={() => setOpen(false)} className="search-all">
            Open model explorer →
          </Link>
        </div>
      )}
    </div>
  );
}
