import { Suspense } from "react";
import { AccountFrame } from "@/components/account-frame";
import { BuyerOrders } from "@/components/buyer-orders";
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
      <BuyerOrders
        orders={orders.map((order) => {
          const interaction = ensure(order.id, "order", order.productId, order.sellerId, order.email || user.email);
          const stage = orderStage(order);
          const canReview = fulfillmentDone(order.fulfillmentState);
          const allowConfirm = canReview && !order.buyerReceivedAt;
          return {
            id: order.id,
            publicRef: order.publicRef,
            heading: orderHeading(order),
            quantity: order.quantity,
            fulfillment: order.fulfillment,
            amount: formatMoney(order.amountCents, order.currency),
            amountCents: order.amountCents,
            stage,
            when: formatDate(order.createdAt),
            createdAt: order.createdAt,
            fileSent: order.fulfillment === "digital" && stage === "File sent",
            needsYou: allowConfirm || (canReview && interaction ? !reviewed.has(interaction.id) : false),
            interaction: interaction
              ? {
                  id: interaction.id,
                  publicRef: interaction.publicRef,
                  buyerConfirmedAt: interaction.buyerConfirmedAt,
                  sellerConfirmedAt: interaction.sellerConfirmedAt,
                }
              : null,
            allowConfirm,
            confirmLabel: order.fulfillment === "digital" ? "Confirm file access" : "Confirm item received",
            reviewTitle: orderHeading(order),
            reviewed: interaction ? reviewed.has(interaction.id) : false,
            canReview,
          };
        })}
        quotes={quotes.map((quote) => ({
          id: quote.id,
          title: quote.productTitle,
          quantity: quote.quantity,
          when: formatDate(quote.createdAt),
          createdAt: quote.createdAt,
          replied: Boolean(quote.offerSentAt),
          closed: quote.status === "closed",
        }))}
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
