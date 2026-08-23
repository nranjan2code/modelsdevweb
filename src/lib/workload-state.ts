/**
 * The reader's chosen workload, held client-side.
 *
 * The site is a static export, so every workload's figures are computed at
 * build time and the switcher only picks which precomputed column to show.
 * Same `useSyncExternalStore` shape as `compare.ts` — never useState+useEffect,
 * which the `react-hooks/set-state-in-effect` rule rejects.
 */

import { useSyncExternalStore } from "react";
import { DEFAULT_WORKLOAD_ID, workloadById, type Workload } from "./economics/workload";

export const WORKLOAD_KEY = "model-pulse:workload";

let cache: string | null = null;
const listeners = new Set<() => void>();

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);
  const onStorage = (e: StorageEvent) => {
    if (e.key === WORKLOAD_KEY || e.key === null) {
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

function getSnapshot(): string {
  if (cache == null) {
    let stored: string | null = null;
    try {
      stored = window.localStorage.getItem(WORKLOAD_KEY);
    } catch {
      /* private mode — fall through to the default */
    }
    cache = workloadById(stored).id;
  }
  return cache;
}

/**
 * The server snapshot must be the default, so the first paint matches what the
 * build computed and hydration stays stable.
 */
function getServerSnapshot(): string {
  return DEFAULT_WORKLOAD_ID;
}

export function setWorkload(id: string): void {
  const next = workloadById(id).id;
  cache = next;
  try {
    window.localStorage.setItem(WORKLOAD_KEY, next);
  } catch {
    /* keep the in-memory choice anyway */
  }
  for (const l of listeners) l();
}

export function useWorkloadId(): string {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

export function useWorkload(): Workload {
  return workloadById(useWorkloadId());
}
