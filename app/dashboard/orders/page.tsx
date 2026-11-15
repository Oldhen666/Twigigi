import Link from "next/link";
import { SellerOrders } from "@/components/seller-orders";
import { requireSeller } from "@/lib/auth";
import { listOrders } from "@/lib/db";
import { formatDate, formatMoney, orderHeading } from "@/lib/format";
import { orderStage, sellerAttention, sellerBulkActions } from "@/lib/order-flow";

function bulkNotice(bulk: string | string[] | undefined, skipped: string | string[] | undefined) {
  if (typeof bulk !== "string") return "";
  const updated = Number(bulk);
  const left = Number(typeof skipped === "string" ? skipped : "0");
  if (!Number.isInteger(updated) || updated < 0 || !Number.isInteger(left) || left < 0) return "";
  if (updated === 0) return left > 0 ? "No orders were changed. The action does not apply to the selection." : "";
  const changed = updated === 1 ? "Updated 1 order." : `Updated ${updated} orders.`;
  return left > 0 ? `${changed} ${left === 1 ? "1 was" : `${left} were`} left unchanged.` : changed;
}

async function OrdersScreen({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const notice = bulkNotice(params.bulk, params.skipped);
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
    actions: sellerBulkActions(order),
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
          {notice ? <p className="mt-3 text-sm" role="status">{notice}</p> : null}
          <SellerOrders orders={rows} />
        </>
      )}
    </main>
  );
}

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <OrdersScreen searchParams={searchParams} />;
}

export const metadata = { title: "Orders", robots: { index: false, follow: false } };
