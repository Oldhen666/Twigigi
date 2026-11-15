"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import { openStripePayout, savePayoutDetails, startStripeConnect } from "@/lib/actions";
import { buttonClass, ghostClass, inputClass, labelClass } from "@/components/ui";
import { readPayoutSaved, type SavedField } from "@/lib/payments";

export type PayoutCatalog = {
  hasProducts: boolean;
  hasFile: boolean;
  hasBuy: boolean;
  hasQuote: boolean;
};

type MethodId = "stripe" | "interac" | "venmo" | "zelle" | "paypalFile";

const focusClass = "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest";

export function ReceivePayments({
  stripeReady,
  stripeStarted,
  stripeMessage,
  stripeReason = "",
  interac,
  venmo,
  zelle,
  paypalMe,
  paypalEmail,
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
  paypalMe: string;
  paypalEmail: string;
  initialCountry: "CA" | "US";
  catalog: PayoutCatalog;
  saved?: SavedField;
}) {
  const [country, setCountry] = useState<"CA" | "US">(initialCountry);
  const [offer, setOffer] = useState<"buy" | "file">(catalog.hasFile && !catalog.hasBuy ? "file" : "buy");
  const canada = country === "CA";
  const order = methodsFor(offer, canada);
  const savedLine = payoutSavedLine(saved, { interac, venmo, zelle, paypalMe, paypalEmail });

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
        <h2 className="font-serif text-2xl">Payment methods by Twig type</h2>
        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-base" role="radiogroup" aria-label="Listing type">
          <OfferChoice label="Buy now Twigs" selected={offer === "buy"} onSelect={() => setOffer("buy")} />
          <span className="text-muted" aria-hidden="true">|</span>
          <OfferChoice label="Digital file Twigs" selected={offer === "file"} onSelect={() => setOffer("file")} />
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
        if (id === "interac") return <AccountFieldCard key={id} kind="interac" value={interac} />;
        if (id === "venmo") return <AccountFieldCard key={id} kind="venmo" value={venmo} />;
        if (id === "zelle") return <AccountFieldCard key={id} kind="zelle" value={zelle} />;
        return <AccountFieldCard key={id} kind={offer === "file" ? "paypal-file" : "paypal"} value={offer === "file" ? paypalEmail : paypalMe} />;
      })}
        </div>
      </section>

      <section className="rounded-2xl border border-line bg-card px-4 py-4">
        <h2 className="text-sm font-medium text-ink">Payment responsibilities</h2>
        <ul className="mt-3 grid gap-3 sm:grid-cols-3">
          <li>
            <p className="text-sm font-medium text-ink">Payment details</p>
            <p className="mt-1 text-sm leading-5 text-muted">Keep your payment information accurate and use only accounts you’re authorized to manage.</p>
          </li>
          <li>
            <p className="text-sm font-medium text-ink">Payment confirmation</p>
            <p className="mt-1 text-sm leading-5 text-muted">For e-Transfer, Venmo, PayPal.Me, and cash, mark the order paid only after you have the money. Stripe and PayPal confirm digital-file payments.</p>
          </li>
          <li>
            <p className="text-sm font-medium text-ink">Direct payments</p>
            <p className="mt-1 text-sm leading-5 text-muted">Buyers pay you directly. Twigigi does not receive or hold these funds.</p>
          </li>
        </ul>
        <Link href="/legal/terms?from=payments#payments" className={`${focusClass} mt-3 inline-block text-sm text-muted underline decoration-1 underline-offset-4`}>
          View payment terms →
        </Link>
      </section>
    </div>
  );
}

