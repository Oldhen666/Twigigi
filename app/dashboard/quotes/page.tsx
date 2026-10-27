import Link from "next/link";
import { Suspense } from "react";
import { requireSeller } from "@/lib/auth";
import { listQuotes } from "@/lib/db";
import { formatDate } from "@/lib/format";

async function QuotesScreen() {
  const user = await requireSeller();
  const quotes = listQuotes(user.id);
  return (
    <main className="mx-auto w-full max-w-5xl px-5 pb-16">
      <h1 className="font-serif text-4xl">Quotes</h1>
      <p className="mt-2 text-sm text-muted">Quote requests on your Twigs.</p>
      {quotes.length === 0 ? (
        <p className="mt-8 text-sm text-muted">Quote requests will show up here.</p>
      ) : (
        <ul className="mt-8 space-y-3">
          {quotes.map((quote) => (
            <li key={quote.id}>
              <Link href={`/dashboard/quotes/${quote.id}`} className="block rounded-2xl border border-line bg-card p-4 text-sm">
                <p className="font-medium">{quote.name}</p>
                <p className="text-muted">{quote.productTitle} · qty {quote.quantity}</p>
                <p className="mt-1 text-muted">{quote.status} · {formatDate(quote.createdAt)}</p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<p className="px-5 text-muted">Loading quotes…</p>}>
      <QuotesScreen />
    </Suspense>
  );
}

export const metadata = { title: "Quotes", robots: { index: false, follow: false } };
