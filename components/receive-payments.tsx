"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import { savePayoutDetails, startStripeConnect } from "@/lib/actions";
import { buttonClass, ghostClass, inputClass, labelClass } from "@/components/ui";
import { SELLER_PAYMENT_RESPONSIBILITY } from "@/lib/legal";

export type PayoutCatalog = {
  hasProducts: boolean;
  hasFile: boolean;
  hasBuy: boolean;
  hasQuote: boolean;
};

type SavedField = "" | "interac" | "venmo" | "zelle";
type MethodId = "stripe" | "interac" | "venmo" | "zelle" | "cash" | "paypalFile";

const focusClass = "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest";

export function ReceivePayments({
  stripeReady,
  stripeStarted,
  stripeMessage,
  stripeReason = "",
  interac,
  venmo,
  zelle,
  initialCountry,
  catalog,
  saved = "",
}: {
  stripeReady: boolean;
  stripeStarted: boolean;
  stripeMessage: "" | "setup" | "error";
  stripeReason?: string;
  interac: string;
  venmo: string;
  zelle: string;
  initialCountry: "CA" | "US";
  catalog: PayoutCatalog;
  saved?: SavedField;
}) {
  const [country, setCountry] = useState<"CA" | "US">(initialCountry);
  const [offer, setOffer] = useState<"buy" | "file">(catalog.hasFile && !catalog.hasBuy ? "file" : "buy");
  const canada = country === "CA";
  const order = methodsFor(offer, canada);
  const savedLine = saved === "interac"
    ? (interac ? "e-Transfer email saved." : "e-Transfer email removed.")
    : saved === "venmo"
      ? (venmo ? "Venmo username saved." : "Venmo username removed.")
      : saved === "zelle"
        ? (zelle ? "Zelle details saved." : "Zelle details removed.")
        : "";

  return (
    <div className="space-y-3">
      {!catalog.hasProducts ? (
        <p className="max-w-2xl text-sm leading-6 text-muted">Nothing here is required before your first Twig. Card payments apply only to digital files and can wait.</p>
      ) : null}
      {catalog.hasQuote && !catalog.hasBuy && !catalog.hasFile ? (
        <p className="max-w-2xl text-sm leading-6 text-muted">Quote Twigs do not take a buyer payment here. Choose a payment method on the listing if that work is sold later.</p>
      ) : null}

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl border border-line bg-card px-4 py-3">
        <label className="flex min-w-0 flex-1 items-center gap-3 sm:max-w-sm">
          <span className="shrink-0 text-sm font-medium">Country</span>
          <select
            value={country}
            onChange={(event) => setCountry(event.target.value === "US" ? "US" : "CA")}
            className={`${inputClass} h-10 ${focusClass}`}
          >
            <option value="CA">Canada</option>
            <option value="US">United States</option>
          </select>
        </label>
      </div>
      {savedLine ? <p className="text-sm font-medium" role="status">{savedLine}</p> : null}

      <section className="rounded-3xl border border-line bg-card p-4 sm:p-5">
        <h2 className="font-serif text-2xl">Payment option</h2>
        <div className="mt-4 flex flex-wrap gap-2" role="radiogroup" aria-label="Listing type">
          <OfferChoice label="Buy now" selected={offer === "buy"} onSelect={() => setOffer("buy")} />
          <OfferChoice label="Digital file" selected={offer === "file"} onSelect={() => setOffer("file")} />
        </div>
        <div className="mt-4 space-y-3">
      {order.map((id) => {
        if (id === "stripe") {
          return (
            <StripeCard
              key={id}
              country={country}
              stripeReady={stripeReady}
              stripeStarted={stripeStarted}
              stripeMessage={stripeMessage}
              stripeReason={stripeReason}
            />
          );
        }
        if (id === "interac") {
          return <AccountFieldCard key={id} kind="interac" value={interac} venmo={venmo} zelle={zelle} />;
        }
        if (id === "venmo") {
          return <AccountFieldCard key={id} kind="venmo" value={venmo} interac={interac} zelle={zelle} />;
        }
        if (id === "zelle") {
          return <AccountFieldCard key={id} kind="zelle" value={zelle} interac={interac} venmo={venmo} />;
        }
        if (id === "cash") return <ListingMethodCard key={id} kind="cash" />;
        return <ListingMethodCard key={id} kind="paypal" offer={offer} />;
      })}
        </div>
      </section>

      <Link href="/start" className={`${ghostClass} ${focusClass} w-full sm:w-fit`}>Create a Twig</Link>

      <details className="rounded-2xl border border-line bg-card px-4 py-3">
        <summary className={`cursor-pointer font-medium ${focusClass}`}>Learn more</summary>
        <div className="mt-3 space-y-3 border-t border-line pt-3 text-sm leading-6 text-muted">
          {SELLER_PAYMENT_RESPONSIBILITY.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
        </div>
      </details>
    </div>
  );
}

function methodsFor(offer: "buy" | "file", canada: boolean): MethodId[] {
  if (offer === "file") return ["stripe", "paypalFile"];
  return canada ? ["interac", "cash", "paypalFile"] : ["venmo", "zelle", "cash", "paypalFile"];
}

function OfferChoice({ label, selected, onSelect }: { label: string; selected: boolean; onSelect: () => void }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className={`rounded-full px-4 py-2 text-sm font-medium ${focusClass} ${selected ? "bg-forest text-card" : "border border-line bg-white text-ink"}`}
    >
      {label}
    </button>
  );
}

