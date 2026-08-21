import Link from "next/link";
import type { Event, EventType } from "@/lib/pipeline/types";
import { fmtDate } from "@/lib/format";

const TYPE_STYLES: Record<EventType, { label: string; cls: string }> = {
  model_added: { label: "new model", cls: "bg-emerald-500/10 text-emerald-400" },
  provider_added: { label: "new provider", cls: "bg-teal-500/10 text-teal-300" },
  repriced: { label: "repriced", cls: "bg-violet-500/10 text-violet-300" },
  deprecated: { label: "deprecated", cls: "bg-red-500/10 text-red-400" },
  context_changed: { label: "context", cls: "bg-sky-500/10 text-sky-300" },
  capability_changed: { label: "capability", cls: "bg-amber-500/10 text-amber-300" },
  model_removed: { label: "removed", cls: "bg-zinc-700/40 text-zinc-400" },
  provider_removed: { label: "provider left", cls: "bg-zinc-700/40 text-zinc-400" },
};

export function EventTypeBadge({ type }: { type: EventType }) {
  const s = TYPE_STYLES[type];
  return (
    <span className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[11px] font-medium ${s.cls}`}>
      {s.label}
    </span>
  );
}

function changeText(c: Event["changes"][number]): string {
  const fmt = (v: unknown) => (typeof v === "number" ? `$${v}` : String(v ?? "—"));
  if (c.field.startsWith("cost.")) return `${c.field.replace("cost.", "")}: ${fmt(c.old)} → ${fmt(c.new)}`;
  if (c.field === "limit.context") {
    const f = (n: unknown) => (typeof n === "number" ? `${(n / 1000).toFixed(0)}K` : "—");
    return `context: ${f(c.old)} → ${f(c.new)} tokens`;
  }
  return `${c.field}: ${fmt(c.old)} → ${fmt(c.new)}`;
}

export function EventCard({ event }: { event: Event }) {
  const href = event.canonicalId ? `/m/${event.canonicalId}` : null;
  return (
    <div className="card p-4 flex flex-col gap-1.5">
      <div className="flex items-center gap-2 flex-wrap">
        <EventTypeBadge type={event.type} />
        {href ? (
          <Link href={href} className="font-medium text-zinc-100 hover:text-emerald-400 transition-colors">
            {event.modelName}
          </Link>
        ) : (
          <span className="font-medium text-zinc-100">{event.modelName}</span>
        )}
        <span className="text-xs text-zinc-500">
          {event.providerId ? `via ${event.providerId}` : ""} · {fmtDate(event.date)}
        </span>
      </div>
      {event.changes.length > 0 && (
        <ul className="text-xs text-zinc-400 space-y-0.5">
          {event.changes.slice(0, 4).map((c, i) => (
            <li key={i} className="font-mono">
              {changeText(c)}
            </li>
          ))}
          {event.changes.length > 4 && <li>+{event.changes.length - 4} more</li>}
        </ul>
      )}
    </div>
  );
}
