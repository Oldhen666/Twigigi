"use client";

import { methodLabel, safeCardUrl, safeEmail, safePhone, safeVenmo } from "@/lib/payments";
import { buttonClass } from "@/components/ui";

export function PickupFacts({
  location,
  times,
  selectedTime,
  onTime,
}: {
  location: string;
  times: string[];
  selectedTime: string;
  onTime: (value: string) => void;
}) {
  return (
    <div className="mt-2 space-y-3 pl-6 text-sm">
      <p>
        <span className="block text-xs font-medium uppercase tracking-[0.14em] text-muted">Pickup location</span>
        <span className="mt-1 block">{location || "The seller has not added a pickup location."}</span>
      </p>
      <div>
        <span className="block text-xs font-medium uppercase tracking-[0.14em] text-muted">Pickup time</span>
        {times.length > 1 ? (
          <div className="mt-1 space-y-1">
            {times.map((time) => (
              <label key={time} className="flex items-start gap-2">
                <input
                  type="radio"
                  name="pickupTime"
                  value={time}
                  checked={selectedTime === time}
                  onChange={() => onTime(time)}
                  className="mt-1"
                />
                <span>{time}</span>
              </label>
            ))}
          </div>
        ) : (
          <>
            <span className="mt-1 block">{times[0] || "The seller has not added a pickup time."}</span>
            <input type="hidden" name="pickupTime" value={times[0] ?? ""} />
          </>
        )}
      </div>
    </div>
  );
}

export function PayChoice({
  methods,
  selected,
  onSelect,
  cardPaymentUrl = "",
  interacEmail = "",
  venmoUsername = "",
  zelleMode = "phone",
  zelleContact = "",
  error = "",
  empty = "",
}: {
  methods: string[];
  selected: string;
  onSelect: (id: string) => void;
  cardPaymentUrl?: string;
  interacEmail?: string;
  venmoUsername?: string;
  zelleMode?: "phone" | "email";
  zelleContact?: string;
  error?: string;
  empty?: string;
}) {
  if (methods.length === 0) return empty ? <p className="text-sm text-danger">{empty}</p> : null;
  const email = selected === "interac" ? safeEmail(interacEmail) : "";
  const venmo = selected === "venmo" ? safeVenmo(venmoUsername) : "";
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
      {email ? <p className="mt-3 text-sm">Interac e-Transfer: <a className="break-all text-forest" href={`mailto:${email}`}>{email}</a></p> : null}
      {venmo ? <p className="mt-3 text-sm">Venmo: @{venmo}</p> : null}
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
