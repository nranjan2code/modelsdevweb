"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

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
  const active = (href: string) => {
    const path = href.split("#", 1)[0];
    return pathname === path || pathname.startsWith(`${path}/`);
  };

  const moreActive = MORE_GROUPS.some((group) => group.items.some((item) => active(item.href)));

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
    <nav aria-label="Primary" className="site-navigation">
      <div className="nav-groups">
        {renderGroups(PRIMARY_GROUPS)}
        <details className="nav-more">
          <summary className={`nav-more-trigger ${moreActive ? "nav-link-active" : ""}`}>
            More <span aria-hidden="true">⌄</span>
          </summary>
          <div className="nav-more-menu">
            {renderGroups(MORE_GROUPS)}
          </div>
        </details>
      </div>
    </nav>
  );
}
