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
      <p className="mt-2 text-sm text-muted">
        {needs === 0 ? "Nothing needs you right now." : needs === 1 ? "1 order needs you." : `${needs} orders need you.`}
      </p>
      {orders.length === 0 ? <p className="mt-8 text-sm text-muted">No orders yet.</p> : <SellerOrders orders={rows} />}
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
