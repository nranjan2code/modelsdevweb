import type { Metadata } from "next";
import Link from "next/link";
import { Inter, JetBrains_Mono, Caveat } from "next/font/google";
import { SITE_NAME, SITE_TAGLINE, SITE_URL } from "@/lib/site";
import { SiteNav } from "@/components/site-nav";
import { SiteFooter } from "@/components/site-footer";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const jetbrains = JetBrains_Mono({ subsets: ["latin"], variable: "--font-jetbrains" });
const caveat = Caveat({ subsets: ["latin"], variable: "--font-caveat" });

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
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

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${jetbrains.variable} ${caveat.variable}`}>
      <body className="min-h-screen flex flex-col font-sans">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "WebSite",
              name: SITE_NAME,
              url: SITE_URL,
              description: SITE_TAGLINE,
            }).replace(/</g, "\\u003c"),
          }}
        />
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:border-2 focus:border-black focus:bg-white focus:px-3 focus:py-1.5 focus:text-sm focus:shadow-[2px_2px_0_0_rgba(0,0,0,1)]"
        >
          Skip to content
        </a>
        <header className="sticky top-0 z-40 border-b border-black/10 bg-white/90 backdrop-blur">
          <div className="mx-auto flex min-h-16 max-w-6xl items-center gap-x-6 gap-y-1 px-4 py-2 sm:px-6">
            <Link href="/" className="group flex shrink-0 items-center gap-2.5">
              <span className="relative flex h-8 w-8 items-center justify-center rounded-lg border-2 border-black bg-white shadow-[2px_2px_0_0_rgba(0,0,0,1)] transition-transform group-hover:scale-105">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-60" />
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
                </span>
              </span>
              <span className="text-xl font-bold tracking-tight text-black">{SITE_NAME}</span>
            </Link>
            <SiteNav />
            <a
              href="/rss.xml"
              className="hidden shrink-0 rounded-md border-2 border-black bg-white px-2.5 py-1 font-mono text-xs font-bold uppercase tracking-wide shadow-[2px_2px_0_0_rgba(0,0,0,1)] transition-all hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[1px_1px_0_0_rgba(0,0,0,1)] sm:block"
            >
              RSS
            </a>
          </div>
        </header>
        <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-4 py-10 sm:px-6">
          {children}
        </main>
        <div className="mt-12">
          <SiteFooter />
        </div>
      </body>
    </html>
  );
}
