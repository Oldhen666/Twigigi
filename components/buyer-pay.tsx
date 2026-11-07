"use client";

import { useState } from "react";
import { buyerReportPayment } from "@/lib/actions";
import { buttonClass } from "@/components/ui";
import { formatMoney } from "@/lib/format";
import { isCashMethod, methodLabel, paypalMeUrl, safeCardUrl, safeEmail, venmoPayUrl } from "@/lib/payments";
import { PaymentRiskNote } from "@/components/payment-risk";

export function BuyerPay({
  orderId,
  methods,
  cardPaymentUrl = "",
  interacEmail = "",
  interacQuestion = "",
  interacPassword = "",
  venmoUsername = "",
  paypalMe = "",
  amountCents,
  currency,
  orderNote = "",
  orderRef = "",
  variant = "form",
  reported = false,
}: {
  orderId: string;
  methods: string[];
  cardPaymentUrl?: string;
  interacEmail?: string;
  interacQuestion?: string;
  interacPassword?: string;
  venmoUsername?: string;
  paypalMe?: string;
  amountCents: number;
  currency: string;
  orderNote?: string;
  orderRef?: string;
  variant?: "form" | "sheet";
  reported?: boolean;
}) {
  const [method, setMethod] = useState(methods[0] ?? "");
  const [confirming, setConfirming] = useState(false);
  const email = method === "interac" ? safeEmail(interacEmail) : "";
  const venmo = method === "venmo" ? venmoPayUrl(venmoUsername, { amountCents, note: orderNote }) : "";
  const paypal = method === "paypal" ? paypalMeUrl(paypalMe, { amountCents, currency }) : "";
  const card = method === "card" ? safeCardUrl(cardPaymentUrl) : "";
  const cash = isCashMethod(method);
  const amountLabel = `${formatMoney(amountCents, currency)} ${currency}`;
  if (methods.length === 0) return <p className="mt-4 text-sm text-muted">The seller has not added a way to pay yet.</p>;
  if (variant === "sheet") {
    const rows = paymentRows({
      method,
      email,
      interacQuestion,
      interacPassword,
      venmoUsername,
      paypalMe,
      amountLabel,
      orderRef,
    });
    return (
      <form action={buyerReportPayment} className="mt-4 rounded-3xl border border-line bg-white px-4 py-4">
        <input type="hidden" name="id" value={orderId} />
        <input type="hidden" name="method" value={method} />
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-semibold">Pay the seller</h2>
          <p className="text-sm text-muted">{methodLabel(method)}</p>
        </div>
        <div className="mt-4 divide-y divide-line rounded-2xl bg-paper px-4">
          {rows.map((row) => (
            <div key={row.label} className="flex items-center justify-between gap-3 py-3">
              <div className="min-w-0">
                <p className="text-sm text-muted">{row.label}</p>
                <p className={`mt-0.5 break-all ${row.strong ? "text-lg font-semibold text-forest" : "font-medium"}`}>{row.value}</p>
              </div>
              <CopyChip value={row.value} />
            </div>
          ))}
        </div>
        {venmo ? (
          <a href={venmo} target="_blank" rel="noreferrer" className="mt-3 inline-block text-sm text-forest">Open Venmo</a>
        ) : null}
        {paypal ? (
          <a href={paypal} target="_blank" rel="noreferrer" className="mt-3 inline-block text-sm text-forest">Open PayPal</a>
        ) : null}
        {card ? (
          <a href={card} target="_blank" rel="noreferrer" className="mt-3 inline-block text-sm text-forest">Open card payment</a>
        ) : null}
        <p className="mt-3 text-sm leading-6 text-muted">Include your order number in the transfer message to help the seller identify your payment.</p>
        {reported ? (
          <p className="mt-4 text-center text-sm text-muted">The seller is checking this payment. It is not paid until they confirm the money arrived.</p>
        ) : (
          <>
            <button className="mt-4 inline-flex h-12 w-full items-center justify-center rounded-full bg-ink text-base font-medium text-card">
              I've sent payment →
            </button>
            <p className="mt-3 text-center text-sm text-muted">The seller will verify your payment before marking it as paid.</p>
          </>
        )}
      </form>
    );
  }
  return (
    <form action={buyerReportPayment} className="mt-4 space-y-3">
      <input type="hidden" name="id" value={orderId} />
      <input type="hidden" name="method" value={method} />
      <p className="text-sm font-medium">Pay the seller</p>
      <div className="space-y-2">
        {methods.map((id) => (
          <label key={id} className={`block rounded-2xl border px-4 py-3 ${method === id ? "border-forest bg-moss" : "border-line"}`}>
            <input type="radio" name="shownMethod" value={id} checked={method === id} onChange={() => setMethod(id)} className="mr-2" />
            <span className="font-medium">{methodLabel(id)}</span>
          </label>
        ))}
      </div>
      {email || interacQuestion || interacPassword ? (
        <div className="rounded-2xl bg-paper-deep px-4 py-3 text-sm">
          <p className="font-medium">e-Transfer instructions</p>
          {email ? <p className="mt-2">Send it to: <a className="text-forest" href={`mailto:${email}`}>{email}</a></p> : null}
          {interacQuestion ? <p className="mt-1">Security question: {interacQuestion}</p> : null}
          {interacPassword ? <p className="mt-1">Password: {interacPassword}</p> : null}
        </div>
      ) : null}
      {venmo ? (
        <a href={venmo} target="_blank" rel="noreferrer" className={`${buttonClass} w-full`}>
          Pay {formatMoney(amountCents, currency)} with Venmo
        </a>
      ) : method === "venmo" ? (
        <p className="text-sm text-muted">The seller has not added a Venmo username.</p>
      ) : null}
      {paypal ? (
        <a href={paypal} target="_blank" rel="noreferrer" className={`${buttonClass} w-full`}>
          Pay {formatMoney(amountCents, currency)} with PayPal
        </a>
      ) : null}
      {card ? (
        <a href={card} target="_blank" rel="noreferrer" className={`${buttonClass} w-full`}>Pay by card</a>
      ) : null}
      {cash ? <p className="text-sm text-muted">Pay the seller in cash when you pick it up. It stays unpaid until they confirm the cash.</p> : null}
      {cash ? null : (
        <button type="button" className={`${buttonClass} w-full`} disabled={!method} onClick={() => setConfirming(true)}>
          I've Sent Payment
        </button>
      )}
      {confirming ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center" onClick={() => setConfirming(false)}>
          <div role="dialog" aria-modal="true" className="w-full max-w-md rounded-[28px] bg-card p-5" onClick={(event) => event.stopPropagation()}>
            <h2 className="font-serif text-3xl">Payment sent to the seller</h2>
            <div className="mt-3">
              <PaymentRiskNote cash={false} />
            </div>
            <p className="mt-3 text-sm text-muted">This does not mark the order paid. The seller confirms it after they see the money.</p>
            <div className="mt-5 flex gap-2">
              <button type="button" onClick={() => setConfirming(false)} className="inline-flex h-12 flex-1 items-center justify-center rounded-full border border-line">Back</button>
              <button className={`${buttonClass} flex-1`}>I've Sent Payment</button>
            </div>
          </div>
        </div>
      ) : null}
      <PaymentRiskNote cash={cash} />
    </form>
  );
}