function payoutSavedLine(saved: SavedField, values: { interac: string; venmo: string; zelle: string; paypalMe: string; paypalEmail: string }) {
  if (saved === "interac-invalid" || saved === "paypal-file-invalid") return "Enter an email like name@email.com.";
  if (saved === "venmo-invalid") return "Enter a Venmo username like johnsmith.";
  if (saved === "paypal-invalid") return "Use a PayPal.Me link like https://paypal.me/yourname.";
  if (saved === "interac-setting") return values.interac ? "e-Transfer email saved for new Twigs." : "Saved e-Transfer email removed.";
  if (saved === "interac") return values.interac ? "e-Transfer email saved and updated on your Canadian Buy now Twigs." : "e-Transfer email removed from your Canadian Buy now Twigs.";
  if (saved === "venmo-setting") return values.venmo ? "Venmo username saved for new Twigs." : "Saved Venmo username removed.";
  if (saved === "venmo") return values.venmo ? "Venmo username saved and updated on your US Buy now Twigs." : "Venmo username removed from your US Buy now Twigs.";
  if (saved === "paypal-setting") return values.paypalMe ? "PayPal.Me link saved for new Twigs." : "Saved PayPal.Me link removed.";
  if (saved === "paypal") return values.paypalMe ? "PayPal.Me link saved and updated on your Buy now Twigs." : "PayPal.Me link removed from your Buy now Twigs.";
  if (saved === "paypal-file-setting") return values.paypalEmail ? "PayPal email saved for new digital file Twigs." : "Saved PayPal email removed.";
  if (saved === "paypal-file") return values.paypalEmail ? "PayPal email saved and updated on your digital file Twigs." : "PayPal email removed from your digital file Twigs.";
  if (saved === "zelle") return values.zelle ? "Zelle details saved." : "Zelle details removed.";
  return "";
}

function methodsFor(offer: "buy" | "file", canada: boolean): MethodId[] {
  if (offer === "file") return ["stripe", "paypalFile"];
  return canada ? ["interac", "paypalFile"] : ["venmo", "zelle", "paypalFile"];
}

function OfferChoice({ label, selected, onSelect }: { label: string; selected: boolean; onSelect: () => void }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className={`${focusClass} rounded-sm ${selected ? "font-medium text-ink underline decoration-2 underline-offset-4" : "text-muted"}`}
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
      {stripeMessage === "setup" ? <p className="mt-3 text-sm text-clay" role="status">Stripe is not set up on this server yet.</p> : null}
      {stripeMessage === "error" ? <p className="mt-3 text-sm text-clay" role="status">{stripeReason || "Stripe could not open the connection page."}</p> : null}
      {stripeReady ? (
        <form action={openStripePayout} className="mt-4">
          <SubmitButton label="Change payout card" pendingLabel="Opening Stripe…" />
        </form>
      ) : (
        <form action={startStripeConnect} className="mt-4">
          <input type="hidden" name="country" value={country} />
          <SubmitButton label={stripeStarted ? "Continue Stripe setup" : "Connect Stripe"} pendingLabel="Opening Stripe…" />
        </form>
      )}
    </section>
  );
}

