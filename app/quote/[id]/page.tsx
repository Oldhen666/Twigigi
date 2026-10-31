import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { InteractionLine } from "@/components/interaction-line";
import { Stage } from "@/components/stage";
import { getCurrentUser } from "@/lib/auth";
import { getInteractionBySource, getQuote } from "@/lib/db";

async function QuoteView({ params }: { params: Promise<{ id: string }> }) {
  await connection();
  const { id } = await params;
  const quote = getQuote(id);
  if (!quote) notFound();
  const account = await getCurrentUser();
  const interaction = getInteractionBySource(quote.id);
  return (
    <Stage>
      <div className="bg-card px-6 py-10 sm:rounded-[28px]">
        <p className="text-sm text-clay">Quote request sent</p>
        <h1 className="mt-2 font-serif text-4xl">{quote.productTitle}</h1>
        <p className="mt-4 text-sm leading-6 text-muted">
          The seller has your request for {quote.quantity}
          {quote.documents.length > 0 ? ` and ${quote.documents.length} ${quote.documents.length === 1 ? "file" : "files"}` : ""} and will reply at {quote.email}.
        </p>
        {interaction && account && (account.id === interaction.buyerId || account.email.toLowerCase() === interaction.buyerEmail) ? (
          <div className="mt-6"><InteractionLine item={interaction} nextPath={`/quote/${quote.id}`} side="buyer" /></div>
        ) : interaction && account && account.id === interaction.sellerId ? (
          <div className="mt-6"><InteractionLine item={interaction} nextPath={`/quote/${quote.id}`} side="seller" /></div>
        ) : interaction ? (
          <p className="mt-6 text-sm text-muted">
            Interaction {interaction.publicRef}. <Link href="/signup" className="text-forest">Create an account</Link> with this email to mark it completed and review.
          </p>
        ) : null}
        <Link href={`/${quote.publicId}/${quote.productSlug}`} className="mt-8 inline-flex h-12 items-center rounded-full bg-forest px-5 text-card">
          Back to the product
        </Link>
      </div>
    </Stage>
  );
}

export default function Page({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<p className="p-8 text-muted">Loading…</p>}>
      <QuoteView params={params} />
    </Suspense>
  );
}

export const metadata = { title: "Quote sent", robots: { index: false, follow: false } };
