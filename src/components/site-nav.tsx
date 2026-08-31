"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

const PRIMARY_GROUPS = [
  { label: "Explore", items: [{ href: "/browse", label: "Models" }, { href: "/compare", label: "Compare" }] },
  { label: "Decide", items: [{ href: "/calculator", label: "Calculator" }] },
  { label: "Market", items: [{ href: "/exchange", label: "Exchange" }, { href: "/changelog", label: "Changes" }] },
  { label: "Evidence", items: [{ href: "/benchmarks", label: "Benchmarks" }, { href: "/providers", label: "Providers" }, { href: "/field-notes", label: "Field notes" }] },
  { label: "Follow", items: [{ href: "/news", label: "News" }] },
] as const;

const MORE_GROUPS = [
  { label: "Explore", items: [{ href: "/ecosystem", label: "Ecosystem" }] },
  { label: "Decide", items: [{ href: "/self-host", label: "Self-host" }] },
  { label: "Market", items: [{ href: "/exchange#equity-context", label: "Public markets" }, { href: "/trends", label: "Market pulse" }, { href: "/deprecations", label: "Deprecations" }] },
  { label: "Evidence", items: [{ href: "/about", label: "Methodology" }, { href: "/status", label: "Status" }] },
  { label: "Follow", items: [{ href: "/digest", label: "Digest" }] },
] as const;

export function SiteNav() {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRoot = useRef<HTMLDivElement>(null);
  const active = (href: string) => {
    const path = href.split("#", 1)[0];
    return pathname === path || pathname.startsWith(`${path}/`);
  };

  const moreActive = MORE_GROUPS.some((group) => group.items.some((item) => active(item.href)));

  useEffect(() => {
    if (!moreOpen) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!moreRoot.current?.contains(event.target as Node)) setMoreOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMoreOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [moreOpen]);

  const renderGroups = (groups: readonly { label: string; items: readonly { href: string; label: string }[] }[]) => groups.map((group) => (
    <section key={group.label} className="nav-cluster" aria-label={group.label}>
      <span className="nav-group-label">{group.label}</span>
      <div className="nav-cluster-links">
        {group.items.map((item) => (
          <Link key={item.href} href={item.href} aria-current={!item.href.includes("#") && active(item.href) ? "page" : undefined} className={`nav-link ${!item.href.includes("#") && active(item.href) ? "nav-link-active" : ""}`}>
            {item.label}
          </Link>
        ))}
      </div>
    </section>
  ));

  return (
    <div ref={moreRoot} className="site-navigation-shell">
      <nav aria-label="Primary" className="site-navigation">
        <div className="nav-groups">
          {renderGroups(PRIMARY_GROUPS)}
          <div className="nav-more">
            <button type="button" className={`nav-more-trigger ${moreActive || moreOpen ? "nav-link-active" : ""}`} aria-expanded={moreOpen} aria-controls="nav-more-menu" onClick={() => setMoreOpen((open) => !open)}>
              More <span aria-hidden="true">⌄</span>
            </button>
          </div>
        </div>
      </nav>
      {moreOpen ? <div id="nav-more-menu" className="nav-more-menu">{renderGroups(MORE_GROUPS)}</div> : null}
    </div>
  );
}
