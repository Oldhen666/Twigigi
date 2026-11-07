"use client";

import { useState } from "react";
import { buyerReportPayment } from "@/lib/actions";
import { buttonClass, ghostClass } from "@/components/ui";
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
  sellerName = "",
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
  sellerName?: string;
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
        {method === "paypal" && !paypal ? <p className="mt-3 text-sm text-muted">The seller has not added a PayPal.Me link.</p> : null}
        {method === "venmo" && !venmo ? <p className="mt-3 text-sm text-muted">The seller has not added a Venmo username.</p> : null}
        {paypal || venmo ? (
          <p className="mt-3 text-sm leading-6 text-muted">{recipientCheck(method, sellerName)}</p>
        ) : null}
        {paypal ? <PayServiceLink href={paypal} service="paypal" /> : null}
        {venmo ? <PayServiceLink href={venmo} service="venmo" /> : null}
        {card ? (
          <a href={card} target="_blank" rel="noreferrer" className="mt-3 inline-block text-sm text-forest">Open card payment</a>
        ) : null}
        <p className="mt-3 text-sm leading-6 text-muted">
          {method === "paypal" || method === "venmo"
            ? "If available, include your order ID in the payment note."
            : "Include your order number in the transfer message to help the seller identify your payment."}
        </p>
        {cash ? null : (
          <p className="mt-2 text-sm leading-6 text-muted">The seller is responsible for these payment details. Twigigi does not verify them or hold the payment.</p>
        )}
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
      {venmo ? <PayServiceLink href={venmo} service="venmo" /> : method === "venmo" ? (
        <p className="text-sm text-muted">The seller has not added a Venmo username.</p>
      ) : null}
      {paypal ? <PayServiceLink href={paypal} service="paypal" /> : null}
      {paypal || venmo ? (
        <p className="text-sm leading-6 text-muted">
          {recipientCheck(method, sellerName)} If available, include your order ID in the payment note.
        </p>
      ) : null}
      {cash ? null : <p className="text-sm leading-6 text-muted">The seller is responsible for these payment details. Twigigi does not verify them or hold the payment.</p>}
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

function recipientCheck(method: string, sellerName: string) {
  const service = method === "venmo" ? "Venmo" : "PayPal";
  const who = sellerName.trim() || "the seller";
  return `Before you pay, confirm the name on ${service} matches ${who}.`;
}

function PayServiceLink({ href, service }: { href: string; service: "paypal" | "venmo" }) {
  return (
    <a href={href} target="_blank" rel="noreferrer" className={`${ghostClass} mt-3 w-full gap-2`}>
      {service === "paypal" ? <PayPalMark /> : <VenmoMark />}
      {service === "paypal" ? "Pay with PayPal" : "Pay with Venmo"}
    </a>
  );
}

function PayPalMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden>
      <path fill="#003087" d="M8.2 19.5 9.7 9.2h3.7c2.4 0 4 1 3.6 3.3-.5 2.4-2.3 3.7-4.7 3.7h-1.6l-.7 3.3H8.2Z" />
      <path fill="#009cde" d="M6.6 18.2 8.2 7.4h3.8c2.4 0 4 1 3.5 3.4-.5 2.5-2.3 3.7-4.7 3.7H9.1l-.6 3.7H6.6Z" />
    </svg>
  );
}

function VenmoMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden>
      <circle cx="12" cy="12" r="10" fill="#008CFF" />
      <path fill="#fff" d="M16.2 6.4c.4.7.6 1.5.6 2.5 0 3.1-2.6 7.1-4.6 9.4H8.6L6.7 7.2l3.2-.3 1 6.6c1-1.6 2.1-4 2.1-5.6 0-.8-.2-1.4-.4-1.9l3.6.4Z" />
    </svg>
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
