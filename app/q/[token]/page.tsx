import { notFound } from "next/navigation";
import { respondToFollowup } from "@/lib/actions";
import { getQuote, quoteFollowupByToken, quoteFollowups } from "@/lib/db";
import { formatMoney } from "@/lib/format";
import { buttonClass, ghostClass } from "@/components/ui";

export const metadata = { title: "Follow-up", robots: { index: false, follow: false } };

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { token } = await params;
  const query = await searchParams;
  const followup = quoteFollowupByToken(token);
  if (!followup || followup.status === "draft") notFound();
  const quote = getQuote(followup.quoteId);
  if (!quote) notFound();
  const notice = typeof query.notice === "string" ? query.notice : "";
  const offers = quoteFollowups(quote.id).filter((item) => item.kind === "offer" && item.status === "sent");
  const current = offers[offers.length - 1];
  const canAnswer = followup.status === "sent" && (followup.kind !== "offer" || current?.id === followup.id);
  const cents = Number(followup.payload.cents || 0);
  const currency = String(followup.payload.currency || "CAD");

  return (
    <main className="mx-auto w-full max-w-xl px-5 py-10">
      <p className="text-sm text-muted">{quote.productTitle}</p>
      <h1 className="mt-2 font-serif text-4xl">
        {followup.kind === "visit" ? "Site visit" : followup.kind === "offer" ? "Quote" : "Invoice"}
      </h1>
      {notice === "confirmed" ? <p className="mt-4 text-sm">You confirmed this time.</p> : null}
      {notice === "reschedule" ? <p className="mt-4 text-sm">You asked for a different time. The seller can see that.</p> : null}
      {notice === "accepted" ? <p className="mt-4 text-sm">You accepted this quote.</p> : null}
      {notice === "changes" ? <p className="mt-4 text-sm">You asked for changes. The seller can see that.</p> : null}
      {notice === "expired" ? <p className="mt-4 text-sm">This quote is no longer open to accept.</p> : null}
      {notice === "closed" ? <p className="mt-4 text-sm">This follow-up can no longer be changed from this link.</p> : null}
      {followup.kind === "visit" ? (
        <section className="mt-6 space-y-2 text-sm leading-6">
          <p>Date: {String(followup.payload.date || "")}</p>
          <p>Time: {String(followup.payload.time || "")}</p>
          <p>Time zone: {String(followup.payload.timezone || "")}</p>
          {followup.payload.note ? <p>{String(followup.payload.note)}</p> : null}
          <p>Status: {followup.status}</p>
        </section>
      ) : null}
      {followup.kind === "offer" ? (
        <section className="mt-6 space-y-2 text-sm leading-6">
          <p className="font-serif text-3xl">{formatMoney(cents, currency)}</p>
          <p>Valid for {String(followup.payload.validDays || "")} days.</p>
          <p>{String(followup.payload.scope || "")}</p>
          {followup.payload.note ? <p>{String(followup.payload.note)}</p> : null}
          <p>Status: {followup.status === "accepted" ? "Quote accepted" : followup.status === "sent" ? "Quote sent" : followup.status}</p>
        </section>
      ) : null}
      {followup.kind === "invoice" ? (
        <section className="mt-6 space-y-2 text-sm leading-6">
          <p className="font-serif text-3xl">{formatMoney(cents, currency)}</p>
          <p>Due {String(followup.payload.dueOn || "")}</p>
          <p>{String(followup.payload.note || "")}</p>
          <p>Status: {followup.status === "paid" ? "Paid" : followup.status === "sent" ? "Invoice sent" : followup.status}</p>
        </section>
      ) : null}
      {canAnswer && followup.kind === "visit" ? (
        <form action={respondToFollowup} className="mt-6 flex gap-2">
          <input type="hidden" name="token" value={token} />
          <button name="choice" value="confirmed" className={`${buttonClass} flex-1`}>Confirm</button>
          <button name="choice" value="reschedule" className={`${ghostClass} flex-1`}>Request a new time</button>
        </form>
      ) : null}
      {canAnswer && followup.kind === "offer" ? (
        <form action={respondToFollowup} className="mt-6 flex gap-2">
          <input type="hidden" name="token" value={token} />
          <button name="choice" value="accepted" className={`${buttonClass} flex-1`}>Accept Quote</button>
          <button name="choice" value="changes" className={`${ghostClass} flex-1`}>Request Changes</button>
        </form>
      ) : null}
    </main>
  );
}
