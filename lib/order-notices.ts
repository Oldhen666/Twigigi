import { appUrl, formatMoney } from "@/lib/format";
import { sendOrderEmail } from "@/lib/mail";
import { methodLabel, paypalMeUrl, safeEmail } from "@/lib/payments";
import { paymentNeedsConfirm, shipsToBuyer } from "@/lib/order-flow";
import type { OrderRecord } from "@/lib/types";

export async function notifyBuyer(order: OrderRecord, subject: string, lines: Array<string | null>) {
  const text = [...lines, "", `Open the order: ${appUrl()}/order/${order.id}`].filter((line): line is string => line !== null).join("\n");
  return sendOrderEmail(order.email, { subject, text });
}

export function acceptNote(order: OrderRecord, interacEmail = "", paypalMe = "") {
  const total = formatMoney(order.totalCents || order.amountCents, order.currency);
  const method = order.buyerPayment ? methodLabel(order.buyerPayment) : "";
  const lines = [
    `${order.displayName} confirmed order ${order.publicRef || ""}.`.replace(/\s+\./, "."),
    `Total: ${total}`,
    method ? `Payment: ${method}` : null,
  ];
  if (!order.buyerPayment && order.fulfillment !== "digital") {
    lines.push("Choose how to pay on the order page. It lists the ways this seller accepts, such as PayPal, e-Transfer, or cash.");
    lines.push("After you pay, mark it paid there so the seller can prepare the order.");
    return lines;
  }
  const email = order.buyerPayment === "interac" ? safeEmail(interacEmail) : "";
  if (email || (order.buyerPayment === "interac" && (order.interacQuestion || order.interacPassword))) {
    lines.push("e-Transfer instructions:");
    if (email) lines.push(`Send it to: ${email}`);
    if (order.interacQuestion) lines.push(`Security question: ${order.interacQuestion}`);
    if (order.interacPassword) lines.push(`Password: ${order.interacPassword}`);
  }
  const paypal = order.buyerPayment === "paypal" ? paypalMeUrl(paypalMe, { amountCents: order.totalCents || order.amountCents, currency: order.currency }) : "";
  if (paypal) lines.push(`PayPal: ${paypal}`);
  if (!paymentNeedsConfirm(order.buyerPayment)) {
    lines.push("Pay in cash when you pick it up. The seller will email you when it is ready.");
  } else if (order.paymentStatus !== "paid") {
    lines.push("Pay the seller directly if you have not yet. They confirm the payment on their side.");
  }
  return lines;
}

export function readyNote(order: OrderRecord, place: string) {
  if (order.fulfillmentState === "ready") {
    return [
      `Order ${order.publicRef || order.productTitle} is ready for pickup.`,
      place ? `Pickup location: ${place}` : null,
      order.buyerPayment === "cash" ? "Pay the seller in cash when you pick it up." : null,
    ];
  }
  if (order.fulfillment === "digital") {
    return [`The file for ${order.productTitle} was sent to this email.`];
  }
  return [
    `Order ${order.publicRef || order.productTitle} has been sent out for delivery.`,
    order.shipCarrier ? `Carrier: ${order.shipCarrier}` : null,
    order.shipTracking ? `Tracking number: ${order.shipTracking}` : null,
    shipsToBuyer(order.fulfillment) && order.address ? `Address: ${order.address}` : null,
  ];
}
