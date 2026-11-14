"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { beginBillingSetup, setAutomaticPayment } from "@/lib/actions";
import { buttonClass } from "@/components/ui";

const focusClass = "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest";
const RENEWAL_TERMS = "Twigigi may charge this card when a listing renews, including unpaid quote fees in the same currency, without you being present. The settlement date stays on the 15th or the 28th chosen at the first paid publish.";

export function BillingMethodForm({
  saved,
  ready,
  notice,
  autoRenew,
  autoPay,
  cardLabel,
  chargesOn,
}: {
  saved: "" | "card" | "paypal" | "stripe";
  ready: boolean;
  notice: string;
  autoRenew: boolean;
  autoPay: boolean;
  cardLabel: string;
  chargesOn: boolean;
}) {
  const [method, setMethod] = useState<"card" | "paypal">(saved === "paypal" ? "paypal" : "card");
  const cardSaved = Boolean(cardLabel) || (ready && (saved === "card" || saved === "stripe"));
  const paypalSelected = method === "paypal" || saved === "paypal";
  const switchOn = autoPay && autoRenew && chargesOn && saved !== "paypal";
  const blocked = paypalSelected
    ? "Not available for PayPal."
    : !chargesOn
      ? "Automatic charging is not available yet."
      : !cardSaved || !autoRenew
        ? "Save a card before this can be turned on."
        : "";
  const canToggle = switchOn || !blocked;
  const switchLabel = switchOn ? "On" : canToggle ? "Off" : "Unavailable";

  return (
    <section className="min-w-0 overflow-x-clip rounded-2xl border border-line bg-card px-4 py-4 shadow-none sm:px-6 sm:py-6">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-serif text-2xl">Payment method</h2>
        <span className="max-w-[60%] truncate rounded-full bg-paper-deep px-2.5 py-0.5 text-[13px] font-normal text-ink">{cardSaved ? cardLabel || "Card saved" : "Not added"}</span>
      </div>
      {notice ? <p className="mt-3 break-words text-[13px] leading-5 text-clay" role="status">{notice}</p> : null}
      <form action={beginBillingSetup} className="mt-4 grid min-w-0 gap-3">
        <fieldset className="min-w-0">
          <legend className="sr-only">Payment method</legend>
          <div className="grid gap-3 sm:grid-cols-2">
            <MethodChoice
              name="Credit or debit card"
              detail="Save a card for future payments."
              value="card"
              checked={method === "card"}
              onSelect={() => setMethod("card")}
            />
            <MethodChoice
              name="PayPal"
              detail="Manual payments only."
              value="paypal"
              checked={method === "paypal"}
              onSelect={() => setMethod("paypal")}
            />
          </div>
        </fieldset>
        {method === "card" ? <RenewalConsent sentence="I authorize Twigigi to charge this card for listing renewals and unpaid quote fees in the same currency." /> : null}
        <SubmitButton
          label={method === "paypal" ? "Continue with PayPal" : cardSaved ? "Change" : "Add card"}
          pendingLabel={method === "paypal" ? "Opening PayPal…" : "Opening Stripe…"}
        />
        {method === "card" ? <p className="text-[13px] leading-5 text-muted">Adding a card does not charge you now.</p> : null}
      </form>
      <form action={setAutomaticPayment} className="mt-4 border-t border-line pt-4">
        <div className="flex items-center justify-between gap-3">
          <p className="text-[15px] font-medium">Automatic payment</p>
          <div className="flex items-center gap-2">
            <span className="text-[13px] font-medium text-ink">{switchLabel}</span>
            <input type="hidden" name="enabled" value={switchOn ? "0" : "1"} />
            <button
              type="submit"
              role="switch"
              aria-checked={switchOn}
              disabled={!canToggle}
              className={`${focusClass} relative h-7 w-12 shrink-0 rounded-full border border-line ${switchOn ? "bg-forest" : "bg-paper"} disabled:cursor-not-allowed`}
            >
              <span className={`absolute top-0.5 h-5 w-5 rounded-full border border-line bg-card ${switchOn ? "left-6" : "left-0.5"}`} />
              <span className="sr-only">{switchLabel}</span>
            </button>
          </div>
        </div>
        <p className="mt-1 line-clamp-1 text-[13px] leading-5 text-muted">Automatically pay your balance on its billing date.</p>
        {!switchOn && blocked ? <p className="mt-1 line-clamp-1 text-[13px] leading-5 text-muted">{blocked}</p> : null}
        {!switchOn && !blocked ? <div className="mt-3"><RenewalConsent sentence="I authorize Twigigi to charge this card for listing renewals and unpaid quote fees in the same currency." /></div> : null}
      </form>
    </section>
  );
}

function MethodChoice({
  name,
  detail,
  value,
  checked,
  onSelect,
}: {
  name: string;
  detail: string;
  value: "card" | "paypal";
  checked: boolean;
  onSelect: () => void;
}) {
  return (
    <label className={`flex min-w-0 cursor-pointer items-start gap-3 rounded-2xl border px-3 py-3 shadow-none ${checked ? "border-forest bg-moss" : "border-line bg-card"}`}>
      <input type="radio" name="method" value={value} checked={checked} onChange={onSelect} className={`mt-0.5 shrink-0 accent-forest ${focusClass}`} />
      <span className="min-w-0">
        <span className="block break-words text-[15px] font-medium leading-5">{name}</span>
        <span className="mt-0.5 block break-words text-[13px] leading-5 text-muted">{detail}</span>
      </span>
    </label>
  );
}

function RenewalConsent({ sentence }: { sentence: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="min-w-0">
      <label className="flex min-w-0 cursor-pointer items-start gap-3">
        <input type="checkbox" name="consent" value="yes" required className={`mt-0.5 shrink-0 accent-forest ${focusClass}`} />
        <span className="min-w-0 break-words text-[14px] leading-5">
          {sentence}{" "}
          <button type="button" aria-expanded={open} onClick={(event) => { event.preventDefault(); event.stopPropagation(); setOpen((value) => !value); }} className={`text-[13px] text-muted underline decoration-1 underline-offset-2 ${focusClass}`}>
            View renewal terms
          </button>
        </span>
      </label>
      {open ? <p className="mt-1 min-w-0 break-words pl-7 text-[13px] leading-5 text-muted">{RENEWAL_TERMS}</p> : null}
    </div>
  );
}

function SubmitButton({ label, pendingLabel }: { label: string; pendingLabel: string }) {
  const { pending } = useFormStatus();
  return (
    <button disabled={pending} className={`${buttonClass} ${focusClass} w-full sm:w-fit`}>
      <span className="grid">
        <span className={`col-start-1 row-start-1 ${pending ? "invisible" : ""}`}>{label}</span>
        <span className={`col-start-1 row-start-1 ${pending ? "" : "invisible"}`}>{pendingLabel}</span>
      </span>
    </button>
  );
}
