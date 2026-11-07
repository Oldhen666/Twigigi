import Link from "next/link";
import { Suspense } from "react";
import { requireSeller } from "@/lib/auth";
import { listOrders } from "@/lib/db";
import { formatDate, formatMoney, orderHeading } from "@/lib/format";
import { orderStage, sellerAttention } from "@/lib/order-flow";
import type { OrderRecord } from "@/lib/types";

async function OrdersScreen() {
  const user = await requireSeller();
  const orders = listOrders(user.id);
  const needs = orders.filter((order) => sellerAttention(order));
  const rest = orders.filter((order) => !sellerAttention(order));
  return (
    <main className="page-frame pb-16">
      <h1 className="mt-6 font-serif text-4xl">Orders</h1>
      <p className="mt-2 text-sm text-muted">
        {needs.length === 0 ? "Nothing needs you right now." : needs.length === 1 ? "1 order needs you." : `${needs.length} orders need you.`}
      </p>
      {orders.length === 0 ? (
        <p className="mt-8 text-sm text-muted">No orders yet.</p>
      ) : (
        <>
          {needs.length > 0 ? (
            <section className="mt-6">
              <h2 className="text-sm font-medium">Needs you</h2>
              <ul className="mt-3 space-y-3">
                {needs.map((order) => <OrderRow key={order.id} order={order} attention={sellerAttention(order)} />)}
              </ul>
            </section>
          ) : null}
          {rest.length > 0 ? (
            <section className="mt-6">
              {needs.length > 0 ? <h2 className="text-sm font-medium">All other orders</h2> : null}
              <ul className={needs.length > 0 ? "mt-3 space-y-3" : "mt-6 space-y-3"}>
                {rest.map((order) => <OrderRow key={order.id} order={order} attention="" />)}
              </ul>
            </section>
          ) : null}
        </>
      )}
    </main>
  );
}

function OrderRow({ order, attention }: { order: OrderRecord; attention: string }) {
  return (
    <li>
      <Link href={`/dashboard/orders/${order.id}`} className="block rounded-2xl border border-line bg-card p-4 text-sm">
        <p className="font-medium">{order.publicRef || order.buyerName}</p>
        <p className="text-muted">{orderHeading(order)}{order.lines.length <= 1 && order.variantLabel ? ` · ${order.variantLabel}` : ""} · {order.buyerName}</p>
        <p className="mt-1">{formatMoney(order.amountCents, order.currency)} · {orderStage(order)}</p>
        {attention ? <p className="mt-1 font-medium text-forest">{attention}</p> : null}
        <p className="text-muted">{formatDate(order.createdAt, order.productLocation)}</p>
      </Link>
    </li>
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