function StripeCard({
  country,
  stripeReady,
  stripeStarted,
  stripeMessage,
  stripeReason,
}: {
  country: "CA" | "US";
  stripeReady: boolean;
  stripeStarted: boolean;
  stripeMessage: "" | "setup" | "error";
  stripeReason: string;
}) {
  const status = stripeReady ? "Connected" : stripeStarted ? "Setup not finished" : "Not connected";
  return (
    <section className="rounded-3xl border border-line bg-card p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-serif text-2xl">Credit / debit card</h2>
        <p className="text-sm font-medium">{status}</p>
      </div>
      <p className="mt-1 text-sm font-medium text-muted">Digital files only · Optional</p>
      <p className="mt-1 max-w-2xl text-sm leading-6 text-muted">Buyers pay by card. Payments go to your Stripe account.</p>
      {stripeMessage === "setup" ? <p className="mt-3 text-sm text-clay" role="status">Stripe is not set up on this server yet.</p> : null}
      {stripeMessage === "error" ? <p className="mt-3 text-sm text-clay" role="status">{stripeReason || "Stripe could not open the connection page."}</p> : null}
      {stripeReady ? null : (
        <form action={startStripeConnect} className="mt-4">
          <input type="hidden" name="country" value={country} />
          <SubmitButton label={stripeStarted ? "Continue Stripe setup" : "Connect Stripe"} pendingLabel="Opening Stripe…" />
        </form>
      )}
      <p className="mt-3 text-sm leading-6 text-muted">You can set this up later. Stripe processing fees apply.</p>
    </section>
  );
}

