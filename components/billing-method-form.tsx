"use client";

import { useState } from "react";
import { saveBillingMethod } from "@/lib/actions";
import { buttonClass } from "@/components/ui";

export function BillingMethodForm({ saved }: { saved: "" | "card" | "paypal" | "stripe" }) {
  const [method, setMethod] = useState<"card" | "paypal">(saved === "paypal" ? "paypal" : "card");
  const stored = saved === "paypal" ? "paypal" : saved === "card" || saved === "stripe" ? "card" : "";
  const unsaved = stored ? stored !== method : method === "paypal";

  return (
    <section className="rounded-3xl border border-line bg-card p-5">
      <h2 className="font-serif text-2xl">Card on file</h2>
      {method === "paypal" ? (
        <p className="mt-3">PayPal is selected. No card number is saved.</p>
      ) : (
        <>
          <p className="mt-3 font-medium">Credit or debit card</p>
          <p className="mt-2 text-sm text-muted">
            Choose Card or PayPal below, then save. Twigigi does not keep the card number, so it is not typed on this page. Stripe charges it when a listing fee is due.
          </p>
        </>
      )}
      <form action={saveBillingMethod} className="mt-4 grid gap-3">
        <input type="hidden" name="next" value="/dashboard/payments?tab=receipts" />
        <label className="flex cursor-pointer gap-3">
          <input
            type="radio"
            name="method"
            value="card"
            checked={method === "card"}
            onChange={() => setMethod("card")}
            className="mt-1 accent-forest"
          />
          <span>
            <span className="block">Credit or debit card</span>
            <span className="mt-0.5 block text-sm text-muted">Visa · Mastercard · Amex, charged through Stripe</span>
          </span>
        </label>
        <label className="flex cursor-pointer items-center gap-3">
          <input
            type="radio"
            name="method"
            value="paypal"
            checked={method === "paypal"}
            onChange={() => setMethod("paypal")}
            className="accent-forest"
          />
          <span>PayPal</span>
        </label>
        <button className={`${buttonClass} w-fit`}>{saved ? "Save payment method" : "Add a payment method"}</button>
        {unsaved ? <p className="text-sm text-muted">Not saved yet.</p> : null}
      </form>
    </section>
  );
}
