"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

const NAV_GROUPS = [
  { label: "Explore", items: [{ href: "/browse", label: "Models" }, { href: "/compare", label: "Compare" }] },
  { label: "Decide", items: [{ href: "/calculator", label: "Calculator" }, { href: "/self-host", label: "Self-host" }] },
  { label: "Market", items: [{ href: "/exchange", label: "Exchange" }, { href: "/trends", label: "Market pulse" }, { href: "/changelog", label: "Changes" }, { href: "/deprecations", label: "Deprecations" }] },
  { label: "Evidence", items: [{ href: "/benchmarks", label: "Benchmarks" }, { href: "/providers", label: "Providers" }, { href: "/about", label: "Methodology" }] },
  { label: "Follow", items: [{ href: "/digest", label: "Digest" }, { href: "/news", label: "News" }] },
] as const;

export function SiteNav() {
  const pathname = usePathname();
  const root = useRef<HTMLElement>(null);
  const active = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  useEffect(() => {
    const navigation = root.current;
    const current = navigation?.querySelector<HTMLElement>("[aria-current='page']");
    if (!navigation || !current || navigation.scrollWidth <= navigation.clientWidth) return;
    navigation.scrollTo({
      left: Math.max(0, current.offsetLeft - navigation.clientWidth / 2 + current.clientWidth / 2),
      behavior: "auto",
    });
  }, [pathname]);

  return (
    <nav ref={root} aria-label="Primary" className="site-navigation">
      <div className="nav-groups">
        {NAV_GROUPS.map((group) => (
          <section key={group.label} className="nav-cluster" aria-label={group.label}>
            <span className="nav-group-label">{group.label}</span>
            <div className="nav-cluster-links">
              {group.items.map((item) => (
                <Link key={item.href} href={item.href} aria-current={active(item.href) ? "page" : undefined} className={`nav-link ${active(item.href) ? "nav-link-active" : ""}`}>
                  {item.label}
                </Link>
              ))}
            </div>
          </section>
        ))}
      </div>
    </nav>
  );
}
