import Link from "next/link";
import type { Event, EventType } from "@/lib/pipeline/types";
import { fmtDate, fmtPerM, fmtTokens } from "@/lib/format";

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
  if (c.field.startsWith("cost.")) {
    const f = (v: unknown) => (typeof v === "number" ? fmtPerM(v) : String(v ?? "—"));
    return `${c.field.replace("cost.", "")}: ${f(c.old)} → ${f(c.new)}`;
  }
  if (c.field.startsWith("limit.")) {
    const f = (n: unknown) => (typeof n === "number" ? fmtTokens(n) : "—");
    return `${c.field.replace("limit.", "")}: ${f(c.old)} → ${f(c.new)} tokens`;
  }
  const f = (v: unknown) => String(v ?? "—");
  return `${c.field}: ${f(c.old)} → ${f(c.new)}`;
}

/**
 * Safe deep-link target for an event. Removals never link — their
 * model/provider pages may no longer exist. Provider additions link to the
 * provider page; everything else links to the model page when resolvable.
 */
export function eventTarget(event: Event): string | null {
  if (event.type === "model_removed" || event.type === "provider_removed") return null;
  if ((event.type === "provider_added" || event.type === "capability_changed") && event.providerId && !event.canonicalId) {
    return `/provider/${event.providerId}`;
  }
  return event.canonicalId ? `/m/${event.canonicalId}` : null;
}

export function EventCard({ event, href }: { event: Event; href?: string | null }) {
  const target = href !== undefined ? href : eventTarget(event);
  const body = (
    <>
      <div className="flex items-center gap-2 flex-wrap">
        <EventTypeBadge type={event.type} />
        {target ? (
          <span className="font-medium text-black group-hover:text-blue-600 transition-colors">
            {event.modelName}
          </span>
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
    </>
  );
  const cls = "card lift group flex flex-col gap-1.5 p-4";
  return target ? (
    <Link href={target} className={`${cls} transition-colors hover:border-blue-600`}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}
