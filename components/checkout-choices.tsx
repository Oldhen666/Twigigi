"use client";

import { PickupCalendar } from "@/components/pickup-calendar";
import { formatMoney } from "@/lib/format";
import { methodLabel, paypalMeUrl, safeCardUrl, safeEmail, safePhone, safeVenmo } from "@/lib/payments";
import { buttonClass } from "@/components/ui";

export function PickupFacts({
  location,
  schedules,
  summary,
  selectedTime,
  onTime,
  error = "",
}: {
  location: string;
  schedules: string[];
  summary: string[];
  selectedTime: string;
  onTime: (value: string) => void;
  error?: string;
}) {
  return (
    <div className="mt-2 space-y-3 pl-6 text-sm" onClick={(event) => event.stopPropagation()}>
      <p>
        <span className="block text-xs font-medium uppercase tracking-[0.14em] text-muted">Pickup location</span>
        <span className="mt-1 block">{location || "The seller has not added a pickup location."}</span>
      </p>
      <PickupCalendar schedules={schedules} summary={summary} selectedTime={selectedTime} onTime={onTime} error={error} />
    </div>
  );
}

export function PayChoice({
  methods,
  selected,
  onSelect,
  cardPaymentUrl = "",
  interacEmail = "",
  interacQuestion = "",
  interacPassword = "",
  venmoUsername = "",
  paypalMe = "",
  amountCents = 0,
  currency = "CAD",
  zelleMode = "phone",
  zelleContact = "",
  error = "",
  empty = "",
  showPayLink = true,
}: {
  methods: string[];
  selected: string;
  onSelect: (id: string) => void;
  cardPaymentUrl?: string;
  interacEmail?: string;
  interacQuestion?: string;
  interacPassword?: string;
  venmoUsername?: string;
  paypalMe?: string;
  amountCents?: number;
  currency?: string;
  zelleMode?: "phone" | "email";
  zelleContact?: string;
  error?: string;
  empty?: string;
  showPayLink?: boolean;
}) {
  if (methods.length === 0) return empty ? <p className="text-sm text-danger">{empty}</p> : null;
  const email = selected === "interac" ? safeEmail(interacEmail) : "";
  const venmo = selected === "venmo" ? safeVenmo(venmoUsername) : "";
  const paypal = selected === "paypal" ? paypalMeUrl(paypalMe, { amountCents, currency }) : "";
  const zelle = selected === "zelle" ? (zelleMode === "email" ? safeEmail(zelleContact) : safePhone(zelleContact)) : "";
  const card = selected === "card" ? safeCardUrl(cardPaymentUrl) : "";
  return (
    <fieldset>
      <legend className="mb-1.5 block text-sm font-medium text-ink">How will you pay?</legend>
      <div className="space-y-2">
        {methods.map((id) => (
          <label key={id} className={`block rounded-2xl border px-4 py-3 ${selected === id ? "border-forest bg-moss" : "border-line"}`}>
            <input type="radio" name="paymentMethod" value={id} checked={selected === id} onChange={() => onSelect(id)} className="mr-2" />
            <span className="font-medium">{methodLabel(id)}</span>
          </label>
        ))}
      </div>
      {error ? <p className="mt-1 text-sm text-danger">{error}</p> : null}
      {email ? <p className="mt-3 text-sm text-muted">e-Transfer instructions arrive after the seller confirms the order.</p> : null}
      {venmo ? <p className="mt-3 text-sm">Venmo: @{venmo}</p> : null}
      {showPayLink && selected === "paypal" ? (
        paypal ? (
          <a href={paypal} target="_blank" rel="noreferrer" className={`${buttonClass} mt-3 w-full`}>
            Pay {formatMoney(amountCents, currency)} with PayPal
          </a>
        ) : (
          <p className="mt-3 text-sm text-muted">The seller has not added a PayPal.Me link.</p>
        )
      ) : null}
      {zelle ? (
        <p className="mt-3 text-sm">
          Zelle:{" "}
          {zelleMode === "email" ? (
            <a className="break-all text-forest" href={`mailto:${zelle}`}>{zelle}</a>
          ) : (
            <a className="text-forest" href={`tel:${zelle.replace(/\D/g, "")}`}>{zelle}</a>
          )}
        </p>
      ) : null}
      {selected === "cash" ? <p className="mt-3 text-sm text-muted">Pay the seller in cash when you pick it up.</p> : null}
      {card ? (
        <a href={card} target="_blank" rel="noreferrer" className={`${buttonClass} mt-3 w-full`}>
          Pay by card
        </a>
      ) : null}
    </fieldset>
  );
}
