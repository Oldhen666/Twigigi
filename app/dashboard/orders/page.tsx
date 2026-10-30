import Link from "next/link";
import { Suspense } from "react";
import { requireSeller } from "@/lib/auth";
import { listOrders } from "@/lib/db";
import { formatDate, formatMoney } from "@/lib/format";

async function OrdersScreen() {
  const user = await requireSeller();
  const orders = listOrders(user.id);
  return (
    <main className="page-frame pb-16">
      <h1 className="font-serif text-4xl">Orders</h1>
      {orders.length === 0 ? (
        <p className="mt-8 text-sm text-muted">No order record</p>
      ) : (
        <ul className="mt-8 space-y-3">
          {orders.map((order) => (
            <li key={order.id}>
              <Link href={`/dashboard/orders/${order.id}`} className="block rounded-2xl border border-line bg-card p-4 text-sm">
                <p className="font-medium">{order.publicRef || order.buyerName}</p>
                <p className="text-muted">{order.productTitle}{order.variantLabel ? ` · ${order.variantLabel}` : ""} · {order.buyerName}</p>
                <p className="mt-1">{formatMoney(order.amountCents, order.currency)} · {order.status}</p>
                <p className="text-muted">{formatDate(order.createdAt)}</p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<p className="px-5 text-muted">Loading orders…</p>}>
      <OrdersScreen />
    </Suspense>
  );
}

export const metadata = { title: "Orders", robots: { index: false, follow: false } };
