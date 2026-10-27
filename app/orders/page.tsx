import Link from "next/link";
import { Suspense } from "react";
import { AccountFrame } from "@/components/account-frame";
import { requireUser } from "@/lib/auth";
import { listBuyerOrders } from "@/lib/db";
import { formatDate, formatMoney } from "@/lib/format";

async function OrdersScreen() {
  const user = await requireUser();
  const orders = listBuyerOrders(user.id);
  return (
    <AccountFrame title="Your orders" lede={user.email}>
      {orders.length === 0 ? (
        <p className="mt-8 text-sm text-muted">Orders you place while signed in, or with this email, show up here.</p>
      ) : (
        <ul className="mt-8 space-y-3">
          {orders.map((order) => (
            <li key={order.id}>
              <Link href={`/order/${order.id}`} className="block rounded-2xl border border-line bg-card p-4">
                <p className="font-medium">{order.publicRef || order.productTitle}</p>
                <p className="text-sm text-muted">{order.productTitle} · {order.quantity} · {order.fulfillment}</p>
                <p className="mt-1">{formatMoney(order.amountCents, order.currency)}</p>
                <p className="text-sm text-muted">{order.status} · {formatDate(order.createdAt)}</p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </AccountFrame>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<p className="p-8 text-muted">Loading your orders…</p>}>
      <OrdersScreen />
    </Suspense>
  );
}

export const metadata = { title: "Your orders", robots: { index: false, follow: false } };
