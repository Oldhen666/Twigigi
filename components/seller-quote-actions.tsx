"use client";

import { useActionState, useEffect, useState } from "react";
import { closeQuoteRequest, markQuoteContacted, sendSellerQuote } from "@/lib/actions";
import { formatMoney } from "@/lib/format";
import type { FormState } from "@/lib/types";
import { buttonClass, ghostClass, inputClass, labelClass } from "@/components/ui";

export function SellerQuoteActions({
  quoteId,
  status,
  currency,
  offer,
}: {
  quoteId: string;
  status: "new" | "contacted" | "closed";
  currency: string;
  offer: { kind: "fixed" | "estimate"; cents: number; scope: string; note: string; timeline: string; validDays: number } | null;
}) {
  const [open, setOpen] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);
  const [kind, setKind] = useState<"fixed" | "estimate">(offer?.kind ?? "fixed");
  const [amount, setAmount] = useState(offer ? (offer.cents / 100).toFixed(2) : "");
  const [scope, setScope] = useState(offer?.scope ?? "");
  const [timeline, setTimeline] = useState(offer?.timeline ?? "");
  const [note, setNote] = useState(offer?.note ?? "");
  const [days, setDays] = useState(offer?.validDays || 30);
  const [state, send, sending] = useActionState(sendSellerQuote, {} as FormState);
  const [contactState, markContacted, marking] = useActionState(markQuoteContacted, {} as FormState);
  const [closeState, closeRequest, closing] = useActionState(closeQuoteRequest, {} as FormState);

  useEffect(() => {
    const next = state.next || contactState.next || closeState.next;
    if (next) window.location.assign(next);
  }, [state.next, contactState.next, closeState.next]);

  const cents = moneyCents(amount);
  const preview = cents == null ? null : formatMoney(cents, currency);

  return (
    <div className="mt-6 border-t border-line pt-5">
      <h3 className="text-sm font-medium">Next action</h3>
      {open ? (
        <form action={send} className="mt-3 space-y-4">
          <input type="hidden" name="id" value={quoteId} />
          <fieldset className="space-y-2">
            <legend className={labelClass}>Quote type</legend>
            {(["fixed", "estimate"] as const).map((option) => (
              <label key={option} className="mr-4 inline-flex items-center gap-2 text-sm">
                <input type="radio" name="quoteKind" value={option} checked={kind === option} onChange={() => setKind(option)} className="accent-forest" />
                {option === "fixed" ? "Fixed price" : "Estimate"}
              </label>
            ))}
            {state.fieldErrors?.quoteKind ? <p className="text-sm text-danger">{state.fieldErrors.quoteKind}</p> : null}
          </fieldset>
          <label className="block">
            <span className={labelClass}>Amount ({currency})</span>
            <input name="amount" inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} className={inputClass} placeholder="0.00" />
            {state.fieldErrors?.amount ? <p className="mt-1 text-sm text-danger">{state.fieldErrors.amount}</p> : null}
          </label>
          <label className="block">
            <span className={labelClass}>Scope of work</span>
            <textarea name="scope" value={scope} onChange={(event) => setScope(event.target.value)} rows={4} maxLength={2000} className={`${inputClass} h-auto py-3`} placeholder="What this price includes." />
            {state.fieldErrors?.scope ? <p className="mt-1 text-sm text-danger">{state.fieldErrors.scope}</p> : null}
          </label>
          <label className="block">
            <span className={labelClass}>Time to complete <span className="font-normal text-muted">optional</span></span>
            <input name="timeline" value={timeline} onChange={(event) => setTimeline(event.target.value)} maxLength={80} className={inputClass} placeholder="3 days, 1 week" />
          </label>
          <label className="block">
            <span className={labelClass}>Note for the buyer <span className="font-normal text-muted">optional</span></span>
            <textarea name="note" value={note} onChange={(event) => setNote(event.target.value)} rows={3} maxLength={1000} className={`${inputClass} h-auto py-3`} placeholder="Anything you want the buyer to know." />
          </label>
          <fieldset className="space-y-2">
            <legend className={labelClass}>Quote valid for</legend>
            {[7, 14, 30].map((option) => (
              <label key={option} className="flex items-center gap-2 text-sm">
                <input type="radio" name="validDays" value={option} checked={days === option} onChange={() => setDays(option)} className="accent-forest" />
                {option} days
              </label>
            ))}
            {state.fieldErrors?.validDays ? <p className="text-sm text-danger">{state.fieldErrors.validDays}</p> : null}
          </fieldset>
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted">Quote preview</p>
            <p className="mt-1 font-serif text-3xl">{preview ?? `${currency} —`}</p>
            <p className="mt-1 text-sm text-muted">{kind === "fixed" ? "Fixed price" : "Estimated price"} · Valid for {days} days{timeline.trim() ? ` · ${timeline.trim()}` : ""}</p>
            {note.trim() ? <p className="mt-2 text-sm">{note.trim()}</p> : null}
          </div>
          {state.error ? <p className="text-sm text-danger">{state.error}</p> : null}
          <button disabled={sending} className={`${buttonClass} w-full`}>{sending ? "Sending…" : "Send quote"}</button>
          <button type="button" onClick={() => setOpen(false)} className={`${ghostClass} w-full`}>Cancel</button>
        </form>
      ) : (
        <button type="button" onClick={() => setOpen(true)} className={`${buttonClass} mt-3 h-auto w-full flex-col gap-0.5 py-3`}>
          <span>Create quote</span>
          <span className="text-xs font-normal text-card/80">Send a price and scope of work to the buyer</span>
        </button>
      )}

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {status === "closed" ? (
          <p className={`${ghostClass} text-muted`}>Request closed</p>
        ) : status === "contacted" ? (
          <p className={`${ghostClass} text-muted`}>Marked as contacted</p>
        ) : (
          <form action={markContacted}>
            <input type="hidden" name="id" value={quoteId} />
            <button disabled={marking} className={`${ghostClass} w-full`}>{marking ? "Saving…" : "Mark as contacted"}</button>
            {contactState.error ? <p className="mt-1 text-sm text-danger">{contactState.error}</p> : null}
          </form>
        )}
        {status === "closed" ? null : confirmClose ? (
          <form action={closeRequest} className="rounded-2xl border border-line bg-white p-3">
            <input type="hidden" name="id" value={quoteId} />
            <p className="text-sm">Close this request? The quote stays on file.</p>
            <div className="mt-2 flex gap-2">
              <button disabled={closing} className={`${buttonClass} h-10 flex-1 px-3 text-sm`}>{closing ? "Closing…" : "Close request"}</button>
              <button type="button" onClick={() => setConfirmClose(false)} className={`${ghostClass} h-10 flex-1 px-3 text-sm`}>Cancel</button>
            </div>
            {closeState.error ? <p className="mt-1 text-sm text-danger">{closeState.error}</p> : null}
          </form>
        ) : (
          <button type="button" onClick={() => setConfirmClose(true)} className={`${ghostClass} w-full`}>Close request</button>
        )}
      </div>
    </div>
  );
}

function moneyCents(value: string) {
  const match = value.trim().match(/^(\d{1,7})(?:\.(\d{1,2}))?$/);
  if (!match) return null;
  const cents = Number(match[1]) * 100 + Number((match[2] ?? "").padEnd(2, "0"));
  return cents > 0 ? cents : null;
}
