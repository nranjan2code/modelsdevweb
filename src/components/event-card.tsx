import Link from "next/link";
import type { Event, EventType } from "@/lib/pipeline/types";
import { fmtDate, fmtPerM, fmtTokens } from "@/lib/format";
import { Badge, type Tone } from "@/components/ui";

/*
 * Event-type -> tone mapping follows docs/brand.md §3.2: hue encodes kind
 * (good / costly / notable / informational), never identity.
 */
const TYPE_STYLES: Record<EventType, { label: string; tone: Tone }> = {
  model_added: { label: "new model", tone: "pos" },
  provider_added: { label: "new provider", tone: "accent" },
  repriced: { label: "repriced", tone: "special" },
  deprecated: { label: "deprecated", tone: "neg" },
  context_changed: { label: "context", tone: "accent" },
  capability_changed: { label: "capability", tone: "warn" },
  model_removed: { label: "removed", tone: "muted" },
  provider_removed: { label: "provider left", tone: "muted" },
};

export function EventTypeBadge({ type }: { type: EventType }) {
  const s = TYPE_STYLES[type];
  return <Badge tone={s.tone}>{s.label}</Badge>;
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
          <span className="font-medium text-black group-hover:text-accent transition-colors">
            {event.modelName}
          </span>
        ) : (
          <span className="font-medium text-black">{event.modelName}</span>
        )}
        <span className="text-xs text-black/60">
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
  const cls = "group flex min-h-20 flex-col justify-center gap-1.5 border-b border-black/10 py-4 last:border-b-0";
  return target ? (
    <Link href={target} className={`${cls} transition-colors hover:border-accent`}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}
