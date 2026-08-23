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
  muted: "border-black/15 bg-black/5 text-black/60",
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
      className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-semibold leading-none ${
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
    "inline-flex min-h-11 shrink-0 items-center border-b border-black/20 px-1 py-2 text-xs font-semibold text-black/60 transition-colors hover:border-accent hover:text-accent";
  return (
    <div className="mb-5">
      <div className="flex items-end justify-between gap-4 border-b border-black/15 pb-3">
        <div>
          <h2 className="font-hand text-2xl font-bold tracking-[-0.025em] text-black sm:text-3xl">{title}</h2>
          {eyebrow && (
            <p className={`mono-label mt-1 ${eyebrowTone ? EYEBROW_TONES[eyebrowTone] : ""}`}>{eyebrow}</p>
          )}
        </div>
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

const BAR_TONES = {
  accent: "bg-accent",
  accentMuted: "bg-accent/45",
  special: "bg-special",
  neutral: "bg-ink/55",
  pos: "bg-pos",
} as const;

export function Bar({
  pct,
  tone = "accent",
  label,
}: {
  pct: number;
  tone?: keyof typeof BAR_TONES;
  label?: string;
}) {
  const value = Math.max(0, Math.min(1, pct));
  return (
    <div
      className="h-2 min-w-6 flex-1 overflow-hidden rounded-sm bg-surface-tint"
      role={label ? "meter" : undefined}
      aria-label={label}
      aria-valuemin={label ? 0 : undefined}
      aria-valuemax={label ? 100 : undefined}
      aria-valuenow={label ? Math.round(value * 100) : undefined}
    >
      <div
        className={`h-full rounded-sm ${BAR_TONES[tone]}`}
        style={{ width: `${value === 0 ? 0 : Math.max(2, value * 100)}%` }}
      />
    </div>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <div className="card-dashed p-6 text-sm text-black/60">{children}</div>;
}
