import Link from "next/link";
import { AdminListTools } from "@/components/admin-list-tools";
import { emptyListMessage, includesText, pick, queryValue, sortRows } from "@/lib/admin-list";
import { requireAdmin } from "@/lib/auth";
import { listMarketplaceOrders } from "@/lib/db";
import { formatMoney } from "@/lib/format";
import { orderIsPaid, paymentConfirmationLabel } from "@/lib/order-money";

const STATUSES = ["", "paid", "unpaid", "canceled"] as const;
const RECIPIENTS = ["", "seller", "twigigi"] as const;
const SORTS = ["newest", "oldest", "amount-desc", "amount-asc"] as const;

function paymentState(status: string, paymentStatus: string) {
  if (status === "canceled") return "canceled";
  return orderIsPaid(status, paymentStatus) ? "paid" : "unpaid";
}

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireAdmin();
  const query = await searchParams;
  const q = queryValue(query.q);
  const status = pick(queryValue(query.status), STATUSES);
  const recipient = pick(queryValue(query.recipient), RECIPIENTS);
  const sort = pick(queryValue(query.sort), SORTS, "newest");
  const all = listMarketplaceOrders();
  const orders = sortRows(
    all.filter((order) => {
      if (status && paymentState(order.status, order.paymentStatus) !== status) return false;
      if (recipient === "seller" && order.paymentFlow !== "seller_direct") return false;
      if (recipient === "twigigi" && order.paymentFlow === "seller_direct") return false;
      const total = order.totalCents > 0 ? order.totalCents : order.amountCents;
      return includesText(q, [order.publicRef, order.buyerName, order.productTitle, order.displayName, formatMoney(total, order.currency)]);
    }),
    (order) => (sort.startsWith("amount") ? (order.totalCents > 0 ? order.totalCents : order.amountCents) : order.createdAt),
    sort === "oldest" || sort === "amount-asc" ? "asc" : "desc",
  );
  const empty = emptyListMessage(orders.length, all.length, "No orders yet.");
  return (
    <main className="mx-auto w-full max-w-5xl px-5 pb-16">
      <h1 className="font-serif text-4xl">Payments</h1>
      <p className="mt-2 max-w-2xl text-sm text-muted">These are sales between a buyer and a seller. Twigigi does not receive the order total.</p>
      <AdminListTools
        path="/admin/payments"
        q={q}
        shown={orders.length}
        total={all.length}
        sort={sort}
        sorts={[
          { value: "newest", label: "Newest" },
          { value: "oldest", label: "Oldest" },
          { value: "amount-desc", label: "Highest total" },
          { value: "amount-asc", label: "Lowest total" },
        ]}
        filters={[
          { name: "status", label: "Status", value: status, options: [{ value: "", label: "Any status" }, { value: "paid", label: "Paid" }, { value: "unpaid", label: "Unpaid" }, { value: "canceled", label: "Canceled" }] },
          { name: "recipient", label: "Recipient", value: recipient, options: [{ value: "", label: "Any recipient" }, { value: "seller", label: "Seller directly" }, { value: "twigigi", label: "Twigigi Checkout" }] },
        ]}
      />
      {empty ? <p className="mt-6 text-sm text-muted">{empty}</p> : null}
      {orders.length === 0 ? null : (
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
                    <td className="px-4 py-3">{formatMoney(total, order.currency)}</td>
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
