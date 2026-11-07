"use client";

import { useState } from "react";
import { buyerReportPayment } from "@/lib/actions";
import { buttonClass } from "@/components/ui";
import { formatMoney } from "@/lib/format";
import { isCashMethod, methodLabel, paypalMeUrl, safeCardUrl, safeEmail, venmoPayUrl } from "@/lib/payments";

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
      {cash ? <p className="text-sm text-muted">Pay the seller in cash when you pick it up.</p> : null}
      <button className={`${buttonClass} w-full`} disabled={!method}>
        {cash ? "I'll pay cash at pickup" : "I've paid the seller"}
      </button>
      <p className="text-sm text-muted">Twigigi does not take the payment. Marking it paid tells the seller to prepare the order.</p>
    </form>
  );
}
