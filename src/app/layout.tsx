import type { Metadata } from "next";
import Link from "next/link";
import { Inter, JetBrains_Mono } from "next/font/google";
import { SITE_NAME, SITE_TAGLINE, SITE_URL } from "@/lib/site";
import { SiteNav } from "@/components/site-nav";
import { ModelSearch } from "@/components/model-search";
import { SiteFooter } from "@/components/site-footer";
import { BrandMark } from "@/components/brand-mark";
import { getCatalog } from "@/lib/data";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const jetbrains = JetBrains_Mono({ subsets: ["latin"], variable: "--font-jetbrains" });

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

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const catalog = await getCatalog();
  const searchModels = catalog.tracked.map((group) => ({
    id: group.id,
    name: group.name,
    lab: group.labId,
  }));
  return (
    <html lang="en" className={`${inter.variable} ${jetbrains.variable}`}>
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
        <header className="site-header">
          <div className="mx-auto flex max-w-7xl items-center gap-2 px-4 py-3 sm:px-6 md:gap-3">
            <Link href="/" className="group flex shrink-0 items-center gap-2.5">
              <BrandMark boxClassName="h-9 w-9 transition-transform group-hover:scale-105" />
              <span>
                <span className="block text-base font-bold leading-none tracking-tight text-black">{SITE_NAME}</span>
                <span className="micro-label mt-1 hidden sm:block">AI model market</span>
              </span>
            </Link>
            <SiteNav />
            <div className="shrink-0">
              <ModelSearch models={searchModels} />
            </div>
          </div>
        </header>
        <main id="main" className="mx-auto w-full max-w-7xl flex-1 px-4 py-10 sm:px-6 lg:py-14">
          {children}
        </main>
        <div className="mt-12">
          <SiteFooter />
        </div>
      </body>
    </html>
  );
}
