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
      <h1 className="mt-6 font-serif text-4xl">Quotes</h1>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">Customer quote requests show up here. The C$0.25 or USD$0.25 is a Twigigi fee you pay, not a charge to the buyer.</p>
      <details className="mt-3 max-w-2xl text-sm text-muted">
        <summary className="cursor-pointer font-medium text-ink">Fee details</summary>
        <p className="mt-2 leading-6">A valid new request is added to your next listing payment in the same currency. Twigigi does not charge it on its own. A repeat of the same request is not billed again, and a waived Twig is not charged.</p>
      </details>
      {quotes.length === 0 ? (
        <div className="mt-6 max-w-xl rounded-3xl border border-dashed border-line bg-card p-6">
          <h2 className="font-serif text-2xl">No quotes yet</h2>
          <p className="mt-2 text-sm leading-6 text-muted">Create a quote Twig, then share it. Requests will be listed here.</p>
          <Link href="/dashboard/products/new?cta=quote" className="mt-4 inline-flex h-11 items-center rounded-full bg-forest px-5 text-sm text-card focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest">Create a quote Twig</Link>
        </div>
      ) : (
        <ul className="mt-8 space-y-3">
          {quotes.map((quote) => (
            <li key={quote.id}>
              <Link href={`/dashboard/quotes/${quote.id}`} className="block rounded-2xl border border-line bg-card p-4 text-sm">
                <p className="font-medium">{quote.name}</p>
                <p className="text-muted">{quote.productTitle} · qty {quote.quantity}</p>
                <p className="mt-1 text-muted">{quote.status} · {formatDate(quote.createdAt)} · {quote.billable ? "On the next bill" : quote.feeReason === "waived" ? "Quote fee waived" : "Not billed again"}</p>
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
