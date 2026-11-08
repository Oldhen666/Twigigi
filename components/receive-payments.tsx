"use client";

import { useState } from "react";
import { savePayoutDetails, startStripeConnect } from "@/lib/actions";
import { buttonClass, inputClass, labelClass } from "@/components/ui";
import { SELLER_PAYMENT_RESPONSIBILITY } from "@/lib/legal";

export function ReceivePayments({
  stripeReady,
  stripeStarted,
  stripeMessage,
  interac,
  venmo,
  zelle,
  initialCountry,
}: {
  stripeReady: boolean;
  stripeStarted: boolean;
  stripeMessage: "" | "setup" | "error";
  interac: string;
  venmo: string;
  zelle: string;
  initialCountry: "CA" | "US";
}) {
  const [country, setCountry] = useState<"CA" | "US">(initialCountry);
  const canada = country === "CA";
  const stripeStatus = stripeReady ? "Connected" : stripeStarted ? "Setup not finished" : "Not connected";

  return (
    <div className="space-y-4">
      <section className="rounded-3xl border border-line bg-card p-5">
        <h2 className="font-serif text-2xl">Your country</h2>
        <label className="mt-4 block">
          <span className="sr-only">Your country</span>
          <select
            value={country}
            onChange={(event) => setCountry(event.target.value === "US" ? "US" : "CA")}
            className={inputClass}
          >
            <option value="CA">Canada</option>
            <option value="US">United States</option>
          </select>
        </label>
      </section>

      <section className="rounded-3xl border border-line bg-card p-5">
        <h2 className="font-serif text-2xl">Card payments</h2>
        <p className="mt-2 text-sm leading-6 text-muted">
          Accept card payments for digital file orders through Stripe. The money goes to your connected Stripe account.
        </p>
        <p className="mt-3 flex items-center gap-2 text-sm text-muted">
          <span className={`size-2 rounded-full ${stripeReady ? "bg-forest" : "bg-clay"}`} aria-hidden />
          {stripeStatus}
        </p>
        {stripeMessage === "setup" ? <p className="mt-3 text-sm text-clay">Stripe is not set up on this server yet.</p> : null}
        {stripeMessage === "error" ? <p className="mt-3 text-sm text-clay">Stripe could not open the connection page.</p> : null}
        {stripeReady ? null : (
          <form action={startStripeConnect} className="mt-4">
            <input type="hidden" name="country" value={country} />
            <button className={`${buttonClass} w-full`}>{stripeStarted ? "Continue Stripe setup" : "Connect Stripe"}</button>
          </form>
        )}
        <p className="mt-3 text-sm leading-6 text-muted">
          Stripe processing fees apply. Twigigi does not charge an additional transaction fee for this payment method.
        </p>
      </section>

      <section className="rounded-3xl border border-line bg-card p-5">
        <h2 className="font-serif text-2xl">Direct payments</h2>
        <p className="mt-2 text-sm leading-6 text-muted">
          Buyers pay you with these details, and you confirm the money yourself. These are not used for digital file card payments.
        </p>
        <form action={savePayoutDetails} className="mt-4 grid gap-4" noValidate>
          {canada ? (
            <label>
              <span className={labelClass}>Interac e-Transfer email</span>
              <input name="interac" type="email" defaultValue={interac} placeholder="you@example.com" autoComplete="email" className={inputClass} />
            </label>
          ) : (
            <label>
              <span className={labelClass}>Venmo username</span>
              <input name="venmo" defaultValue={venmo} placeholder="username" autoComplete="off" className={inputClass} />
            </label>
          )}
          {canada ? <input type="hidden" name="venmo" value={venmo} /> : <input type="hidden" name="interac" value={interac} />}
          <details className="rounded-2xl border border-line px-4 py-3">
            <summary className="cursor-pointer text-sm font-medium">Other payment methods</summary>
            <div className="mt-3">
              {canada ? (
                <>
                  <input type="hidden" name="zelle" value={zelle} />
                  <p className="text-sm leading-6 text-muted">Cash is arranged on each Twig. A digital file uses the PayPal email on that Twig.</p>
                </>
              ) : (
                <label>
                  <span className={labelClass}>Zelle email or phone</span>
                  <input name="zelle" defaultValue={zelle} placeholder="you@example.com" autoComplete="off" className={inputClass} />
                </label>
              )}
            </div>
          </details>
          <button className={`${buttonClass} w-full`}>Save payment details</button>
        </form>
      </section>

      <details className="rounded-3xl border border-line bg-card px-5 py-4">
        <summary className="cursor-pointer">
          <span className="font-medium">Payment responsibilities</span>
          <span className="mt-1 block text-sm leading-6 text-muted">
            You are responsible for keeping your payment details accurate and confirming payments received outside Stripe. View full payment terms
          </span>
        </summary>
        <div className="mt-4 space-y-3 border-t border-line pt-4 text-sm leading-6 text-muted">
          {SELLER_PAYMENT_RESPONSIBILITY.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
        </div>
      </details>
    </div>
  );
}
