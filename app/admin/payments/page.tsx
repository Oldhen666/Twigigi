import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { allMoneyOrders } from "@/lib/db";
import { formatDay, formatMoney } from "@/lib/format";
import { ACCOUNT_LABEL, BUCKET_LABEL } from "@/lib/ledger";

export default async function Page() {
  await requireAdmin();
  const orders = allMoneyOrders();
  return (
    <main className="mx-auto w-full max-w-5xl px-5 pb-16">
      <h1 className="font-serif text-4xl">Payments</h1>
      <p className="mt-2 max-w-2xl text-sm text-muted">Every paid order answers whose money it is, which order it belongs to, where it sits, and when it should leave.</p>
      {orders.length === 0 ? (
        <p className="mt-6 text-sm text-muted">No paid orders yet.</p>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-3xl border border-line bg-card">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-4 py-3 font-medium">Order</th>
                <th className="px-4 py-3 font-medium">Whose money</th>
                <th className="px-4 py-3 font-medium">Seller net</th>
                <th className="px-4 py-3 font-medium">Where</th>
                <th className="px-4 py-3 font-medium">When it leaves</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr key={order.id} className="border-t border-line">
                  <td className="px-4 py-3">
                    <Link href={`/admin/payments/${order.id}`} className="font-medium text-forest">{order.publicRef}</Link>
                    <p className="text-muted">{order.buyerName}</p>
                  </td>
                  <td className="px-4 py-3">{order.sellerName}</td>
                  <td className="px-4 py-3">{formatMoney(order.sellerNetCents, order.currency)}</td>
                  <td className="px-4 py-3">{order.bucket === "protected" || order.bucket === "available" ? ACCOUNT_LABEL.safeguarded : BUCKET_LABEL[order.bucket]}</td>
                  <td className="px-4 py-3">{order.bucket === "available" ? "Eligible now" : order.payoutEligibleAt ? formatDay(order.payoutEligibleAt) : "Not set"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
