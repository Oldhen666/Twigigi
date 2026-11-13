import Link from "next/link";
import { Suspense } from "react";
import { SellerQuotes } from "@/components/seller-quotes";
import { requireSeller } from "@/lib/auth";
import { getProductById, listQuotes } from "@/lib/db";
import { formatDate, formatMoney } from "@/lib/format";

async function QuotesScreen() {
  const user = await requireSeller();
  const quotes = listQuotes(user.id, 1000);
  const currency = new Map<string, string>();
  return (
    <main className="page-frame pb-16">
      <h1 className="mt-6 font-serif text-4xl">Quotes</h1>
      {quotes.length === 0 ? (
        <div className="mt-6 max-w-xl rounded-3xl border border-dashed border-line bg-card p-6">
          <h2 className="font-serif text-2xl">No quotes yet</h2>
          <p className="mt-2 text-sm leading-6 text-muted">Create a quote Twig, then share it. Requests will be listed here.</p>
          <Link href="/dashboard/products/new?cta=quote" className="mt-4 inline-flex h-11 items-center rounded-full bg-forest px-5 text-sm text-card focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest">Create a quote Twig</Link>
        </div>
      ) : (
        <SellerQuotes
          quotes={quotes.map((quote) => {
            let code = currency.get(quote.productId);
            if (!code) {
              code = getProductById(quote.productId)?.currency || "CAD";
              currency.set(quote.productId, code);
            }
            return {
              id: quote.id,
              productId: quote.productId,
              productTitle: quote.productTitle,
              name: quote.name,
              email: quote.email,
              phone: quote.phone,
              message: quote.message,
              quantity: quote.quantity,
              projectDetails: quote.projectDetails,
              status: quote.status,
              createdAt: quote.createdAt,
              submitted: formatDate(quote.createdAt),
              billable: quote.billable,
              feeReason: quote.feeReason,
              offer: quote.offerCents > 0 ? `${quote.offerKind || "quote"} ${formatMoney(quote.offerCents, code)}` : "",
            };
          })}
        />
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
