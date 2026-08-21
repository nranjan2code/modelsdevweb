import { createHmac } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { selectEvents, type Watcher } from "../src/lib/pipeline/watch";
import type { Event } from "../src/lib/pipeline/types";

const ROOT = path.dirname(import.meta.dirname);
const SECRET = process.env.WATCHER_SECRET ?? "";

async function readJson<T>(file: string, fallback: T): Promise<T> {
  try {
    return JSON.parse(await readFile(path.join(ROOT, file), "utf8")) as T;
  } catch {
    return fallback;
  }
}

async function post(url: string, body: string): Promise<number> {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (SECRET) {
    headers["x-model-pulse-signature"] = `sha256=${createHmac("sha256", SECRET).update(body).digest("hex")}`;
  }
  const res = await fetch(url, { method: "POST", headers, body, signal: AbortSignal.timeout(10_000) });
  return res.status;
}

async function main(): Promise<void> {
  const watchers = await readJson<Watcher[]>("watchers.json", []);
  if (watchers.length === 0) {
    console.log("[notify] no watchers configured");
    return;
  }
  const events = await readJson<Event[]>("events/index.json", []);
  const notified = new Set(await readJson<string[]>("events/notified.json", []));
  const selections = selectEvents(events, notified, watchers);
  if (selections.length === 0) {
    console.log("[notify] nothing new to deliver");
    return;
  }
  for (const { watcher, events: batch } of selections) {
    const body = JSON.stringify({
      type: "model-pulse.watch",
      sentAt: new Date().toISOString(),
      filter: { types: watcher.types ?? null, labs: watcher.labs ?? null },
      events: batch,
    });
    try {
      const status = await post(watcher.url, body);
      if (status >= 200 && status < 300) {
        for (const e of batch) notified.add(e.id);
        console.log(`[notify] ${watcher.url} <- ${batch.length} events (${status})`);
      } else {
        console.error(`[notify] ${watcher.url} responded ${status}; will retry next run`);
      }
    } catch (err) {
      console.error(`[notify] ${watcher.url} failed:`, err instanceof Error ? err.message : err);
    }
  }
  await writeFile(path.join(ROOT, "events", "notified.json"), JSON.stringify([...notified]));
}

main().catch((err) => {
  console.error("[notify] failed:", err);
  process.exit(1);
});
