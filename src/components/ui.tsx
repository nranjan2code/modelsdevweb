import Link from "next/link";
import type { ReactNode } from "react";

/*
 * Shared UI primitives — docs/brand.md §6.
 * If a page needs a chip, delta, section head, meter or empty state,
 * it uses one of these. No bespoke equivalents.
 */

export type Tone = "neutral" | "muted" | "accent" | "pos" | "neg" | "warn" | "special";

const BADGE_TONES: Record<Tone, string> = {
  neutral: "border-black/15 bg-white text-black/70",
  muted: "border-black/15 bg-black/5 text-black/45",
  accent: "border-accent/30 bg-accent-soft text-accent-strong",
  pos: "border-pos/30 bg-pos-soft text-pos",
  neg: "border-neg/30 bg-neg-soft text-neg",
  warn: "border-warn/30 bg-warn-soft text-warn",
  special: "border-special/30 bg-special-soft text-special",
};

export function Badge({
  children,
  tone = "neutral",
  mono = false,
  bold = false,
  className = "",
}: {
  children: ReactNode;
  tone?: Tone;
  mono?: boolean;
  bold?: boolean;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold leading-snug ${
        mono ? "font-mono tabular-nums" : ""
      } ${bold ? "font-bold" : ""} ${BADGE_TONES[tone]} ${className}`}
    >
      {children}
    </span>
  );
}

/** ▼/▲ percentage delta — down is always good here (prices), so down = pos. */
export function DeltaChip({ down, pct, digits = 1 }: { down: boolean; pct: number; digits?: number }) {
  return (
    <Badge tone={down ? "pos" : "neg"} mono bold>
      {down ? "▼" : "▲"} {Math.abs(pct * 100).toFixed(digits)}%
    </Badge>
  );
}

const EYEBROW_TONES: Record<"accent" | "pos" | "neg" | "warn" | "special", string> = {
  accent: "text-accent",
  pos: "text-pos",
  neg: "text-neg",
  warn: "text-warn",
  special: "text-special",
};

export function SectionHead({
  title,
  href,
  label = "View all",
  external,
  eyebrow,
  eyebrowTone,
}: {
  title: string;
  href?: string;
  label?: string;
  external?: boolean;
  eyebrow?: string;
  eyebrowTone?: keyof typeof EYEBROW_TONES;
}) {
  const linkCls =
    "shrink-0 rounded-full border border-black/15 bg-white px-3 py-1 text-xs font-medium text-black/60 transition-colors hover:border-black hover:text-black";
  return (
    <div className="mb-5">
      {eyebrow && (
        <p className={`mono-label mb-1 ${eyebrowTone ? EYEBROW_TONES[eyebrowTone] : ""}`}>{eyebrow}</p>
      )}
      <div className="flex items-center justify-between gap-4">
        <h2 className="font-hand text-3xl font-bold tracking-tight text-black sm:text-4xl">{title}</h2>
        {href &&
          (external ? (
            <a href={href} target="_blank" rel="noreferrer" className={linkCls}>
              {label} →
            </a>
          ) : (
            <Link href={href} className={linkCls}>
              {label} →
            </Link>
          ))}
      </div>
    </div>
  );
}

export function Bar({ pct, fill = "bg-accent" }: { pct: number; fill?: string }) {
  return (
    <div className="h-2 min-w-6 flex-1 overflow-hidden rounded-sm border border-black bg-white">
      <div
        className={`h-full ${fill}`}
        style={{ width: `${Math.max(2, Math.min(100, pct * 100))}%` }}
      />
    </div>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <div className="card-dashed p-6 text-sm text-black/45">{children}</div>;
}
