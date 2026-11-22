import Link from "next/link";
import { platformFee } from "@/lib/billing";
import { formatBillingDate } from "@/lib/billing-calendar";
import type { FollowupFeeLine } from "@/lib/quote-followup-store";

function actionLabel(kind: FollowupFeeLine["kind"]) {
  if (kind === "visit") return "Site visit invitation";
  if (kind === "invoice") return "Invoice";
  return "Quote";
}

function statusLabel(line: FollowupFeeLine) {
  if (!line.hasBill) return "Not on a bill yet";
  if (line.billStatus === "paid") return "Paid";
  if (line.billStatus === "void") return "Void";
  if (line.billStatus === "processing") return "Processing";
  return "On the next bill";
}

function inquiryLabel(line: FollowupFeeLine) {
  return line.customerName || line.title || "Inquiry";
}

export function FollowupFeeLines({ lines }: { lines: FollowupFeeLine[] }) {
  const waiting = lines.filter((line) => line.hasBill && line.billStatus !== "paid" && line.billStatus !== "void");
  const totals = new Map<string, number>();
  for (const line of waiting) totals.set(line.currency, (totals.get(line.currency) || 0) + line.amountCents);

  return (
    <section>
      <h3 className="font-serif text-xl">Follow-up fees</h3>
      <p className="mt-1 text-[13px] leading-5 text-muted">
        {waiting.length > 0
          ? `${[...totals.entries()].map(([currency, cents]) => platformFee(cents, currency)).join(", ")} waiting for the next bill.`
          : "No follow-up fee is waiting for the next bill."}
        {" "}Receiving an inquiry, saving a draft, or contacting the customer yourself does not add this fee.
      </p>
      {lines.length === 0 ? null : (
        <ul className="mt-3 space-y-2">
          {lines.map((line) => (
            <li key={`${line.quoteId}-${line.billId}`} className="min-w-0 rounded-xl border border-line bg-paper px-4 py-3">
              <div className="flex items-start justify-between gap-3">
                <p className="min-w-0 break-words text-[15px] font-medium">{inquiryLabel(line)}</p>
                <p className="shrink-0 font-sans text-[15px] font-semibold tabular-nums">{platformFee(line.amountCents, line.currency)}</p>
              </div>
              <p className="mt-1 text-[13px] leading-5 text-muted">{actionLabel(line.kind)} · Sent {formatBillingDate(line.sentAt) || "—"} · {statusLabel(line)}</p>
              {line.hasBill && line.billId ? (
                <Link href={`/dashboard/payments/balance?currency=${line.currency === "USD" ? "USD" : "CAD"}#${line.billId}`} className="mt-2 inline-flex text-[13px] text-forest underline decoration-1 underline-offset-2">
                  View bill
                </Link>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
