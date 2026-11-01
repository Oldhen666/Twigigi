import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { listMarketplaceOrders } from "@/lib/db";
import { formatMoney } from "@/lib/format";
import { orderIsPaid, paymentConfirmationLabel } from "@/lib/order-money";

export default async function Page() {
  await requireAdmin();
  const orders = listMarketplaceOrders();
  return (
    <main className="mx-auto w-full max-w-5xl px-5 pb-16">
      <h1 className="font-serif text-4xl">Payments</h1>
      <p className="mt-2 max-w-2xl text-sm text-muted">These are sales between a buyer and a seller. Twigigi does not receive the order total.</p>
      {orders.length === 0 ? (
        <p className="mt-6 text-sm text-muted">No orders yet.</p>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-3xl border border-line bg-card">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-4 py-3 font-medium">Order</th>
                <th className="px-4 py-3 font-medium">Order total</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Recipient</th>
                <th className="px-4 py-3 font-medium">Confirmation</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => {
                const paid = orderIsPaid(order.status, order.paymentStatus);
                const total = order.totalCents > 0 ? order.totalCents : order.amountCents;
                return (
                  <tr key={order.id} className="border-t border-line">
                    <td className="px-4 py-3">
                      <Link href={`/admin/payments/${order.id}`} className="font-medium text-forest">{order.publicRef}</Link>
                      <p className="text-muted">{order.buyerName}</p>
                    </td>
                    <td className="px-4 py-3">{formatMoney(total, order.currency)} {order.currency}</td>
                    <td className="px-4 py-3">{order.status === "canceled" ? "Canceled" : paid ? "Paid" : "Unpaid"}</td>
                    <td className="px-4 py-3">{order.paymentFlow === "seller_direct" ? "Seller directly" : "Twigigi Checkout"}</td>
                    <td className="px-4 py-3">{paymentConfirmationLabel(order.paymentFlow, paid && order.status !== "canceled")}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
