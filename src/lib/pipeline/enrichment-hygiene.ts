import type { ExternalSignal } from "./external-types";
import type { NewsItem } from "./types";

export function pruneExternalSignals(
  signals: ExternalSignal[],
  validGroupIds: ReadonlySet<string>,
): { signals: ExternalSignal[]; removed: number } {
  const kept = signals.filter((signal) => validGroupIds.has(signal.modelId));
  return { signals: kept, removed: signals.length - kept.length };
}

export function sanitizeNewsLinks(
  items: NewsItem[],
  groupLabs: ReadonlyMap<string, string>,
): { items: NewsItem[]; removed: number } {
  let removed = 0;
  const clean = items.map((item) => {
    const modelIds = [...new Set(item.modelIds.filter((id) => groupLabs.has(id)))];
    removed += item.modelIds.length - modelIds.length;
    const labIds = [...new Set(modelIds.map((id) => groupLabs.get(id)!).filter(Boolean))];
    return { ...item, modelIds, labIds };
  });
  return { items: clean, removed };
}
