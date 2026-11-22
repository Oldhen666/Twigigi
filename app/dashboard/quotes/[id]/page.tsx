import { notFound } from "next/navigation";
import { Suspense } from "react";
import { markQuoteInvoicePaid, sendQuoteInvoice, sendSiteVisit } from "@/lib/actions";
import { QuoteContact } from "@/components/quote-contact";
import { SellerQuoteActions } from "@/components/seller-quote-actions";
import { requireSeller } from "@/lib/auth";
import { getInteractionBySource, getProductById, getQuote, quoteFollowupCovered, quoteFollowups, readQuoteTwigSettings } from "@/lib/db";
import { formatDate, formatMoney, srcLabel } from "@/lib/format";
import { FOLLOWUP_COVERED_NOTICE, FOLLOWUP_SEND_NOTICE } from "@/lib/quote-followup";
import { buttonClass, ghostClass, inputClass } from "@/components/ui";

const STATUS_LABEL = { new: "New", contacted: "Contacted", closed: "Closed" } as const;

async function QuoteScreen({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireSeller();
  const { id } = await params;
  const query = await searchParams;
  const quote = getQuote(id);
  const product = quote ? getProductById(quote.productId) : null;
  if (!quote || !product || product.userId !== user.id) notFound();
  const interaction = getInteractionBySource(quote.id);
  const notice = typeof query.notice === "string" ? query.notice : "";
  const phone = quote.phone.trim();
  const contact = [quote.name, quote.email, phone].filter(Boolean).join("\n");
  const details = detailCards(quote.projectDetails);
  const settings = readQuoteTwigSettings(product.id);
  const tools = {
    visit: settings?.visitEnabled ?? false,
    offer: settings ? settings.offerEnabled : true,
    invoice: settings?.invoiceEnabled ?? false,
  };
  const followups = quoteFollowups(quote.id);
  const covered = quoteFollowupCovered(quote.id);
  const offerState = followups.filter((item) => item.kind === "offer" && item.status !== "draft").at(-1);
  const visitState = followups.filter((item) => item.kind === "visit" && item.status !== "draft").at(-1);
  const invoiceState = followups.filter((item) => item.kind === "invoice" && item.status !== "draft").at(-1);
  const acceptedOffer = [...followups].reverse().find((item) => item.kind === "offer" && item.status === "accepted");
  const currency = product.currency || "CAD";
  const offer = quote.offerSentAt && quote.offerKind
    ? { kind: quote.offerKind, cents: quote.offerCents, scope: quote.offerScope, note: quote.offerNote, timeline: quote.offerTimeline, validDays: quote.offerValidDays }
    : null;

  return (
    <main className="page-frame pb-16">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm text-muted">Quote request{interaction ? ` · ${interaction.publicRef}` : ""}</p>
        <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs ${quote.status === "new" ? "bg-clay/15 text-clay" : quote.status === "contacted" ? "bg-forest/10 text-forest" : "bg-line text-muted"}`}>
          {STATUS_LABEL[quote.status]}
        </span>
      </div>
      <h1 className="mt-1 font-serif text-4xl">{quote.productTitle}</h1>

      {notice === "sent" ? <p className="mt-4 rounded-2xl bg-forest/10 px-4 py-3 text-sm text-forest">Sent. The customer email was accepted by the mail service.</p> : null}
      {notice === "saved" ? <p className="mt-4 rounded-2xl bg-clay/10 px-4 py-3 text-sm">Saved. The email was not accepted, so no follow-up fee was added.</p> : null}
      {notice === "draft" ? <p className="mt-4 rounded-2xl bg-paper-deep px-4 py-3 text-sm">Draft saved. Nothing was sent and no fee was added.</p> : null}
      {notice === "paid" ? <p className="mt-4 rounded-2xl bg-forest/10 px-4 py-3 text-sm text-forest">Invoice marked paid.</p> : null}
      <p className="mt-4 text-sm leading-6">
        Inquiry received.
        {visitState?.status === "confirmed" ? " Site visit confirmed." : visitState ? " Site visit sent." : ""}
        {offerState?.status === "accepted" ? " Quote accepted." : offerState?.status === "sent" ? " Quote sent." : ""}
        {invoiceState?.status === "sent" ? " Invoice sent." : ""}
        {invoiceState?.status === "paid" ? " Invoice paid." : ""}
      </p>

      <section className="mt-4 rounded-3xl border border-line bg-card p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-serif text-3xl">{quote.name}</h2>
            <p className="mt-1 text-sm text-muted">Submitted {formatDate(quote.createdAt)}</p>
          </div>
          {quote.src ? <span className="rounded-full bg-white px-2.5 py-1 text-xs text-muted">{srcLabel(quote.src)}</span> : null}
        </div>

        <h3 className="mt-6 text-sm font-medium">Contact buyer</h3>
        <QuoteContact email={quote.email} phone={phone} contact={contact} />

        <h3 className="mt-6 border-t border-line pt-5 text-sm font-medium">Project details</h3>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <Detail label="Quantity" value={String(quote.quantity)} />
          {details.map((item) => (
            <Detail key={`${item.label}-${item.value}`} label={item.label} value={item.value} wide={!item.label || item.label.length > 42 || item.value.length > 42} />
          ))}
          {quote.message ? <Detail label="Message" value={quote.message} wide /> : null}
        </div>
        {quote.documents.length > 0 ? (
          <ul className="mt-3 space-y-1 text-sm">
            {quote.documents.map((file) => (
              <li key={file.path}>
                <a href={file.path} target="_blank" rel="noreferrer" className="text-forest">{file.name}</a>
              </li>
            ))}
          </ul>
        ) : null}

        {offer && quote.offerSentAt ? (
          <div className="mt-6 rounded-2xl bg-white px-4 py-4">
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted">Quote sent</p>
            <p className="mt-1 font-serif text-3xl">{formatMoney(offer.cents, currency)}</p>
            <p className="mt-1 text-sm text-muted">{offer.kind === "fixed" ? "Fixed price" : "Estimated price"} · Valid for {offer.validDays} days{offer.timeline ? ` · ${offer.timeline}` : ""} · Sent {formatDate(quote.offerSentAt)}</p>
            <p className="mt-3 text-sm">{offer.scope}</p>
            {offer.note ? (
              <p className="mt-3 text-sm">
                <span className="block text-xs text-muted">Note</span>
                {offer.note}
              </p>
            ) : null}
          </div>
        ) : null}

        <SellerQuoteActions quoteId={quote.id} status={quote.status} currency={currency} offer={offer} offerEnabled={tools.offer} covered={covered} />
        {tools.visit ? (
          <form action={sendSiteVisit} className="mt-4 space-y-3 rounded-2xl border border-line p-4">
            <h3 className="text-sm font-medium">Schedule a Site Visit</h3>
            <input type="hidden" name="id" value={quote.id} />
            <input name="visitDate" type="date" required className={inputClass} />
            <input name="visitTime" type="time" required className={inputClass} />
            <input name="timezone" placeholder="Time zone, such as America/Edmonton" className={inputClass} />
            <textarea name="note" rows={2} placeholder="Note, optional" className={`${inputClass} h-auto py-3`} />
            <button name="intent" value="draft" className={`${ghostClass} w-full`}>Save visit draft</button>
            <p className="text-sm leading-6">{covered ? FOLLOWUP_COVERED_NOTICE : FOLLOWUP_SEND_NOTICE}</p>
            <button name="intent" value="send" className={`${buttonClass} w-full`}>Send site visit</button>
          </form>
        ) : null}
        {tools.invoice ? (
          <form action={sendQuoteInvoice} className="mt-4 space-y-3 rounded-2xl border border-line p-4">
            <h3 className="text-sm font-medium">Send an Invoice</h3>
            <input type="hidden" name="id" value={quote.id} />
            <input type="hidden" name="currency" value={acceptedOffer ? String(acceptedOffer.payload.currency || currency) : currency} />
            <input name="amount" inputMode="decimal" defaultValue={acceptedOffer ? (Number(acceptedOffer.payload.cents || 0) / 100).toFixed(2) : ""} placeholder="Amount" className={inputClass} />
            <input name="dueOn" type="date" required className={inputClass} />
            <textarea name="note" rows={3} placeholder="Payment instructions" className={`${inputClass} h-auto py-3`} />
            <button name="intent" value="draft" className={`${ghostClass} w-full`}>Save invoice draft</button>
            <p className="text-sm leading-6">{covered ? FOLLOWUP_COVERED_NOTICE : FOLLOWUP_SEND_NOTICE}</p>
            <button name="intent" value="send" className={`${buttonClass} w-full`}>Send invoice</button>
          </form>
        ) : null}
        {invoiceState?.status === "sent" ? (
          <form action={markQuoteInvoicePaid} className="mt-3">
            <input type="hidden" name="quoteId" value={quote.id} />
            <input type="hidden" name="id" value={invoiceState.id} />
            <button className={`${ghostClass} w-full`}>Mark invoice paid</button>
          </form>
        ) : null}
        {followups.length > 0 ? (
          <ul className="mt-4 space-y-2 text-sm">
            {followups.map((item) => (
              <li key={item.id} className="rounded-2xl bg-white px-4 py-3">
                {item.kind === "visit" ? "Site visit" : item.kind === "offer" ? "Quote" : "Invoice"} · {item.status}{item.sentAt ? ` · ${formatDate(item.sentAt)}` : ""}
              </li>
            ))}
          </ul>
        ) : null}
      </section>
    </main>
  );
}

function Detail({ label, value, wide = false }: { label: string; value: string; wide?: boolean }) {
  return (
    <div className={`rounded-2xl bg-white px-4 py-3 ${wide ? "sm:col-span-2" : ""}`}>
      {label ? <p className="text-xs text-muted">{label}</p> : null}
      <p className={`${label ? "mt-1" : ""} text-base`}>{value}</p>
    </div>
  );
}

function detailCards(details: string) {
  return details
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const match = line.match(/^([^:]{1,80}):\s*(.+)$/);
      return match ? { label: match[1], value: match[2] } : { label: "", value: line };
    });
}

export default function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <Suspense fallback={<p className="px-5 text-muted">Loading quote…</p>}>
      <QuoteScreen params={params} searchParams={searchParams} />
    </Suspense>
  );
}

export const metadata = { title: "Quote", robots: { index: false, follow: false } };
