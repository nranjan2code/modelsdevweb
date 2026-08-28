import Link from "next/link";

export default function NotFound() {
  return (
    <main id="main" className="mx-auto flex w-full max-w-3xl flex-1 items-center px-4 py-16 sm:px-6 sm:py-24">
      <section className="card-flat w-full space-y-6 p-6 sm:p-10" aria-labelledby="not-found-title">
        <p className="mono-label">404 · not in the catalog</p>
        <div className="max-w-xl space-y-3">
          <h1 id="not-found-title" className="font-hand text-4xl font-bold tracking-tight text-black sm:text-5xl">
            That page has moved or never existed.
          </h1>
          <p className="text-base leading-7 text-black/60">
            Try a model search, browse the current catalog, or return to today&apos;s market front page.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link href="/browse" className="button-primary">
            Browse models →
          </Link>
          <Link href="/" className="button-secondary">
            Back to homepage
          </Link>
        </div>
      </section>
    </main>
  );
}
