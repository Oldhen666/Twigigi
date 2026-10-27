import Link from "next/link";
import { Suspense } from "react";
import { requireSeller } from "@/lib/auth";
import { listQuotes } from "@/lib/db";
import { formatDate } from "@/lib/format";

async function QuotesScreen() {
  const user = await requireSeller();
  const quotes = listQuotes(user.id);
  return (
    <main className="page-frame pb-16">
      <h1 className="font-serif text-4xl">Quotes</h1>
      <p className="mt-2 text-sm text-muted">Each quote submission is $0.25, in CAD or USD for that Twig.</p>
      {quotes.length === 0 ? (
        <div className="mt-8">
          <p className="text-sm text-muted">No quote record</p>
          <Link href="/start" className="mt-6 inline-flex h-12 items-center rounded-full bg-forest px-5 text-card">
            Create Twig +
          </Link>
        </div>
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
