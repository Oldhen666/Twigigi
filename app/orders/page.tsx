import Link from "next/link";
import { Suspense } from "react";
import { AccountFrame } from "@/components/account-frame";
import { BuyerRecordSwitch } from "@/components/buyer-record-switch";
import { BuyerSection } from "@/components/buyer-section";
import { InteractionLine } from "@/components/interaction-line";
import { ReviewSeller } from "@/components/review-seller";
import { requireUser } from "@/lib/auth";
import { claimBuyerOrders, getInteraction, listBuyerInteractions, listBuyerOrders, listBuyerQuotes, listUserReviews, openInteraction } from "@/lib/db";
import { formatDate, formatMoney, orderHeading } from "@/lib/format";
import { fulfillmentDone, orderStage } from "@/lib/order-flow";

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
    <AccountFrame title="Your orders/quotes">
      <BuyerRecordSwitch
        orders={
      <BuyerSection title="Orders" center={orders.length === 0}>
      {orders.length === 0 ? (
        <p className="text-sm text-muted">No order record</p>
      ) : (
        <ul className="space-y-3">
          {orders.map((order) => {
            const interaction = ensure(order.id, "order", order.productId, order.sellerId, order.email || user.email);
            return (
              <li key={order.id} className="rounded-2xl border border-line bg-card p-4">
                <Link href={`/order/${order.id}`} className="font-medium">{order.publicRef || order.productTitle}</Link>
                <p className="text-sm text-muted">{orderHeading(order)} · {order.quantity} · {order.fulfillment}</p>
                <p className="mt-1">{formatMoney(order.amountCents, order.currency)}</p>
                <p className="text-sm text-muted">{orderStage(order)} · {formatDate(order.createdAt)}</p>
                {interaction ? (
                  <InteractionLine
                    item={interaction}
                    nextPath="/orders"
                    side="buyer"
                    showReview={false}
                    allowConfirm={fulfillmentDone(order.fulfillmentState) && !order.buyerReceivedAt}
                    confirmLabel="Confirm item received"
                  />
                ) : null}
                {interaction ? (
                  <ReviewSeller
                    interactionId={interaction.id}
                    kind="order"
                    productTitle={orderHeading(order)}
                    reviewed={reviewed.has(interaction.id)}
                    enabled={fulfillmentDone(order.fulfillmentState)}
                  />
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
      </BuyerSection>
        }
        quotes={
      <BuyerSection title="Quotes" center={quotes.length === 0}>
      {quotes.length === 0 ? (
        <p className="text-sm text-muted">No quote record</p>
      ) : (
          <ul className="space-y-3">
            {quotes.map((quote) => (
                <li key={quote.id} className="rounded-2xl border border-line bg-card p-4">
                  <p className="font-medium">{quote.productTitle}</p>
                  <p className="text-sm text-muted">qty {quote.quantity} · {formatDate(quote.createdAt)}</p>
                  {quote.offerSentAt ? (
                    <Link href={`/quote/${quote.id}`} className="mt-3 inline-flex text-sm font-medium text-forest">View estimate</Link>
                  ) : null}
                </li>
              ))}
          </ul>
      )}
      </BuyerSection>
        }
      />
    </AccountFrame>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<p className="p-8 text-muted">Loading…</p>}>
      <OrdersScreen />
    </Suspense>
  );
}

export const metadata = { title: "Your orders/quotes", robots: { index: false, follow: false } };
