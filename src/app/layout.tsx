import type { Metadata } from "next";
import Link from "next/link";
import { Inter, JetBrains_Mono, Caveat } from "next/font/google";
import { SITE_NAME, SITE_TAGLINE, SITE_URL } from "@/lib/site";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const jetbrains = JetBrains_Mono({ subsets: ["latin"], variable: "--font-jetbrains" });
const caveat = Caveat({ subsets: ["latin"], variable: "--font-caveat" });

export const metadata: Metadata = {
  title: {
    default: `${SITE_NAME} — ${SITE_TAGLINE}`,
    template: `%s · ${SITE_NAME}`,
  },
  description:
    "Compare AI model prices across inference providers, track releases, price drops and deprecations. Built on open data from models.dev.",
  openGraph: {
    type: "website",
    images: [`${SITE_URL}/og/site.png`],
  },
  twitter: {
    card: "summary_large_image",
  },
};

const NAV = [
  { href: "/browse", label: "Browse" },
  { href: "/providers", label: "Providers" },
  { href: "/benchmarks", label: "Benchmarks" },
  { href: "/calculator", label: "Calculator" },
  { href: "/changelog", label: "Changelog" },
  { href: "/news", label: "News" },
  { href: "/deprecations", label: "Deprecations" },
  { href: "/search", label: "Search" },
  { href: "/about", label: "About" },
];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${jetbrains.variable} ${caveat.variable}`}>
      <body className="min-h-screen flex flex-col font-sans">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:border-2 focus:border-black focus:bg-white focus:px-3 focus:py-1.5 focus:text-sm focus:shadow-[2px_2px_0_0_rgba(0,0,0,1)]"
        >
          Skip to content
        </a>
        <header className="sticky top-0 z-40 border-b border-black/10 bg-white/90 backdrop-blur">
          <div className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-4 sm:px-6">
            <Link href="/" className="group flex shrink-0 items-center gap-2.5">
              <span className="relative flex h-8 w-8 items-center justify-center rounded-lg border-2 border-black bg-white shadow-[2px_2px_0_0_rgba(0,0,0,1)] transition-transform group-hover:scale-105">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-60" />
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
                </span>
              </span>
              <span className="text-xl font-bold tracking-tight text-black">{SITE_NAME}</span>
            </Link>
            <nav
              aria-label="Primary"
              className="no-scrollbar flex items-center gap-5 overflow-x-auto text-sm font-medium text-black/55 lg:gap-6"
            >
              {NAV.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="whitespace-nowrap transition-colors hover:text-black"
                >
                  {item.label}
                </Link>
              ))}
            </nav>
            <a
              href="/rss.xml"
              className="ml-auto hidden shrink-0 rounded-md border-2 border-black bg-white px-2.5 py-1 font-mono text-xs font-bold uppercase tracking-wide shadow-[2px_2px_0_0_rgba(0,0,0,1)] transition-all hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[1px_1px_0_0_rgba(0,0,0,1)] sm:block"
            >
              RSS
            </a>
          </div>
        </header>
        <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-4 py-10 sm:px-6">
          {children}
        </main>
        <footer className="mt-12 border-t border-black/10 py-8">
          <div className="mx-auto flex max-w-6xl flex-wrap items-start justify-between gap-4 px-4 sm:px-6">
            <p className="max-w-xl text-xs leading-relaxed text-black/50">
              <span className="mono-label block">Data</span>
              From{" "}
              <a
                href="https://models.dev"
                className="font-medium underline decoration-wavy decoration-from-font underline-offset-4 hover:text-black"
              >
                models.dev
              </a>{" "}
              · Snapshots diffed hourly · Machine-readable at{" "}
              <a
                href="/llms.txt"
                className="font-medium underline decoration-wavy decoration-from-font underline-offset-4 hover:text-black"
              >
                /llms.txt
              </a>
            </p>
            <p className="max-w-sm text-xs leading-relaxed text-black/50">
              <span className="mono-label block">Disclaimer</span>
              Prices are per 1M tokens in USD and may be unlisted (—) when providers do not publish them.
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
