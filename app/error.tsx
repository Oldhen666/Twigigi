"use client";

export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="mx-auto max-w-md px-6 py-20">
      <h1 className="font-serif text-4xl">Something went wrong</h1>
      <p className="mt-3 text-muted">Try that again. If it keeps happening, come back to the dashboard.</p>
      <button type="button" onClick={reset} className="mt-6 inline-flex h-12 items-center rounded-full bg-forest px-5 text-card">
        Try again
      </button>
    </main>
  );
}
