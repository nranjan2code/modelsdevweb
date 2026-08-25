import type { Metadata } from "next";
import Link from "next/link";
import { getCatalog, getEvents } from "@/lib/data";
import { collapseByModel, marketMoves } from "@/lib/data/brief";
import { EventCard, EventTypeBadge } from "@/components/event-card";
import { fmtPerM } from "@/lib/format";
import type { Event } from "@/lib/pipeline/types";

export const metadata: Metadata = {
  title: "The weekly digest",
  description: "This week in AI model pricing and releases: launches, repricings, sunsets and context races, recapped.",
  alternates: { canonical: "/digest" },
};

const DAY = 86_400_000;

function split(events: Event[]) {
  const now = Date.now();
  const weekAgo = now - 7 * DAY;
  const twoWeeksAgo = now - 14 * DAY;
  const ts = (e: Event) => new Date(`${e.date}T00:00:00Z`).getTime();
  return {
    current: events.filter((e) => ts(e) >= weekAgo),
    previous: events.filter((e) => ts(e) < weekAgo && ts(e) >= twoWeeksAgo),
  };
}

function countOf(list: Event[], type: Event["type"]): number {
  return list.filter((e) => e.type === type).length;
}

function biggestCut(list: Event[]) {
  let best: { name: string; id: string | null; oldV: number; newV: number; date: string } | null = null;
  for (const e of list) {
    if (e.type !== "repriced") continue;
    for (const c of e.changes) {
      if (c.field === "cost.input" && typeof c.old === "number" && typeof c.new === "number" && c.new < c.old) {
        if (!best || c.old / c.new > best.oldV / best.newV) {
          best = { name: e.modelName, id: e.canonicalId, oldV: c.old, newV: c.new, date: e.date };
        }
      }
    }
  }
  return best;
}

function busiestDay(list: Event[]): { date: string; count: number } | null {
  const counts = new Map<string, number>();
  for (const e of list) counts.set(e.date, (counts.get(e.date) ?? 0) + 1);
  let out: { date: string; count: number } | null = null;
  for (const [date, count] of counts) if (!out || count > out.count) out = { date, count };
  return out;
}

