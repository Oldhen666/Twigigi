import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { allMoneyOrders } from "@/lib/db";
import { formatMoney } from "@/lib/format";

export default async function Page() {
  await requireAdmin();
  const disputes = allMoneyOrders().filter((order) => order.disputeStatus === "open");
  return (
    <main className="mx-auto w-full max-w-5xl px-5 pb-16">
      <h1 className="font-serif text-4xl">Disputes</h1>
      <p className="mt-2 max-w-2xl text-sm text-muted">An open dispute keeps that seller&apos;s net in safeguarded funds. The payout does not start, and the original payment lines stay as they were.</p>
      {disputes.length === 0 ? (
        <p className="mt-6 text-sm text-muted">No open disputes.</p>
      ) : (
        <ul className="mt-6 space-y-3">
          {disputes.map((order) => (
            <li key={order.id} className="rounded-2xl border border-line bg-card px-4 py-3 text-sm">
              <div className="flex items-baseline justify-between gap-3">
                <Link href={`/admin/payments/${order.id}`} className="font-medium text-forest">{order.publicRef}</Link>
                <span>{formatMoney(order.sellerNetCents, order.currency)}</span>
              </div>
              <p className="mt-1 text-muted">{order.sellerName}&apos;s money · Safeguarded funds · Held until the dispute closes</p>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
