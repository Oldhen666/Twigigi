import Link from "next/link";
import { Suspense } from "react";
import { AccountFrame } from "@/components/account-frame";
import { InteractionLine } from "@/components/interaction-line";
import { ReviewSeller } from "@/components/review-seller";
import { requireUser } from "@/lib/auth";
import { claimBuyerOrders, getInteraction, getProductById, listBuyerInteractions, listBuyerOrders, listBuyerQuotes, listUserReviews, openInteraction } from "@/lib/db";
import { formatDate, formatMoney } from "@/lib/format";

async function OrdersScreen() {
  const user = await requireUser();
  claimBuyerOrders(user.id, user.email);
  const orders = listBuyerOrders(user.id, user.email);
  const quotes = listBuyerQuotes(user.email);
  const interactions = listBuyerInteractions(user.id, user.email);
  const bySource = new Map(interactions.map((item) => [item.sourceId, item]));
  const reviewed = new Set(listUserReviews(user.id).map((review) => review.interactionId));

  const ensure = (
    sourceId: string,
    kind: "order" | "quote",
    productId: string,
    sellerId: string,
    email: string,
  ) => {
    const existing = bySource.get(sourceId);
    if (existing) return existing;
    const opened = openInteraction({
      kind,
      sourceId,
      productId,
      sellerId,
      buyerId: user.id,
      buyerEmail: email,
    });
    const created = getInteraction(opened.id);
    if (created) bySource.set(sourceId, created);
    return created;
  };

  return (
    <AccountFrame title="Your orders">
      {orders.length === 0 && quotes.length === 0 ? (
        <p className="mt-8 text-sm text-muted">No order record</p>
      ) : null}
      {orders.length > 0 ? (
        <ul className="mt-8 space-y-3">
          {orders.map((order) => {
            const interaction = ensure(order.id, "order", order.productId, order.sellerId, order.email || user.email);
            return (
              <li key={order.id} className="rounded-2xl border border-line bg-card p-4">
                <Link href={`/order/${order.id}`} className="font-medium">{order.publicRef || order.productTitle}</Link>
                <p className="text-sm text-muted">{order.productTitle} · {order.quantity} · {order.fulfillment}</p>
                <p className="mt-1">{formatMoney(order.amountCents, order.currency)}</p>
                <p className="text-sm text-muted">{order.status} · {formatDate(order.createdAt)}</p>
                {interaction ? <InteractionLine item={interaction} nextPath="/orders" side="buyer" showReview={false} /> : null}
                {interaction ? (
                  <ReviewSeller
                    interactionId={interaction.id}
                    kind="order"
                    productTitle={order.productTitle}
                    reviewed={reviewed.has(interaction.id)}
                  />
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : null}
      {quotes.length > 0 ? (
        <section className="mt-10">
          <h2 className="font-serif text-2xl">Quotes</h2>
          <ul className="mt-3 space-y-3">
            {quotes.map((quote) => {
              const product = getProductById(quote.productId);
              const interaction = product
                ? ensure(quote.id, "quote", quote.productId, product.userId, quote.email || user.email)
                : bySource.get(quote.id) ?? null;
              return (
                <li key={quote.id} className="rounded-2xl border border-line bg-card p-4">
                  <Link href={`/quote/${quote.id}`} className="font-medium">{quote.productTitle}</Link>
                  <p className="text-sm text-muted">qty {quote.quantity} · {quote.status} · {formatDate(quote.createdAt)}</p>
                  {interaction ? <InteractionLine item={interaction} nextPath="/orders" side="buyer" showReview={false} /> : null}
                  {interaction ? (
                    <ReviewSeller
                      interactionId={interaction.id}
                      kind="quote"
                      productTitle={quote.productTitle}
                      reviewed={reviewed.has(interaction.id)}
                    />
                  ) : null}
                </li>
              );
            })}
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
