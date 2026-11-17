"use client";

import { useState } from "react";
import { PickupCalendar } from "@/components/pickup-calendar";
import { formatPickupChoice } from "@/lib/pickup";

export function PickupAgreementReminder({ place, agreed = false }: { place: string; agreed?: boolean }) {
  return (
    <div className="rounded-2xl bg-paper-deep px-3 py-3 leading-6">
      <p>{agreed ? "This pickup time and location are confirmed." : "Once you agree, confirm the pickup time and location."}</p>
      <p className="mt-1">{place ? `Location: ${place}` : "This Twig does not have a pickup address yet."}</p>
      {agreed ? null : <p className="mt-1 text-muted">The location comes from the listing. It is filled in when the time is confirmed.</p>}
    </div>
  );
}

export function PickupOfferBuilder({
  schedules,
  summary,
}: {
  schedules: string[];
  summary: string[];
}) {
  const [draft, setDraft] = useState("");
  const [times, setTimes] = useState<string[]>([]);
  return (
    <div className="space-y-3">
      <PickupCalendar schedules={schedules} summary={summary} selectedTime={draft} onTime={setDraft} emptyMessage="Add pickup days on the product first." />
      <button
        type="button"
        onClick={() => {
          if (!draft || times.includes(draft) || times.length >= 6) return;
          setTimes((current) => [...current, draft]);
          setDraft("");
        }}
        className="text-sm font-medium text-forest"
      >
        Add this time
      </button>
      {times.length > 0 ? (
        <ul className="space-y-2">
          {times.map((time) => (
            <li key={time} className="flex items-center justify-between gap-3 rounded-2xl border border-line px-3 py-2">
              <span>{formatPickupChoice(time)}</span>
              <input type="hidden" name="pickupTimes" value={time} />
              <button type="button" onClick={() => setTimes((current) => current.filter((item) => item !== time))} className="text-sm text-danger">Remove</button>
            </li>
          ))}
        </ul>
      ) : <p className="text-muted">Add one or more times for the buyer to choose from.</p>}
      <label className="block">
        <span className="text-xs font-medium uppercase tracking-[0.14em] text-muted">Note for the buyer</span>
        <textarea name="note" rows={3} maxLength={500} placeholder="Optional" className="mt-1 w-full rounded-2xl border border-line bg-white px-3 py-2" />
      </label>
    </div>
  );
}

export function AnotherPickupTime({
  schedules,
  summary,
}: {
  schedules: string[];
  summary: string[];
}) {
  const [selected, setSelected] = useState("");
  return (
    <div className="space-y-3">
      <PickupCalendar schedules={schedules} summary={summary} selectedTime={selected} onTime={setSelected} />
      <label className="block">
        <span className="text-xs font-medium uppercase tracking-[0.14em] text-muted">Note for the seller</span>
        <textarea name="note" rows={3} maxLength={500} placeholder="Optional" className="mt-1 w-full rounded-2xl border border-line bg-white px-3 py-2" />
      </label>
    </div>
  );
}
