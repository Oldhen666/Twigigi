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
}) {
  const [method, setMethod] = useState(methods[0] ?? "");
  const [confirming, setConfirming] = useState(false);
  const email = method === "interac" ? safeEmail(interacEmail) : "";
  const venmo = method === "venmo" ? venmoPayUrl(venmoUsername, { amountCents, note: orderNote }) : "";
  const paypal = method === "paypal" ? paypalMeUrl(paypalMe, { amountCents, currency }) : "";
  const card = method === "card" ? safeCardUrl(cardPaymentUrl) : "";
  const cash = isCashMethod(method);
  if (methods.length === 0) return <p className="mt-4 text-sm text-muted">The seller has not added a way to pay yet.</p>;
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
