import Link from "next/link";
import { Suspense } from "react";
import { AccountFrame } from "@/components/account-frame";
import { InteractionLine } from "@/components/interaction-line";
import { requireUser } from "@/lib/auth";
import { listBuyerInteractions, listBuyerOrders } from "@/lib/db";
import { formatDate, formatMoney } from "@/lib/format";

async function OrdersScreen() {
  const user = await requireUser();
  const orders = listBuyerOrders(user.id);
  const interactions = listBuyerInteractions(user.id, user.email);
  const bySource = new Map(interactions.map((item) => [item.sourceId, item]));
  const quotes = interactions.filter((item) => item.kind === "quote");
  return (
    <AccountFrame section="orders" title="Your orders" lede={user.email}>
      {orders.length === 0 && quotes.length === 0 ? (
        <p className="mt-8 text-sm text-muted">Orders and quote requests placed with this account show up here.</p>
      ) : null}
      {orders.length > 0 ? (
        <ul className="mt-8 space-y-3">
          {orders.map((order) => {
            const interaction = bySource.get(order.id);
            return (
              <li key={order.id} className="rounded-2xl border border-line bg-card p-4">
                <Link href={`/order/${order.id}`} className="font-medium">{order.publicRef || order.productTitle}</Link>
                <p className="text-sm text-muted">{order.productTitle} · {order.quantity} · {order.fulfillment}</p>
                <p className="mt-1">{formatMoney(order.amountCents, order.currency)}</p>
                <p className="text-sm text-muted">{order.status} · {formatDate(order.createdAt)}</p>
                {interaction ? <InteractionLine item={interaction} nextPath="/orders" side="buyer" /> : null}
              </li>
            );
          })}
        </ul>
      ) : null}
      {quotes.length > 0 ? (
        <section className="mt-10">
          <h2 className="font-serif text-2xl">Quotes</h2>
          <ul className="mt-3 space-y-3">
            {quotes.map((item) => (
              <li key={item.id} className="rounded-2xl border border-line bg-card p-4">
                <Link href={`/quote/${item.sourceId}`} className="font-medium">{item.publicRef}</Link>
                <p className="text-sm text-muted">{item.productTitle} · {item.sellerName}</p>
                <InteractionLine item={item} nextPath="/orders" side="buyer" />
              </li>
            ))}
          </ul>
        </section>
      ) : null}
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
