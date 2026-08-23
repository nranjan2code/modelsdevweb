import Link from "next/link";
import type { Event, EventType } from "@/lib/pipeline/types";
import { fmtDate, fmtPerM, fmtTokens } from "@/lib/format";
import { Badge, DeltaChip, type Tone } from "@/components/ui";

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

function changeLabel(field: string): string {
  const labels: Record<string, string> = {
    "cost.input": "Input price",
    "cost.output": "Output price",
    "cost.cache_read": "Cache read",
    "limit.context": "Context",
    "limit.input": "Input limit",
    "limit.output": "Output limit",
  };
  return labels[field] ?? field.replace(/^(cost|limit)\./, "").replaceAll("_", " ");
}

function changeValue(field: string, value: unknown): string {
  if (field.startsWith("cost.")) return typeof value === "number" ? `${fmtPerM(value)}/M` : String(value ?? "—");
  if (field.startsWith("limit.")) return typeof value === "number" ? fmtTokens(value) : "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return String(value ?? "—");
}

function ChangeIndicator({ change }: { change: Event["changes"][number] }) {
  if (
    change.field.startsWith("cost.") &&
    typeof change.old === "number" &&
    typeof change.new === "number" &&
    change.old > 0 &&
    change.old !== change.new
  ) {
    return <DeltaChip down={change.new < change.old} pct={(change.new - change.old) / change.old} />;
  }
  if (
    change.field.startsWith("limit.") &&
    typeof change.old === "number" &&
    typeof change.new === "number" &&
    change.old > 0 &&
    change.old !== change.new
  ) {
    const multiple = change.new / change.old;
    return (
      <Badge tone="accent" mono>
        {multiple >= 1 ? `${Number(multiple.toFixed(1))}×` : `−${Math.round((1 - multiple) * 100)}%`}
      </Badge>
    );
  }
  if (typeof change.new === "boolean") {
    return <Badge tone={change.new ? "pos" : "muted"}>{change.new ? "Enabled" : "Removed"}</Badge>;
  }
  return null;
}

function eventSummary(event: Event): string {
  const summaries: Record<EventType, string> = {
    model_added: "First observed in the model catalog",
    model_removed: "Removed from the model catalog",
    provider_added: event.providerId ? `${event.providerId} began listing this model` : "A provider began listing this model",
    provider_removed: event.providerId ? `${event.providerId} stopped listing this model` : "A provider stopped listing this model",
    repriced: "Serving price changed",
    deprecated: "Marked as deprecated",
    context_changed: "Published token limit changed",
    capability_changed: "Published capability changed",
  };
  return summaries[event.type];
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

export function EventCard({ event, href, layout = "compact" }: { event: Event; href?: string | null; layout?: "compact" | "ledger" }) {
  const target = href !== undefined ? href : eventTarget(event);
  if (layout === "ledger") {
    const ledgerBody = (
      <>
        <div className="min-w-0 lg:col-span-4">
          <div className="mb-2">
            <EventTypeBadge type={event.type} />
          </div>
          <span className="block truncate text-base font-semibold text-black transition-colors group-hover:text-accent">
            {event.modelName}
          </span>
          <p className="mt-1 truncate text-xs text-black/60">
            {event.providerId ? `via ${event.providerId}` : "Catalog-level change"}
          </p>
        </div>

        <div className="min-w-0 lg:col-span-7">
          <p className="mono-label mb-2 lg:hidden">What changed</p>
          {event.changes.length > 0 ? (
            <ul className="space-y-2">
              {event.changes.slice(0, 4).map((change, index) => (
                <li key={index} className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                  <span className="w-24 shrink-0 text-black/60">{changeLabel(change.field)}</span>
                  <span className="font-mono tabular-nums text-black/60">{changeValue(change.field, change.old)}</span>
                  <span aria-hidden="true" className="text-black/45">→</span>
                  <strong className="font-mono tabular-nums text-black">{changeValue(change.field, change.new)}</strong>
                  <span className="ml-auto"><ChangeIndicator change={change} /></span>
                </li>
              ))}
              {event.changes.length > 4 && (
                <li className="text-xs font-medium text-black/60">+{event.changes.length - 4} more changes</li>
              )}
            </ul>
          ) : (
            <p className="text-sm text-black/70">{eventSummary(event)}</p>
          )}
        </div>

        <div className="hidden items-center justify-end text-accent lg:flex" aria-hidden="true">
          {target ? "→" : "—"}
        </div>
      </>
    );
    const ledgerClass =
      "group grid min-h-24 gap-4 px-4 py-4 transition-colors hover:bg-accent-soft/40 lg:grid-cols-12 lg:items-center";
    return target ? (
      <Link href={target} className={ledgerClass}>
        {ledgerBody}
      </Link>
    ) : (
      <div className={ledgerClass}>{ledgerBody}</div>
    );
  }

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
