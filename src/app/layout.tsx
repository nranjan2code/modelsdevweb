import type { Metadata } from "next";
import Link from "next/link";
import { Inter, JetBrains_Mono, Caveat } from "next/font/google";
import { SITE_NAME, SITE_TAGLINE, SITE_URL } from "@/lib/site";
import { SiteNav } from "@/components/site-nav";
import { SiteFooter } from "@/components/site-footer";
import { BrandMark } from "@/components/brand-mark";
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
    "What the AI model market did today. Track first-party price moves separately from reseller markups, compare the same model across every provider, and rank value on independently measured benchmarks only. Built on open data from models.dev.",
  openGraph: {
    type: "website",
    images: [`${SITE_URL}/og/site.png`],
  },
  twitter: {
    card: "summary_large_image",
  },
  icons: {
    icon: "/icon.svg",
    shortcut: "/icon.svg",
    apple: "/icon.svg",
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
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:border-2 focus:border-black focus:bg-white focus:px-3 focus:py-1.5 focus:text-sm focus:shadow-hard-sm"
        >
          Skip to content
        </a>
        <header className="sticky top-0 z-40 border-b border-black/10 bg-white/90 backdrop-blur">
          <div className="mx-auto flex min-h-16 max-w-6xl items-center gap-x-6 gap-y-1 px-4 py-2 sm:px-6">
            <Link href="/" className="group flex shrink-0 items-center gap-2.5">
              <BrandMark boxClassName="h-8 w-8 transition-transform group-hover:scale-105" />
              <span className="text-xl font-bold tracking-tight text-black">{SITE_NAME}</span>
            </Link>
            <SiteNav />
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
