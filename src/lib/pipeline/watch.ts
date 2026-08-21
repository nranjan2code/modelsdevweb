import type { Event } from "./types";

export interface Watcher {
  url: string;
  types?: string[];
  labs?: string[];
}

export function selectEvents(
  events: Event[],
  notifiedIds: Set<string>,
  watchers: Watcher[],
): { watcher: Watcher; events: Event[] }[] {
  return watchers
    .map((watcher) => ({
      watcher,
      events: events.filter(
        (e) =>
          !notifiedIds.has(e.id) &&
          (!watcher.types || watcher.types.includes(e.type)) &&
          (!watcher.labs || (e.labId != null && watcher.labs.includes(e.labId))),
      ),
    }))
    .filter((selection) => selection.events.length > 0);
}
