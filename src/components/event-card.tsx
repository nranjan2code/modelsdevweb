import Link from "next/link";
import type { Event, EventType } from "@/lib/pipeline/types";
import { fmtDate } from "@/lib/format";

const TYPE_STYLES: Record<EventType, { label: string; cls: string }> = {
  model_added: { label: "new model", cls: "bg-emerald-50 text-emerald-700 border-emerald-600/30" },
  provider_added: { label: "new provider", cls: "bg-teal-50 text-teal-700 border-teal-600/30" },
  repriced: { label: "repriced", cls: "bg-purple-50 text-purple-700 border-purple-600/30" },
  deprecated: { label: "deprecated", cls: "bg-red-50 text-red-600 border-red-500/30" },
  context_changed: { label: "context", cls: "bg-blue-50 text-blue-700 border-blue-600/30" },
  capability_changed: { label: "capability", cls: "bg-amber-50 text-amber-700 border-amber-600/40" },
  model_removed: { label: "removed", cls: "bg-black/5 text-black/50 border-black/15" },
  provider_removed: { label: "provider left", cls: "bg-black/5 text-black/50 border-black/15" },
};

export function EventTypeBadge({ type }: { type: EventType }) {
  const s = TYPE_STYLES[type];
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold ${s.cls}`}>
      {s.label}
    </span>
  );
}

export function changeText(c: Event["changes"][number]): string {
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
    <div className="card lift flex flex-col gap-1.5 p-4">
      <div className="flex items-center gap-2 flex-wrap">
        <EventTypeBadge type={event.type} />
        {href ? (
          <Link href={href} className="font-medium text-black hover:text-blue-600 transition-colors">
            {event.modelName}
          </Link>
        ) : (
          <span className="font-medium text-black">{event.modelName}</span>
        )}
        <span className="text-xs text-black/45">
          {event.providerId ? `via ${event.providerId} · ` : ""}
          <time dateTime={event.date}>{fmtDate(event.date)}</time>
        </span>
      </div>
      {event.changes.length > 0 && (
        <ul className="space-y-0.5 font-mono text-xs text-black/60">
          {event.changes.slice(0, 4).map((c, i) => (
            <li key={i}>{changeText(c)}</li>
          ))}
          {event.changes.length > 4 && <li>+{event.changes.length - 4} more</li>}
        </ul>
      )}
    </div>
  );
}
