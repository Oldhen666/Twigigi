import Link from "next/link";
import { requireSeller } from "@/lib/auth";
import { platformFee } from "@/lib/billing";
import { formatBillingDate } from "@/lib/billing-calendar";
import { isOpenFee, outstandingCents } from "@/lib/fee-collection";
import { listSellerBills } from "@/lib/db";

function chargeLabel(status: string, collectionStatus: string) {
  if (status === "paid") return "Paid";
  if (status === "void") return "Void";
  if (status === "failed" || collectionStatus === "failed") return "Failed";
  if (status === "processing" || collectionStatus === "processing" || collectionStatus === "unknown" || collectionStatus === "action_required") return "Processing";
  if (isOpenFee(status)) return "Unpaid";
  return status || "Unpaid";
}

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const user = await requireSeller();
  const bills = listSellerBills(user.id);
  const filter = params.status === "unpaid" || params.status === "paid" ? params.status : "all";
  const currency = params.currency === "USD" ? "USD" : params.currency === "CAD" ? "CAD" : "";
  const visible = bills.filter((bill) => {
    if (currency && bill.currency !== currency) return false;
    const label = chargeLabel(bill.status, bill.collectionStatus);
    if (filter === "paid") return label === "Paid";
    if (filter === "unpaid") return label === "Unpaid" || label === "Processing" || label === "Failed";
    return true;
  });
  const currencies = [...new Set(bills.map((bill) => bill.currency || "CAD"))];
  const totals = (currencies.length > 0 ? currencies : ["CAD"]).map((code) => ({
    currency: code,
    cents: outstandingCents(bills.map((bill) => ({ ...bill, collectionId: bill.collectionId })), code),
  }));

  return (
    <main className="page-frame pb-16">
      <h1 className="mt-6 font-serif text-4xl">Balance</h1>
      <p className="mt-2 max-w-prose text-sm leading-6 text-muted">Unpaid amounts are the balance. Paid and other charges stay in this list.</p>
      <div className="mt-4 flex flex-wrap gap-2 text-sm">
        {(["all", "unpaid", "paid"] as const).map((status) => (
          <Link
            key={status}
            href={`/dashboard/payments/balance?status=${status}${currency ? `&currency=${currency}` : ""}`}
            className={`rounded-full border px-3 py-1 ${filter === status ? "border-forest bg-moss" : "border-line bg-card"}`}
            aria-current={filter === status ? "page" : undefined}
          >
            {status === "all" ? "All" : status === "unpaid" ? "Unpaid" : "Paid"}
          </Link>
        ))}
      </div>
      <ul className="mt-4 space-y-1 text-sm">
        {totals.map((row) => (
          <li key={row.currency}>Balance {platformFee(row.cents, row.currency)}</li>
        ))}
      </ul>
      {visible.length === 0 ? <p className="mt-6 text-sm text-muted">No charges yet.</p> : (
        <ul className="mt-4 divide-y divide-line rounded-2xl border border-line bg-card px-4">
          {visible.map((bill) => {
            const label = chargeLabel(bill.status, bill.collectionStatus);
            const period = bill.kind === "quote"
              ? formatBillingDate(bill.createdAt) || bill.createdAt.slice(0, 10)
              : [formatBillingDate(bill.periodStart), formatBillingDate(bill.periodEnd)].filter(Boolean).join(" – ");
            return (
              <li key={bill.id} className="min-w-0 py-3 text-sm">
                <div className="flex flex-wrap items-baseline justify-between gap-3">
                  <p className="min-w-0 break-words font-medium">{bill.title}</p>
                  <p className="font-serif text-lg">{platformFee(bill.amountCents, bill.currency)}</p>
                </div>
                <p className="text-muted">{bill.kind === "quote" ? "Quote fee" : "Listing fee"} · {label}</p>
                <p className="break-words text-muted">{bill.kind === "quote" ? "Fee date" : "Service period"} {period || "—"}</p>
                <p className="text-muted">Due {formatBillingDate(bill.dueAt) || "—"}</p>
                {bill.paidAt ? <p className="text-muted">Paid {formatBillingDate(bill.paidAt)}</p> : null}
                {bill.collectionId ? <p className="break-all text-muted">Payment {bill.collectionId}</p> : null}
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}

export const metadata = { title: "Balance", robots: { index: false, follow: false } };
