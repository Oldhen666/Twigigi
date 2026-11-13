"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { beginBillingSetup, resumeAutomaticRenewal, stopAutomaticRenewal } from "@/lib/actions";
import { BILLING_CONSENT_VERSION } from "@/lib/billing-auth";
import { buttonClass } from "@/components/ui";

const focusClass = "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest";

export function BillingMethodForm({
  saved,
  ready,
  notice,
  autoRenew,
  cardLabel,
  chargesOn,
}: {
  saved: "" | "card" | "paypal" | "stripe";
  ready: boolean;
  notice: string;
  autoRenew: boolean;
  cardLabel: string;
  chargesOn: boolean;
}) {
  const [method, setMethod] = useState<"card" | "paypal">(saved === "paypal" ? "paypal" : "card");
  const cardSaved = Boolean(cardLabel) || (ready && (saved === "card" || saved === "stripe"));
  const methodStatus = saved === "paypal"
    ? "PayPal · Manual payments only"
    : cardSaved
      ? cardLabel ? `Card saved · ${cardLabel}` : "Card saved"
      : "No card saved";

  return (
    <section className="rounded-3xl border border-line bg-card p-5">
      <h2 className="font-serif text-2xl">How you pay Twigigi</h2>
      <dl className="mt-3 space-y-1 text-sm">
        <div className="flex flex-wrap gap-x-2">
          <dt className="text-muted">Payment method</dt>
          <dd className="font-medium">{methodStatus}</dd>
        </div>
        <div className="flex flex-wrap gap-x-2">
          <dt className="text-muted">Automatic renewal</dt>
          <dd className="font-medium">{autoRenew ? "On" : "Off"}</dd>
        </div>
        <div className="flex flex-wrap gap-x-2">
          <dt className="text-muted">Automatic charging</dt>
          <dd className="font-medium">{chargesOn ? "Available" : "Not available yet"}</dd>
        </div>
      </dl>
      {!chargesOn ? <p className="mt-3 max-w-2xl text-sm leading-6 text-muted">Automatic charging is not available yet. A saved card and renewal permission do not start a charge.</p> : null}
      {notice ? <p className="mt-3 text-sm text-clay" role="status">{notice}</p> : null}
      {autoRenew ? (
        <form action={stopAutomaticRenewal} className="mt-4">
          <SubmitButton label="Turn off automatic renewal" pendingLabel="Saving…" tone="ghost" />
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">Paid time already purchased stays in place. Twigigi will not charge this card again until you agree again.</p>
        </form>
      ) : null}
      <form action={beginBillingSetup} className="mt-4 grid gap-3">
        <fieldset>
          <legend className="sr-only">Payment method</legend>
          <label className="flex cursor-pointer gap-3">
            <input type="radio" name="method" value="card" checked={method === "card"} onChange={() => setMethod("card")} className={`mt-1 accent-forest ${focusClass}`} />
            <span>
              <span className="block font-medium">Credit or debit card</span>
              <span className="mt-0.5 block text-sm text-muted">Stripe stores the card for later charges. Twigigi does not store the card number.</span>
            </span>
          </label>
          <label className="mt-3 flex cursor-pointer gap-3">
            <input type="radio" name="method" value="paypal" checked={method === "paypal"} onChange={() => setMethod("paypal")} className={`mt-1 accent-forest ${focusClass}`} />
            <span>
              <span className="block font-medium">PayPal</span>
              <span className="mt-0.5 block text-sm text-muted">Manual payments only. PayPal does not turn on automatic renewal.</span>
            </span>
          </label>
        </fieldset>
        {method === "card" ? (
          <label className="flex cursor-pointer gap-3 rounded-2xl border border-line p-3">
            <input type="checkbox" name="consent" value="yes" required className={`mt-1 accent-forest ${focusClass}`} />
            <span className="text-sm leading-6">
              I agree that Twigigi may charge this card when a listing renews, including unpaid quote fees in the same currency, without me being present. Agreement {BILLING_CONSENT_VERSION}.
            </span>
          </label>
        ) : null}
        <SubmitButton
          label={method === "paypal" ? "Use PayPal for manual payments" : autoRenew ? "Replace the saved card" : "Save a card"}
          pendingLabel={method === "paypal" ? "Opening PayPal…" : "Opening Stripe…"}
        />
        {method === "card" ? <p className="max-w-2xl text-sm leading-6 text-muted">Adding a card does not charge you now.</p> : <p className="max-w-2xl text-sm leading-6 text-muted">Choosing PayPal does not charge you now.</p>}
        {method === "card" && !chargesOn ? <p className="max-w-2xl text-sm leading-6 text-muted">The agreement is still required. Automatic charging stays unavailable, so this card is not charged yet.</p> : null}
      </form>
      {!autoRenew && cardLabel ? (
        <form action={resumeAutomaticRenewal} className="mt-4 grid gap-3 border-t border-line pt-4">
          <label className="flex cursor-pointer gap-3">
            <input type="checkbox" name="consent" value="yes" required className={`mt-1 accent-forest ${focusClass}`} />
            <span className="text-sm leading-6">I agree again that Twigigi may charge the saved card when a listing renews. Agreement {BILLING_CONSENT_VERSION}.</span>
          </label>
          <SubmitButton label={chargesOn ? "Turn automatic renewal back on" : "Save renewal permission"} pendingLabel="Saving…" />
          {chargesOn ? null : <p className="max-w-2xl text-sm leading-6 text-muted">This records permission for later. Automatic charging is not available yet, so the card is not charged.</p>}
        </form>
      ) : null}
    </section>
  );
}

function SubmitButton({ label, pendingLabel, tone = "solid" }: { label: string; pendingLabel: string; tone?: "solid" | "ghost" }) {
  const { pending } = useFormStatus();
  const toneClass = tone === "ghost" ? "bg-white text-ink" : "";
  return (
    <button disabled={pending} className={`${buttonClass} ${toneClass} ${focusClass} w-full sm:w-fit`}>
      {pending ? pendingLabel : label}
    </button>
  );
}
