import Link from "next/link";
import { Suspense } from "react";
import { SellerOrders } from "@/components/seller-orders";
import { requireSeller } from "@/lib/auth";
import { listOrders } from "@/lib/db";
import { formatDate, formatMoney, orderHeading } from "@/lib/format";
import { orderStage, sellerAttention } from "@/lib/order-flow";

async function OrdersScreen() {
  const user = await requireSeller();
  const orders = listOrders(user.id);
  const needs = orders.filter((order) => sellerAttention(order)).length;
  const rows = orders.map((order) => ({
    id: order.id,
    publicRef: order.publicRef || order.buyerName,
    heading: `${orderHeading(order)}${order.lines.length <= 1 && order.variantLabel ? ` · ${order.variantLabel}` : ""}`,
    buyerName: order.buyerName,
    amount: formatMoney(order.amountCents, order.currency),
    amountCents: order.amountCents,
    stage: orderStage(order),
    attention: sellerAttention(order),
    when: formatDate(order.createdAt, order.productLocation),
    createdAt: order.createdAt,
  }));
  return (
    <main className="page-frame pb-16">
      <h1 className="mt-6 font-serif text-4xl">Orders</h1>
      {orders.length === 0 ? (
        <div className="mt-6 max-w-xl rounded-3xl border border-dashed border-line bg-card p-6">
          <h2 className="font-serif text-2xl">No orders yet</h2>
          <p className="mt-2 max-w-prose text-sm leading-6 text-muted">When a buyer places an order, it shows up here.</p>
          <Link href="/dashboard/twigs" className="mt-4 inline-flex h-11 items-center rounded-full bg-forest px-5 text-sm text-card focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest">View Twigs</Link>
        </div>
      ) : (
        <>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
            {needs === 0 ? "You have orders, and nothing needs you right now." : needs === 1 ? "1 order needs you." : `${needs} orders need you.`}
          </p>
          <SellerOrders orders={rows} />
        </>
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
