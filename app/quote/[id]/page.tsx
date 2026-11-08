import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { Stage } from "@/components/stage";
import { buttonClass, ghostClass } from "@/components/ui";
import { getCurrentUser } from "@/lib/auth";
import { claimBuyerOrders, findUserById, getInteractionBySource, getProductById, getQuote } from "@/lib/db";
import { formatDate, formatMoney } from "@/lib/format";

function sentLine(files: number) {
  if (files === 1) return "Your request and 1 attachment have been sent to the seller.";
  if (files > 1) return `Your request and ${files} attachments have been sent to the seller.`;
  return "Your request has been sent to the seller.";
}

async function QuoteView({ params }: { params: Promise<{ id: string }> }) {
  await connection();
  const { id } = await params;
  const quote = getQuote(id);
  if (!quote) notFound();
  const account = await getCurrentUser();
  if (account && account.email.toLowerCase() === quote.email.toLowerCase()) claimBuyerOrders(account.id, account.email);
  const interaction = getInteractionBySource(quote.id);
  const product = getProductById(quote.productId);
  const seller = product ? findUserById(product.userId) : null;
  const replied = Boolean(quote.offerSentAt && quote.offerKind && product);
  const listing = `/${quote.publicId}/${quote.productSlug}`;
  const signup = `/signup?email=${encodeURIComponent(quote.email)}&next=${encodeURIComponent("/orders")}`;
  return (
    <Stage>
      <div className="bg-card px-5 py-6 sm:rounded-[28px] sm:px-6 sm:py-8">
        <p className="flex items-center gap-2 text-sm font-medium text-forest">
          <span className="grid size-5 shrink-0 place-items-center rounded-full bg-moss" aria-hidden>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M2.5 6.2 4.8 8.5 9.5 3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
          {replied ? "Quote from the seller" : "Quote request sent"}
        </p>
        <h1 className="mt-3 font-serif text-4xl leading-tight">{quote.productTitle}</h1>
        {replied && quote.offerSentAt && product ? (
          <section className="mt-5 rounded-2xl bg-paper-deep px-4 py-4">
            {seller ? <p className="text-sm text-muted">From {seller.displayName}</p> : null}
            <p className="mt-1 font-serif text-3xl">{formatMoney(quote.offerCents, product.currency || "CAD")}</p>
            <p className="mt-1 text-sm text-muted">
              {quote.offerKind === "fixed" ? "Fixed price" : "Estimated price"} · Valid for {quote.offerValidDays} days
              {quote.offerTimeline ? ` · ${quote.offerTimeline}` : ""} · Sent {formatDate(quote.offerSentAt)}
            </p>
            <p className="mt-3 text-sm">{quote.offerScope}</p>
            {quote.offerNote ? (
              <p className="mt-3 text-sm">
                <span className="block text-xs text-muted">Note</span>
                {quote.offerNote}
              </p>
            ) : null}
          </section>
        ) : (
          <p className="mt-3 text-sm leading-6 text-muted">{sentLine(quote.documents.length)}</p>
        )}

        <section className="mt-5 rounded-2xl bg-paper-deep px-4 py-4">
          <h2 className="font-serif text-xl">What happens next?</h2>
          <p className="mt-2 text-sm leading-6">The seller will review your request and contact you at:</p>
          <p className="mt-2 break-all font-medium">{quote.email}</p>
        </section>

        {interaction ? <p className="mt-4 text-sm text-muted">Request #{interaction.publicRef}</p> : null}

        {account ? (
          <Link href="/orders" className={`${buttonClass} mt-5 w-full`}>
            View my requests
          </Link>
        ) : (
          <section className="mt-6">
            <h2 className="font-serif text-xl">Keep track of your request</h2>
            <p className="mt-2 text-sm leading-6 text-muted">
              Create a free Twigigi account with this email to view and track your requests, and leave a review when the job is complete.
            </p>
            <Link href={signup} className={`${buttonClass} mt-4 w-full`}>
              Create free account
            </Link>
            <p className="mt-3 text-sm text-muted">
              Already have an account? <Link href={`/login?next=${encodeURIComponent("/orders")}`} className="text-forest">Log in</Link>
            </p>
          </section>
        )}

        <Link href={listing} className={`${ghostClass} mt-3 w-full`}>
          Back to listing
        </Link>
        <p className="mt-3 text-center text-sm text-muted">No account is required to receive a reply.</p>
      </div>
    </Stage>
  );
}

export default function Page({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<p className="px-5 py-8 text-muted">Loading…</p>}>
      <QuoteView params={params} />
    </Suspense>
  );
}

export const metadata = { title: "Quote sent", robots: { index: false, follow: false } };