function paymentRows({
  method,
  email,
  interacQuestion,
  interacPassword,
  venmoUsername,
  paypalMe,
  amountLabel,
  orderRef,
}: {
  method: string;
  email: string;
  interacQuestion: string;
  interacPassword: string;
  venmoUsername: string;
  paypalMe: string;
  amountLabel: string;
  orderRef: string;
}) {
  const rows: { label: string; value: string; strong?: boolean }[] = [];
  if (method === "interac" && email) rows.push({ label: "Send payment to", value: email });
  if (method === "interac" && interacQuestion) rows.push({ label: "Security question", value: interacQuestion });
  if (method === "interac" && interacPassword) rows.push({ label: "Password", value: interacPassword });
  if (method === "venmo" && venmoUsername.trim()) rows.push({ label: "Send payment to", value: venmoUsername.trim().replace(/^@/, "") });
  if (method === "paypal" && paypalMe.trim()) rows.push({ label: "Send payment to", value: paypalMe.trim() });
  rows.push({ label: "Amount", value: amountLabel, strong: true });
  if (orderRef) rows.push({ label: "Payment reference", value: orderRef });
  return rows;
}

function CopyChip({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1600);
        } catch {
          setCopied(false);
        }
      }}
      className="inline-flex h-8 shrink-0 items-center gap-1 rounded-full border border-line bg-white px-3 text-xs"
    >
      <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden>
        <rect x="5.2" y="5.2" width="8" height="8" rx="1.4" stroke="currentColor" strokeWidth="1.3" />
        <path d="M10.8 5.1V3.6A1.4 1.4 0 0 0 9.4 2.2H3.6A1.4 1.4 0 0 0 2.2 3.6v5.8A1.4 1.4 0 0 0 3.6 10.8H5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      </svg>
      {copied ? "Copied" : "Copy"}
    </button>
  );
}
