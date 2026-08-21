import { useSyncExternalStore } from "react";

export const COMPARE_KEY = "llm-pulse:compare";
export const COMPARE_MAX = 4;

const EMPTY: string[] = [];
let cache: string[] | null = null;
const listeners = new Set<() => void>();

function parse(raw: string | null): string[] {
  try {
    const arr: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr.filter((x): x is string => typeof x === "string").slice(0, COMPARE_MAX) : [];
  } catch {
    return [];
  }
}

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);
  const onStorage = (e: StorageEvent) => {
    if (e.key === COMPARE_KEY || e.key === null) {
      cache = null;
      onChange();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onStorage);
  };
}

function getSnapshot(): string[] {
  if (cache == null) cache = parse(window.localStorage.getItem(COMPARE_KEY));
  return cache;
}

function getServerSnapshot(): string[] {
  return EMPTY;
}

/** Current selection without subscribing (for event handlers / one-off reads). */
export function peekCompare(): string[] {
  return typeof window === "undefined" ? EMPTY : getSnapshot();
}

export function setCompare(next: string[]): void {
  const ids = next.slice(0, COMPARE_MAX);
  cache = ids;
  try {
    window.localStorage.setItem(COMPARE_KEY, JSON.stringify(ids));
  } catch {
    /* private mode / quota — keep in-memory selection anyway */
  }
  for (const l of listeners) l();
}

export function toggleCompare(id: string): void {
  const cur = peekCompare();
  setCompare(cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]);
}

/** Reactive selection list; server snapshot is empty so hydration stays stable. */
export function useCompareSelection(): string[] {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/** Model ids passed as ?models=a,b,c (client only). */
export function readModelsParam(): string[] {
  if (typeof window === "undefined") return EMPTY;
  try {
    const q = new URLSearchParams(window.location.search).get("models");
    if (!q) return EMPTY;
    return q
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, COMPARE_MAX);
  } catch {
    return EMPTY;
  }
}

export function compareUrl(ids: string[]): string | null {
  if (typeof window === "undefined" || ids.length === 0) return null;
  return `${window.location.pathname}?models=${ids.map(encodeURIComponent).join(",")}`;
}