export default async function DigestPage() {
  const [events, catalog] = await Promise.all([getEvents(), getCatalog()]);
  const { current, previous } = split(events);

  const launches = current.filter((e) => e.type === "model_added");
  const sunsets = current.filter((e) => e.type === "deprecated");
  const contextMoves = current.filter((e) => e.type === "context_changed" || e.type === "capability_changed");
  // Same split the front page uses: a lab repricing its model is the story, a
  // gateway adjusting its markup is context.
  const moves = marketMoves(events, catalog, 7);
  const labMoves = collapseByModel(moves.firstParty);
  const streetMoves = collapseByModel(moves.street);
  const cut = biggestCut(current);
  const busy = busiestDay(current);

  const intro =
    current.length === 0
      ? "No diffs landed this week yet — the hourly sync is watching and this page fills itself."
      : `${current.length} change${current.length === 1 ? "" : "s"} hit the catalog this week: ${
          countOf(current, "repriced") > 0 ? `${countOf(current, "repriced")} repricing${countOf(current, "repriced") === 1 ? "" : "s"}, ` : ""
        }${countOf(current, "model_added") > 0 ? `${countOf(current, "model_added")} launch${countOf(current, "model_added") === 1 ? "" : "es"}, ` : ""}${
          countOf(current, "deprecated") > 0 ? `${countOf(current, "deprecated")} sunset${countOf(current, "deprecated") === 1 ? "" : "s"}, ` : ""
        }and ${countOf(current, "context_changed") + countOf(current, "capability_changed")} spec shift${
          countOf(current, "context_changed") + countOf(current, "capability_changed") === 1 ? "" : "s"
        }.${busy && busy.count > 2 ? ` The busiest day was ${busy.date} with ${busy.count} moves.` : ""}`;

  const prevSummary =
    previous.length > 0
      ? `${previous.length} changes last week (${countOf(previous, "repriced")} repricings, ${countOf(previous, "model_added")} launches, ${countOf(previous, "deprecated")} sunsets).`
      : null;

  return (
    <div className="space-y-10">
      <header className="page-intro">
        <p className="mono-label text-special">Weekly recap · auto-written from the diff log</p>
        <h1 className="text-3xl font-bold tracking-tight text-black sm:text-4xl">This week in AI pricing</h1>
        <p className="max-w-2xl text-sm leading-relaxed text-black/60">{intro}</p>
        <div className="flex flex-wrap gap-3 pt-1 text-xs">
          <Link
            href="/changelog"
            className="button-secondary"
          >
            Full changelog
          </Link>
          <a
            href="/rss.xml"
            className="button-secondary"
          >
            Subscribe via RSS
          </a>
        </div>
      </header>

      {cut && (
        <section className="card p-6">
          <p className="mono-label text-pos">Cut of the week</p>
          <h2 className="mt-2 text-2xl font-bold tracking-tight text-black">
            {cut.name}: {fmtPerM(cut.oldV)} → {fmtPerM(cut.newV)} /M input{" "}
            <span className="text-pos">(−{Math.round((1 - cut.newV / cut.oldV) * 100)}%)</span>
          </h2>
          {cut.id && (
            <Link href={`/m/${cut.id}`} className="mt-3 inline-block text-sm font-semibold text-accent underline decoration-wavy underline-offset-4 hover:text-accent-strong">
              All its provider prices →
            </Link>
          )}
        </section>
      )}

      <section className="grid gap-4 md:grid-cols-2">
        <div className="card min-w-0 p-4">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between sm:gap-2">
            <h2 className="font-hand text-2xl font-bold text-black">The labs moved</h2>
            <p className="mono-label">first-party pricing</p>
          </div>
          {labMoves.length === 0 ? (
            <p className="py-6 text-center text-sm text-black/60">No lab changed its own pricing this week.</p>
          ) : (
            <ol className="divide-y divide-black/10 text-sm">
              {labMoves.map((m, i) => (
                <li key={`${m.id}-${i}`} className="flex items-center gap-2 py-2.5">
                  <span className="w-5 shrink-0 tabular-nums text-black/60">{i + 1}.</span>
                  <span className="min-w-0 flex-1 truncate">{m.name}</span>
                  <span className="font-mono text-xs tabular-nums text-black/60">
                    {fmtPerM(m.from)}→{fmtPerM(m.to)}
                  </span>
                  <span className={`w-12 shrink-0 text-right font-mono font-bold tabular-nums ${m.pct < 0 ? "text-pos" : "text-neg"}`}>
                    {m.pct > 0 ? "+" : ""}{(m.pct * 100).toFixed(0)}%
                  </span>
                </li>
              ))}
            </ol>
          )}
        </div>
        <div className="card min-w-0 p-4">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between sm:gap-2">
            <h2 className="font-hand text-2xl font-bold text-black">The street moved</h2>
            <p className="mono-label">gateway markup</p>
          </div>
          {streetMoves.length === 0 ? (
            <p className="py-6 text-center text-sm text-black/60">No reseller changed its listing this week.</p>
          ) : (
            <ol className="divide-y divide-black/10 text-sm">
              {streetMoves.slice(0, 8).map((m, i) => (
                <li key={`${m.id}-${i}`} className="flex items-center gap-2 py-2.5">
                  <span className="w-5 shrink-0 tabular-nums text-black/60">{i + 1}.</span>
                  <span className="min-w-0 flex-1 truncate">{m.name}</span>
                  <span className="font-mono text-xs tabular-nums text-black/60">
                    {fmtPerM(m.from)}→{fmtPerM(m.to)}
                  </span>
                  <span className={`w-12 shrink-0 text-right font-mono font-bold tabular-nums ${m.pct < 0 ? "text-pos" : "text-neg"}`}>
                    {m.pct > 0 ? "+" : ""}{(m.pct * 100).toFixed(0)}%
                  </span>
                </li>
              ))}
            </ol>
          )}
        </div>
      </section>

      {launches.length > 0 && (
        <section>
          <h2 className="mb-4 font-hand text-3xl font-bold tracking-tight text-black">
            Launches <span className="mono-label align-middle">{launches.length}</span>
          </h2>
          <div className="border-y border-black/15">
            {launches.slice(0, 9).map((e) => (
              <EventCard key={e.id} event={e} />
            ))}
          </div>
        </section>
      )}

      {sunsets.length > 0 && (
        <section>
          <h2 className="mb-4 font-hand text-3xl font-bold tracking-tight text-black">
            Sunsets <span className="mono-label align-middle">{sunsets.length}</span>
          </h2>
          <ul className="card divide-y divide-black/10 text-sm">
            {sunsets.map((e) => (
              <li key={e.id} className="flex flex-wrap items-center gap-2 px-4 py-2.5">
                <EventTypeBadge type={e.type} />
                <span className="font-medium">{e.modelName}</span>
                {e.providerId && <span className="text-xs text-black/60">via {e.providerId}</span>}
              </li>
            ))}
          </ul>
        </section>
      )}

      {contextMoves.length > 0 && (
        <section>
          <h2 className="mb-4 font-hand text-3xl font-bold tracking-tight text-black">Spec shifts</h2>
          <div className="border-y border-black/15">
            {contextMoves.slice(0, 6).map((e) => (
              <EventCard key={e.id} event={e} />
            ))}
          </div>
        </section>
      )}

      {(prevSummary || previous.length > 0) && (
        <section className="card-dashed p-6">
          <h2 className="font-hand text-2xl font-bold text-black">Last week’s tape</h2>
          <p className="mt-2 text-sm text-black/60">{prevSummary}</p>
          <ul className="mt-3 space-y-1 text-sm">
            {previous.slice(0, 5).map((e) => (
              <li key={e.id} className="flex items-center gap-2">
                <EventTypeBadge type={e.type} />
                <span>{e.modelName}</span>
                <span className="text-xs text-black/60">{e.date}</span>
              </li>
            ))}
          </ul>
          {previous.length > 5 && (
            <Link
              href="/changelog?days=30"
              className="mt-3 inline-block text-sm font-medium text-accent underline decoration-wavy underline-offset-4 hover:text-accent-strong"
            >
              +{previous.length - 5} more in the changelog →
            </Link>
          )}
        </section>
      )}
    </div>
  );
}
