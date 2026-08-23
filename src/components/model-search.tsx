"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export interface SearchModel {
  id: string;
  name: string;
  lab: string;
}

export function ModelSearch({ models }: { models: SearchModel[] }) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const router = useRouter();

  const openSearch = useCallback(() => {
    setOpen(true);
    setActiveIndex(0);
    window.requestAnimationFrame(() => input.current?.focus());
  }, []);

  const closeSearch = useCallback(({ restoreFocus = false } = {}) => {
    setOpen(false);
    if (restoreFocus) trigger.current?.focus();
  }, []);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const typing = target?.tagName === "INPUT" || target?.tagName === "TEXTAREA" || target?.isContentEditable;
      if (event.key === "/" && !typing) {
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
  }, [closeSearch, openSearch]);

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

  function onSearchKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setOpen(true);
      setActiveIndex((index) => Math.min(index + 1, Math.max(0, results.length - 1)));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setOpen(true);
      setActiveIndex((index) => Math.max(0, index - 1));
    } else if (event.key === "Home" && open) {
      event.preventDefault();
      setActiveIndex(0);
    } else if (event.key === "End" && open) {
      event.preventDefault();
      setActiveIndex(Math.max(0, results.length - 1));
    } else if (event.key === "Enter" && open && results[activeIndex]) {
      event.preventDefault();
      router.push(`/m/${results[activeIndex].id}`);
      closeSearch();
    }
  }

  const searchField = (
    <>
      <label htmlFor="model-search" className="sr-only">
        Search canonical AI models
      </label>
      <div className="search-shell">
        <span aria-hidden="true" className="search-icon">⌕</span>
        <input
          ref={input}
          id="model-search"
          type="search"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
            setActiveIndex(0);
          }}
          onFocus={() => {
            setOpen(true);
            setActiveIndex(0);
          }}
          onKeyDown={onSearchKeyDown}
          placeholder="Search a model or lab…"
          autoComplete="off"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={open}
          aria-controls="model-search-results"
          aria-activedescendant={open && results[activeIndex] ? `model-search-option-${activeIndex}` : undefined}
          className="min-w-0 flex-1 bg-transparent text-sm text-black outline-none placeholder:text-black/60"
        />
        <button type="button" className="search-close" aria-label="Close search" onClick={() => closeSearch({ restoreFocus: true })}>
          ×
        </button>
      </div>
    </>
  );

  const searchResults = open && (
    <div
      id="model-search-results"
      className="search-results"
      role="listbox"
      aria-label="Model search results"
    >
      {results.length > 0 ? (
        results.map((model, index) => (
          <Link
            key={model.id}
            id={`model-search-option-${index}`}
            href={`/m/${model.id}`}
            role="option"
            aria-selected={index === activeIndex}
            tabIndex={-1}
            onMouseEnter={() => setActiveIndex(index)}
            onClick={() => closeSearch()}
            className="search-result"
          >
            <span className="min-w-0 flex-1 truncate font-medium text-black">{model.name}</span>
            <span className="mono-label shrink-0">{model.lab}</span>
          </Link>
        ))
      ) : (
        <p className="px-3 py-4 text-sm text-black/60">No canonical models match.</p>
      )}
      <Link href="/browse" onClick={() => closeSearch()} className="search-all">
        Open model explorer →
      </Link>
    </div>
  );

  return (
    <div ref={root} className="relative">
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
      {searchResults}
    </div>
  );
}
