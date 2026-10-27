import { notFound } from "next/navigation";
import { Suspense } from "react";
import { confirmInteraction, setLeadStatus } from "@/lib/actions";
import { requireSeller } from "@/lib/auth";
import { getInteractionBySource, getProductById, getQuote } from "@/lib/db";
import { formatDate, interactionLabel, srcLabel } from "@/lib/format";

async function QuoteScreen({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireSeller();
  const { id } = await params;
  const quote = getQuote(id);
  const product = quote ? getProductById(quote.productId) : null;
  if (!quote || !product || product.userId !== user.id) notFound();
  const interaction = getInteractionBySource(quote.id);
  return (
    <main className="mx-auto w-full max-w-3xl px-5 pb-16">
      <p className="text-sm text-muted">{quote.productTitle}</p>
      <h1 className="mt-1 font-serif text-4xl">{quote.name}</h1>
      <p className="mt-2 text-sm text-muted">qty {quote.quantity} · {quote.status}</p>
      {quote.projectDetails ? <p className="mt-4 text-sm">{quote.projectDetails}</p> : null}
      {quote.message ? <p className="mt-2 text-sm text-muted">{quote.message}</p> : null}
      {quote.documents.length > 0 ? (
        <ul className="mt-3 space-y-1 text-sm">
          {quote.documents.map((file) => (
            <li key={file.path}>
              <a href={file.path} target="_blank" rel="noreferrer" className="text-forest">{file.name}</a>
            </li>
          ))}
        </ul>
      ) : null}
      <p className="mt-4 text-sm text-muted">{quote.email}{quote.phone ? ` · ${quote.phone}` : ""}</p>
      <p className="text-sm text-muted">{srcLabel(quote.src)} · {formatDate(quote.createdAt)}</p>
      <form action={setLeadStatus} className="mt-4 flex items-center gap-2">
        <input type="hidden" name="kind" value="quote" />
        <input type="hidden" name="id" value={quote.id} />
        <select name="status" defaultValue={quote.status} className="h-9 rounded-lg border border-line bg-white px-2 text-sm">
          {["new", "contacted", "closed"].map((option) => (
            <option key={option} value={option}>{option}</option>
          ))}
        </select>
        <button className="text-sm text-forest">Save</button>
      </form>
      {interaction ? (
        <section className="mt-8 rounded-2xl border border-line bg-card p-4 text-sm">
          <p className="font-medium">{interaction.publicRef}</p>
          <p className="text-muted">{interactionLabel(interaction)}</p>
          {interaction.sellerConfirmedAt ? null : (
            <form action={confirmInteraction} className="mt-2">
              <input type="hidden" name="id" value={interaction.id} />
              <input type="hidden" name="side" value="seller" />
              <input type="hidden" name="next" value={`/dashboard/quotes/${quote.id}`} />
              <button className="text-forest">Mark completed</button>
            </form>
          )}
        </section>
      ) : null}
    </main>
  );
}

export default function Page({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<p className="px-5 text-muted">Loading quote…</p>}>
      <QuoteScreen params={params} />
    </Suspense>
  );
}

export const metadata = { title: "Quote", robots: { index: false, follow: false } };
