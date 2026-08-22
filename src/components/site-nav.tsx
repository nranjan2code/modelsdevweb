"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

const PRIMARY = [
  { href: "/browse", label: "Find a model" },
  { href: "/compare", label: "Compare" },
  { href: "/changelog", label: "Changes" },
  { href: "/trends", label: "Market" },
];

const MORE = [
  { href: "/benchmarks", label: "Benchmarks", desc: "Independent evidence and value" },
  { href: "/providers", label: "Providers", desc: "Every serving organisation" },
  { href: "/self-host", label: "Self-host or buy", desc: "API bill versus GPU rent" },
  { href: "/calculator", label: "Cost calculator", desc: "Price your workload" },
  { href: "/deprecations", label: "Retirement watch", desc: "Models leaving the market" },
  { href: "/news", label: "Model news", desc: "Relevant stories, clustered" },
  { href: "/about", label: "Data & methodology", desc: "Sources, APIs and trust rules" },
];

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
    <nav ref={root} aria-label="Primary" className="relative md:contents">
      <button
        type="button"
        className="nav-menu-button md:hidden"
        aria-expanded={mobileOpen}
        aria-controls="mobile-navigation"
        onClick={() => setMobileOpen((value) => !value)}
      >
        {mobileOpen ? "Close" : "Menu"}
      </button>

      <div className="hidden items-center gap-1 md:flex">
        {PRIMARY.map((item) => (
          <Link key={item.href} href={item.href} className={linkClass(item.href)} onClick={() => setMoreOpen(false)}>
            {item.label}
          </Link>
        ))}
        <div className="relative">
          <button
            type="button"
            className={`nav-link ${MORE.some((item) => active(item.href)) || moreOpen ? "nav-link-active" : ""}`}
            aria-expanded={moreOpen}
            aria-haspopup="true"
            onClick={() => setMoreOpen((value) => !value)}
          >
            More <span aria-hidden="true">⌄</span>
          </button>
          {moreOpen && (
            <div className="nav-popover">
              {MORE.map((item) => (
                <Link key={item.href} href={item.href} className="nav-popover-link" onClick={() => setMoreOpen(false)}>
                  <span className="font-medium text-black">{item.label}</span>
                  <span className="text-xs text-black/45">{item.desc}</span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      {mobileOpen && (
        <div id="mobile-navigation" className="nav-mobile md:hidden">
          {[...PRIMARY, ...MORE].map((item) => (
            <Link key={item.href} href={item.href} className={linkClass(item.href)} onClick={() => setMobileOpen(false)}>
              {item.label}
            </Link>
          ))}
        </div>
      )}
    </nav>
  );
}
