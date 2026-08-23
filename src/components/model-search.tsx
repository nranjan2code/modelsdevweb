"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

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
  const trigger = useRef<HTMLButtonElement>(null);
  const hero = variant === "hero";

  const openSearch = useCallback(() => {
    setOpen(true);
    window.requestAnimationFrame(() => input.current?.focus());
  }, []);

  const closeSearch = useCallback(({ restoreFocus = false } = {}) => {
    setOpen(false);
    if (restoreFocus && !hero) trigger.current?.focus();
  }, [hero]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const typing = target?.tagName === "INPUT" || target?.tagName === "TEXTAREA" || target?.isContentEditable;
      if (variant === "header" && event.key === "/" && !typing) {
        event.preventDefault();
        openSearch();
      }
      if (event.key === "Escape") closeSearch({ restoreFocus: true });
    }
    function onPointer(event: PointerEvent) {
      if (!root.current?.contains(event.target as Node)) closeSearch();
    }
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [closeSearch, openSearch, variant]);

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

  const searchField = (
    <>
      <label htmlFor={`model-search-${variant}`} className="sr-only">
        Search canonical AI models
      </label>
      <div className={`search-shell ${hero ? "search-shell-hero" : ""}`}>
        <span aria-hidden="true" className="search-icon">⌕</span>
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
          placeholder={hero ? "Search a model, lab, or capability…" : "Search a model or lab…"}
          autoComplete="off"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={open}
          aria-controls={`model-search-results-${variant}`}
          className={`min-w-0 flex-1 bg-transparent text-black outline-none placeholder:text-black/35 ${hero ? "text-base" : "text-sm"}`}
        />
        {!hero && (
          <button type="button" className="search-close" aria-label="Close search" onClick={() => closeSearch({ restoreFocus: true })}>
            ×
          </button>
        )}
      </div>
    </>
  );

  const searchResults = open && (
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
            onClick={() => closeSearch()}
            className="search-result"
          >
            <span className="min-w-0 flex-1 truncate font-medium text-black">{model.name}</span>
            <span className="mono-label shrink-0">{model.lab}</span>
          </Link>
        ))
      ) : (
        <p className="px-3 py-4 text-sm text-black/45">No canonical models match.</p>
      )}
      <Link href="/browse" onClick={() => closeSearch()} className="search-all">
        Open model explorer →
      </Link>
    </div>
  );

  return (
    <div ref={root} className={`relative ${hero ? "mx-auto w-full max-w-2xl" : ""}`}>
      {hero ? searchField : (
        <>
          <button
            ref={trigger}
            type="button"
            className="search-trigger"
            aria-expanded={open}
            aria-controls="header-search-panel"
            aria-label="Search models"
            onClick={() => (open ? closeSearch() : openSearch())}
          >
            <span aria-hidden="true" className="search-icon">⌕</span>
            <span className="hidden lg:inline">Search</span>
            <kbd className="kbd-hint hidden xl:inline">/</kbd>
          </button>
          {open && <div id="header-search-panel" className="search-panel">{searchField}</div>}
        </>
      )}
      {searchResults}
    </div>
  );
}
