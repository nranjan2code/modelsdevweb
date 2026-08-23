"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

const PRIMARY = [
  { href: "/browse", label: "Models" },
  { href: "/compare", label: "Compare" },
  { href: "/changelog", label: "Changes" },
  { href: "/trends", label: "Market pulse" },
];

const GROUPS = [
  {
    label: "Make a decision",
    items: [
      { href: "/self-host", label: "Self-host or buy", desc: "API bill versus GPU rent" },
      { href: "/calculator", label: "Cost calculator", desc: "Price your workload" },
    ],
  },
  {
    label: "Research the market",
    items: [
      { href: "/benchmarks", label: "Benchmarks", desc: "Independent evidence and value" },
      { href: "/providers", label: "Providers", desc: "Every serving organisation" },
      { href: "/deprecations", label: "Retirement watch", desc: "Models leaving the market" },
    ],
  },
  {
    label: "Stay current",
    items: [
      { href: "/digest", label: "Weekly digest", desc: "The market, edited down" },
      { href: "/news", label: "Model news", desc: "Relevant stories, clustered" },
    ],
  },
  {
    label: "About",
    items: [{ href: "/about", label: "Data & methodology", desc: "Sources, APIs and trust rules" }],
  },
];

const SECONDARY = GROUPS.flatMap((group) => group.items);

export function SiteNav() {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const root = useRef<HTMLElement>(null);
  const active = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  useEffect(() => {
    function close(event: PointerEvent) {
      if (!root.current?.contains(event.target as Node)) {
        setMoreOpen(false);
        setMobileOpen(false);
      }
    }
    function escape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setMoreOpen(false);
        setMobileOpen(false);
      }
    }
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", escape);
    };
  }, []);

  const linkClass = (href: string) => `nav-link ${active(href) ? "nav-link-active" : ""}`;

  return (
    <nav ref={root} aria-label="Primary" className="relative ml-auto md:ml-auto">
      <button
        type="button"
        className="nav-menu-button md:hidden"
        aria-expanded={mobileOpen}
        aria-controls="mobile-navigation"
        onClick={() => setMobileOpen((value) => !value)}
      >
        {mobileOpen ? "Close" : "Menu"}
      </button>

      <div className="nav-primary hidden items-center md:flex">
        {PRIMARY.map((item) => (
          <Link key={item.href} href={item.href} className={linkClass(item.href)} onClick={() => setMoreOpen(false)}>
            {item.label}
          </Link>
        ))}
        <div className="relative">
          <button
            type="button"
            className={`nav-link ${SECONDARY.some((item) => active(item.href)) || moreOpen ? "nav-link-active" : ""}`}
            aria-expanded={moreOpen}
            aria-haspopup="true"
            onClick={() => setMoreOpen((value) => !value)}
          >
            More <span className="nav-chevron" aria-hidden="true">⌄</span>
          </button>
          {moreOpen && (
            <div className="nav-popover">
              {GROUPS.map((group) => (
                <section key={group.label} className="nav-popover-group" aria-label={group.label}>
                  <p className="mono-label px-2 pb-1">{group.label}</p>
                  {group.items.map((item) => (
                    <Link key={item.href} href={item.href} className="nav-popover-link" onClick={() => setMoreOpen(false)}>
                      <span className="font-medium text-black">{item.label}</span>
                      <span className="text-xs text-black/45">{item.desc}</span>
                    </Link>
                  ))}
                </section>
              ))}
            </div>
          )}
        </div>
      </div>

      {mobileOpen && (
        <div id="mobile-navigation" className="nav-mobile md:hidden">
          <p className="mono-label px-2 pb-1">Explore and track</p>
          <div className="grid grid-cols-2 gap-1">
            {PRIMARY.map((item) => (
              <Link key={item.href} href={item.href} className={linkClass(item.href)} onClick={() => setMobileOpen(false)}>
                {item.label}
              </Link>
            ))}
          </div>
          {GROUPS.map((group) => (
            <section key={group.label} className="nav-mobile-group" aria-label={group.label}>
              <p className="mono-label px-2 pb-1">{group.label}</p>
              <div className="grid grid-cols-2 gap-1">
                {group.items.map((item) => (
                  <Link key={item.href} href={item.href} className={linkClass(item.href)} onClick={() => setMobileOpen(false)}>
                    {item.label}
                  </Link>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </nav>
  );
}
