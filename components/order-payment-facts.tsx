import { formatMoney } from "@/lib/format";
import { cardLinkProvider, orderIsPaid, orderPaymentMethodLabel, paymentFlowOf } from "@/lib/order-money";
import type { OrderRecord } from "@/lib/types";

export function OrderPaymentFacts({ order, cardPaymentUrl = "" }: { order: OrderRecord; cardPaymentUrl?: string }) {
  const flow = paymentFlowOf(order.paymentFlow);
  const paid = orderIsPaid(order.status, order.paymentStatus);
  const provider = order.buyerPayment === "card" ? cardLinkProvider(cardPaymentUrl) : "";
  const total = order.totalCents > 0 ? order.totalCents : order.amountCents;
  const status = order.status === "canceled" ? "Canceled" : paid ? "Paid" : "Unpaid";
  const rows = [
    ["Order total", `${formatMoney(total, order.currency)} ${order.currency}`],
    ["Payment method", orderPaymentMethodLabel(order.buyerPayment)],
    ...(provider ? [["Payment provider", provider]] : []),
    ["Payment status", status],
    ["Payment recipient", flow === "seller_direct" ? "Seller directly" : "Twigigi Checkout"],
    ...(flow === "seller_direct" ? [["Payout", "Not applicable — payment received directly by seller"]] : []),
  ];
  return (
    <dl className="mt-4 space-y-2 text-sm">
      {rows.map(([label, value]) => (
        <div key={label} className="flex flex-wrap justify-between gap-x-4 gap-y-1">
          <dt className="text-muted">{label}</dt>
          <dd className="text-right">{value}</dd>
        </div>
      ))}
    </dl>
  );
}
