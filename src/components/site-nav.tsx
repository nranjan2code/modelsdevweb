"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

interface NavChild {
  href: string;
  label: string;
  desc: string;
}

interface NavGroup {
  label: string;
  children: NavChild[];
}

const GROUPS: NavGroup[] = [
  {
    label: "Models",
    children: [
      { href: "/browse", label: "Browse catalog", desc: "Every model, filterable" },
      { href: "/compare", label: "Compare models", desc: "Side-by-side diff, up to 4" },
      { href: "/calculator", label: "Cost calculator", desc: "Monthly spend by token mix" },
    ],
  },
  {
    label: "Market",
    children: [
      { href: "/benchmarks", label: "Benchmarks", desc: "Leaderboards with pts per dollar" },
      { href: "/trends", label: "Trends", desc: "Aggregates, distributions, scatter" },
      { href: "/providers", label: "Providers", desc: "Prices per inference provider" },
    ],
  },
  {
    label: "Track",
    children: [
      { href: "/changelog", label: "Changelog", desc: "Hourly diffs of everything" },
      { href: "/digest", label: "Weekly digest", desc: "This week in AI pricing" },
      { href: "/news", label: "Model news", desc: "Daily headlines" },
      { href: "/deprecations", label: "Deprecations", desc: "Sunset watch" },
    ],
  },
];

const DIRECT = [{ href: "/about", label: "About" }];

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 12 12"
      className={`ml-1 inline-block size-3 shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
    >
      <path d="M2.5 4.5 6 8l3.5-3.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function SiteNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState<string | null>(null);
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDown(e: PointerEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(null);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(null);
    }
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  const triggerCls = (active: boolean, isOpen: boolean) =>
    `flex items-center whitespace-nowrap rounded-md px-1.5 py-1 transition-colors ${
      active || isOpen ? "font-semibold text-black" : "hover:text-black"
    }`;

  return (
    <nav ref={ref} aria-label="Primary" className="ml-auto flex flex-wrap items-center justify-end gap-x-3.5 gap-y-1 text-sm font-medium text-black/55 lg:gap-x-5">
      {GROUPS.map((g) => {
        const active = g.children.some((c) => isActive(c.href));
        const isOpen = open === g.label;
        return (
          <div key={g.label} className="relative">
            <button
              type="button"
              aria-expanded={isOpen}
              aria-haspopup="true"
              onClick={() => setOpen(isOpen ? null : g.label)}
              className={triggerCls(active, isOpen)}
            >
              {g.label}
              <Chevron open={isOpen} />
            </button>
            {isOpen && (
              <div className="card-flat absolute left-0 top-full z-50 mt-2 w-64 p-1.5 shadow-[4px_4px_0_0_rgba(0,0,0,1)]">
                {g.children.map((c) => (
                  <Link
                    key={c.href}
                    href={c.href}
                    onClick={() => setOpen(null)}
                    aria-current={isActive(c.href) ? "page" : undefined}
                    className={`block rounded-md px-3 py-2 transition-colors hover:bg-blue-50 ${
                      isActive(c.href) ? "bg-blue-50" : ""
                    }`}
                  >
                    <span className="block font-medium text-black">{c.label}</span>
                    <span className="block text-xs text-black/45">{c.desc}</span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        );
      })}
      {DIRECT.map((d) => (
        <Link
          key={d.href}
          href={d.href}
          aria-current={isActive(d.href) ? "page" : undefined}
          className={triggerCls(isActive(d.href), false)}
        >
          {d.label}
        </Link>
      ))}
    </nav>
  );
}