function AccountFieldCard({ kind, value }: { kind: "interac" | "venmo" | "zelle" | "paypal" | "paypal-file"; value: string }) {
  const [editing, setEditing] = useState(!value);
  const copy = fieldCopy(kind);
  const showForm = editing || !value;

  return (
    <section className="rounded-3xl border border-line bg-card p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-serif text-2xl">{copy.title}</h2>
        <p className="text-sm font-medium">{value ? "Saved" : "Not set up"}</p>
      </div>
      {showForm ? (
        <form action={savePayoutDetails} className="mt-4 grid gap-3" noValidate>
          <input type="hidden" name="which" value={kind} />
          {kind === "interac" ? (
            <label>
              <span className={labelClass}>e-Transfer email</span>
              <input name="interac" type="email" defaultValue={value} placeholder="you@example.com" autoComplete="email" className={`${inputClass} ${focusClass}`} />
            </label>
          ) : null}
          {kind === "venmo" ? (
            <label>
              <span className={labelClass}>Venmo username</span>
              <input name="venmo" defaultValue={value} placeholder="username" autoComplete="off" className={`${inputClass} ${focusClass}`} />
            </label>
          ) : null}
          {kind === "zelle" ? (
            <label>
              <span className={labelClass}>Zelle email or phone</span>
              <input name="zelle" defaultValue={value} placeholder="you@example.com" autoComplete="off" className={`${inputClass} ${focusClass}`} />
            </label>
          ) : null}
          {kind === "paypal" ? (
            <div>
              <div className="mb-1.5 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <label htmlFor="payout-paypal-me" className="text-sm font-medium">PayPal.Me link</label>
                <a href="https://www.paypal.com/paypalme/" target="_blank" rel="noreferrer" className={`${focusClass} text-sm text-forest underline-offset-2 hover:underline`}>
                  Did not have a paypal.me?
                </a>
              </div>
              <input id="payout-paypal-me" name="paypal" defaultValue={value} placeholder="https://paypal.me/yourname" inputMode="url" autoComplete="off" className={`${inputClass} ${focusClass}`} />
            </div>
          ) : null}
          {kind === "paypal-file" ? (
            <label>
              <span className={labelClass}>PayPal email</span>
              <input name="paypalEmail" type="email" defaultValue={value} placeholder="name@email.com" autoComplete="off" className={`${inputClass} ${focusClass}`} />
            </label>
          ) : null}
          {copy.apply ? (
            <IntentButton intent="save" label="Save this setting" pendingLabel="Saving…" tone="solid" />
          ) : (
            <SubmitButton label={copy.save} pendingLabel="Saving…" />
          )}
        </form>
      ) : (
        <div className="mt-4">
          <p className="text-sm font-medium">{value}</p>
          <div className="mt-3 flex flex-wrap gap-3">
            <button type="button" className={`${buttonClass} ${focusClass} w-full sm:w-fit`} onClick={() => setEditing(true)}>Edit</button>
            {copy.apply && kind !== "zelle" ? (
              <form action={savePayoutDetails} className="contents">
                <input type="hidden" name="which" value={kind} />
                <input type="hidden" name={payoutInputName(kind)} value={value} />
                <IntentButton intent="apply" label="Update to all applicable listings" pendingLabel="Updating…" tone="solid" />
              </form>
            ) : null}
          </div>
        </div>
      )}
    </section>
  );
}

function payoutInputName(kind: "interac" | "venmo" | "paypal" | "paypal-file") {
  if (kind === "interac") return "interac";
  if (kind === "venmo") return "venmo";
  if (kind === "paypal") return "paypal";
  return "paypalEmail";
}

function fieldCopy(kind: "interac" | "venmo" | "zelle" | "paypal" | "paypal-file") {
  if (kind === "interac") {
    return {
      title: "Interac e-Transfer",
      save: "",
      apply: true,
    };
  }
  if (kind === "venmo") {
    return {
      title: "Venmo",
      save: "",
      apply: true,
    };
  }
  if (kind === "paypal") {
    return {
      title: "PayPal",
      save: "",
      apply: true,
    };
  }
  if (kind === "paypal-file") {
    return {
      title: "PayPal",
      save: "",
      apply: true,
    };
  }
  return {
    title: "Zelle",
    save: "Save Zelle",
    apply: false,
  };
}

function SubmitButton({ label, pendingLabel }: { label: string; pendingLabel: string }) {
  const { pending } = useFormStatus();
  return (
    <button disabled={pending} className={`${buttonClass} ${focusClass} w-full sm:w-fit`}>
      {pending ? pendingLabel : label}
    </button>
  );
}

function IntentButton({ intent, label, pendingLabel, tone }: { intent: "save" | "apply"; label: string; pendingLabel: string; tone: "solid" | "ghost" }) {
  const { pending, data } = useFormStatus();
  const active = pending && data?.get("intent") === intent;
  return (
    <button name="intent" value={intent} disabled={pending} className={`${tone === "ghost" ? ghostClass : buttonClass} ${focusClass} w-full sm:w-fit disabled:opacity-60`}>
      {active ? pendingLabel : label}
    </button>
  );
}
