import type { Metadata } from "next";
import Link from "next/link";
import { SITE_NAME, SITE_TAGLINE } from "@/lib/site";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: `${SITE_NAME} — ${SITE_TAGLINE}`,
    template: `%s · ${SITE_NAME}`,
  },
  description:
    "Compare AI model prices across inference providers, track releases, price drops and deprecations. Built on open data from models.dev.",
};

const NAV = [
  { href: "/browse", label: "Browse" },
  { href: "/changelog", label: "Changelog" },
  { href: "/calculator", label: "Calculator" },
  { href: "/deprecations", label: "Deprecations" },
  { href: "/about", label: "About" },
];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen flex flex-col">
        <header className="sticky top-0 z-40 border-b border-zinc-800/80 bg-zinc-950/80 backdrop-blur">
          <div className="mx-auto flex h-14 max-w-6xl items-center gap-6 px-4">
            <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight text-zinc-50">
              <span className="inline-block size-2 rounded-full bg-emerald-400" />
              {SITE_NAME}
            </Link>
            <nav className="flex items-center gap-4 text-sm text-zinc-400 overflow-x-auto">
              {NAV.map((item) => (
                <Link key={item.href} href={item.href} className="whitespace-nowrap hover:text-zinc-100 transition-colors">
                  {item.label}
                </Link>
              ))}
            </nav>
            <a
              href="/rss.xml"
              className="ml-auto text-xs text-zinc-500 hover:text-emerald-400 transition-colors whitespace-nowrap"
            >
              RSS
            </a>
          </div>
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">{children}</main>
        <footer className="border-t border-zinc-800/80 py-6 mt-12">
          <div className="mx-auto max-w-6xl px-4 flex flex-wrap items-center justify-between gap-3 text-xs text-zinc-500">
            <p>
              Data from{" "}
              <a href="https://models.dev" className="hover:text-zinc-300 underline underline-offset-2">
                models.dev
              </a>{" "}
              · Snapshots diffed hourly · Machine-readable at{" "}
              <a href="/llms.txt" className="hover:text-zinc-300 underline underline-offset-2">
                /llms.txt
              </a>
            </p>
            <p>Prices are per 1M tokens in USD and may be unlisted (—) when providers do not publish them.</p>
          </div>
        </footer>
      </body>
    </html>
  );
}