function AccountFieldCard({
  kind,
  value,
  interac = "",
  venmo = "",
  zelle = "",
}: {
  kind: "interac" | "venmo" | "zelle";
  value: string;
  interac?: string;
  venmo?: string;
  zelle?: string;
}) {
  const [editing, setEditing] = useState(!value);
  const copy = fieldCopy(kind);
  const showForm = editing || !value;

  return (
    <section className="rounded-3xl border border-line bg-card p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-serif text-2xl">{copy.title}</h2>
        <p className="text-sm font-medium">{value ? "Saved" : "Not set up"}</p>
      </div>
      <p className="mt-1 max-w-2xl text-sm leading-6 text-muted">{copy.scope}</p>
      {showForm ? (
        <form action={savePayoutDetails} className="mt-4 grid gap-3" noValidate>
          <input type="hidden" name="which" value={kind} />
          {kind === "interac" ? (
            <>
              <input type="hidden" name="venmo" value={venmo} />
              <input type="hidden" name="zelle" value={zelle} />
              <label>
                <span className={labelClass}>e-Transfer email</span>
                <input name="interac" type="email" defaultValue={value} placeholder="you@example.com" autoComplete="email" className={`${inputClass} ${focusClass}`} />
              </label>
            </>
          ) : null}
          {kind === "venmo" ? (
            <>
              <input type="hidden" name="interac" value={interac} />
              <input type="hidden" name="zelle" value={zelle} />
              <label>
                <span className={labelClass}>Venmo username</span>
                <input name="venmo" defaultValue={value} placeholder="username" autoComplete="off" className={`${inputClass} ${focusClass}`} />
              </label>
            </>
          ) : null}
          {kind === "zelle" ? (
            <>
              <input type="hidden" name="interac" value={interac} />
              <input type="hidden" name="venmo" value={venmo} />
              <label>
                <span className={labelClass}>Zelle email or phone</span>
                <input name="zelle" defaultValue={value} placeholder="you@example.com" autoComplete="off" className={`${inputClass} ${focusClass}`} />
              </label>
            </>
          ) : null}
          <SubmitButton label={copy.save} pendingLabel="Saving…" />
        </form>
      ) : (
        <div className="mt-4">
          <p className="text-sm font-medium">{value}</p>
          <button type="button" className={`${buttonClass} ${focusClass} mt-3 w-full sm:w-fit`} onClick={() => setEditing(true)}>Edit</button>
        </div>
      )}
      <p className="mt-3 text-sm leading-6 text-muted">{copy.limit}</p>
      <Link href="/dashboard/twigs" className={`mt-2 inline-block text-sm font-medium text-forest ${focusClass}`}>Set on each listing</Link>
    </section>
  );
}

function fieldCopy(kind: "interac" | "venmo" | "zelle") {
  if (kind === "interac") {
    return {
      title: "Interac e-Transfer",
      scope: "Buy-now listings in Canada. Buyers pay the e-Transfer email on each listing.",
      limit: "Saving here stores an email on your account. Checkout still uses the email on the Twig.",
      save: "Save email",
    };
  }
  if (kind === "venmo") {
    return {
      title: "Venmo",
      scope: "Buy-now listings in the United States. Buyers pay the Venmo username on each listing.",
      limit: "Saving here stores a username on your account. Checkout still uses the username on the Twig.",
      save: "Save username",
    };
  }
  return {
    title: "Zelle",
    scope: "Saved on your account for your records.",
    limit: "Buyer checkout does not offer Zelle. US listings use Venmo, PayPal, or cash set on each Twig.",
    save: "Save Zelle",
  };
}

function ListingMethodCard({ kind, offer = "buy" }: { kind: "cash" | "paypal"; offer?: "buy" | "file" }) {
  const paypal = kind === "paypal";
  const digitalPaypal = paypal && offer === "file";
  return (
    <section className="rounded-3xl border border-line bg-card p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-serif text-2xl">{paypal ? "PayPal" : "Cash"}</h2>
        <p className="text-sm font-medium">{digitalPaypal ? "Set on each digital listing" : "Set on each listing"}</p>
      </div>
      <p className="mt-1 max-w-2xl text-sm leading-6 text-muted">
        {digitalPaypal
          ? "Buyers pay the PayPal email on that Twig."
          : paypal
            ? "Buyers pay the PayPal link on that Twig."
            : "Buyers pay you in person, and you confirm the money."}
      </p>
      <Link href="/dashboard/twigs" className={`${buttonClass} ${focusClass} mt-4 w-full sm:w-fit`}>Manage Twigs</Link>
    </section>
  );
}

function SubmitButton({ label, pendingLabel }: { label: string; pendingLabel: string }) {
  const { pending } = useFormStatus();
  return (
    <button disabled={pending} className={`${buttonClass} ${focusClass} w-full sm:w-fit`}>
      {pending ? pendingLabel : label}
    </button>
  );
}
