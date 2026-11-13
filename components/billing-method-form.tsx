"use client";

import { useState } from "react";
import { beginBillingSetup, resumeAutomaticRenewal, stopAutomaticRenewal } from "@/lib/actions";
import { BILLING_CONSENT_VERSION } from "@/lib/billing-auth";
import { buttonClass } from "@/components/ui";

export function BillingMethodForm({
  saved,
  ready,
  notice,
  autoRenew,
  cardLabel,
}: {
  saved: "" | "card" | "paypal" | "stripe";
  ready: boolean;
  notice: string;
  autoRenew: boolean;
  cardLabel: string;
}) {
  const [method, setMethod] = useState<"card" | "paypal">(saved === "paypal" ? "paypal" : "card");
  const chosen = saved === "paypal" ? "PayPal" : saved === "card" || saved === "stripe" ? "Card" : "";
  const status = autoRenew ? "Auto-renew on" : ready ? "Saved" : chosen ? "Not connected" : "Not saved";

  return (
    <section className="rounded-3xl border border-line bg-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h2 className="font-serif text-2xl">How you pay Twigigi</h2>
        <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${autoRenew ? "bg-forest text-card" : "bg-[#f4e7d4] text-[#8a5a2b]"}`}>{status}</span>
      </div>
      <p className="mt-2 text-sm leading-6 text-muted">This pays Twigigi for listing and quote fees. Buyers never pay it, and it does not receive their payments. A one-time listing payment does not allow future automatic charges.</p>
      {cardLabel ? <p className="mt-3 text-sm font-medium">Saved card · {cardLabel}</p> : null}
      {chosen && !cardLabel ? <p className="mt-3 text-sm font-medium">{chosen} · {status}</p> : null}
      {notice ? <p className="mt-3 text-sm text-clay">{notice}</p> : null}
      {autoRenew ? (
        <form action={stopAutomaticRenewal} className="mt-4">
          <button className={`${buttonClass} w-full bg-white text-ink sm:w-fit`}>Turn off automatic renewal</button>
          <p className="mt-2 text-sm text-muted">Paid time already purchased stays in place. Twigigi will not charge this card again until you agree again.</p>
        </form>
      ) : null}
      <form action={beginBillingSetup} className="mt-4 grid gap-3">
        <label className="flex cursor-pointer gap-3">
          <input type="radio" name="method" value="card" checked={method === "card"} onChange={() => setMethod("card")} className="mt-1 accent-forest" />
          <span>
            <span className="block font-medium">Credit or debit card</span>
            <span className="mt-0.5 block text-sm text-muted">Stripe stores the card for later off-session charges. Twigigi does not store the card number.</span>
          </span>
        </label>
        <label className="flex cursor-pointer gap-3">
          <input type="radio" name="method" value="paypal" checked={method === "paypal"} onChange={() => setMethod("paypal")} className="mt-1 accent-forest" />
          <span>
            <span className="block font-medium">PayPal</span>
            <span className="mt-0.5 block text-sm text-muted">Manual payments and catch-up payments only. PayPal does not turn on automatic renewal.</span>
          </span>
        </label>
        {method === "card" ? (
          <label className="flex cursor-pointer gap-3 rounded-2xl border border-line p-3">
            <input type="checkbox" name="consent" value="yes" required className="mt-1 accent-forest" />
            <span className="text-sm leading-6">
              I agree that Twigigi may charge this card when a listing renews, including unpaid quote fees in the same currency, without me being present. Agreement {BILLING_CONSENT_VERSION}.
            </span>
          </label>
        ) : null}
        <button className={`${buttonClass} w-full sm:w-fit`}>{method === "paypal" ? "Use PayPal for manual payments" : autoRenew ? "Replace the saved card" : "Save a card for automatic renewal"}</button>
      </form>
      {!autoRenew && cardLabel ? (
        <form action={resumeAutomaticRenewal} className="mt-4 grid gap-3 border-t border-line pt-4">
          <label className="flex cursor-pointer gap-3">
            <input type="checkbox" name="consent" value="yes" required className="mt-1 accent-forest" />
            <span className="text-sm leading-6">I agree again to automatic renewal on the saved card. Agreement {BILLING_CONSENT_VERSION}.</span>
          </label>
          <button className={`${buttonClass} w-full sm:w-fit`}>Turn automatic renewal back on</button>
        </form>
      ) : null}
    </section>
  );
}
