"use client";

import { useState } from "react";
import { beginBillingSetup } from "@/lib/actions";
import { buttonClass } from "@/components/ui";

export function BillingMethodForm({
  saved,
  ready,
  notice,
}: {
  saved: "" | "card" | "paypal" | "stripe";
  ready: boolean;
  notice: string;
}) {
  const [method, setMethod] = useState<"card" | "paypal">(saved === "paypal" ? "paypal" : "card");
  const chosen = saved === "paypal" ? "PayPal" : saved === "card" || saved === "stripe" ? "Card" : "";
  const status = ready ? "Connected" : chosen ? "Not connected" : "Not saved";

  return (
    <section className="rounded-3xl border border-line bg-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h2 className="font-serif text-2xl">How you pay Twigigi</h2>
        <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${ready ? "bg-forest text-card" : "bg-[#f4e7d4] text-[#8a5a2b]"}`}>{status}</span>
      </div>
      <p className="mt-2 text-sm leading-6 text-muted">This card or PayPal pays your listing fee and quote fees. Buyers never pay it, and it does not receive their payments. Choosing one here does not connect it.</p>
      {chosen ? <p className="mt-3 text-sm font-medium">{chosen} · {status}</p> : null}
      {notice ? <p className="mt-3 text-sm text-clay">{notice}</p> : null}
      <form action={beginBillingSetup} className="mt-4 grid gap-3">
        <label className="flex cursor-pointer gap-3">
          <input type="radio" name="method" value="card" checked={method === "card"} onChange={() => setMethod("card")} className="mt-1 accent-forest" />
          <span>
            <span className="block font-medium">Credit or debit card</span>
            <span className="mt-0.5 block text-sm text-muted">Visa, Mastercard, Amex. Stripe stores the card. Twigigi does not.</span>
          </span>
        </label>
        <label className="flex cursor-pointer gap-3">
          <input type="radio" name="method" value="paypal" checked={method === "paypal"} onChange={() => setMethod("paypal")} className="mt-1 accent-forest" />
          <span>
            <span className="block font-medium">PayPal</span>
            <span className="mt-0.5 block text-sm text-muted">Pay from your PayPal account after PayPal approves the billing agreement.</span>
          </span>
        </label>
        <button className={`${buttonClass} w-full sm:w-fit`}>{method === "paypal" ? "Authorize PayPal for Twigigi fees" : "Authorize a card for Twigigi fees"}</button>
        <p className="text-sm text-muted">Twigigi cannot charge the bill above until this authorization is finished.</p>
      </form>
    </section>
  );
}
