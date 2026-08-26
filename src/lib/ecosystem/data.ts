import { readFile } from "node:fs/promises";
import path from "node:path";
import type { EcosystemSnapshot } from "./types";

const FILE = path.join(process.cwd(), "snapshots", "ecosystem", "latest.json");

export async function getEcosystemSnapshot(): Promise<EcosystemSnapshot> {
  try {
    return JSON.parse(await readFile(FILE, "utf8")) as EcosystemSnapshot;
  } catch {
    return { fetchedAt: "", date: "", license: "", entities: [], signals: [], scores: [] };
  }
}
