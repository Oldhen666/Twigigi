import { isCashMethod } from "@/lib/payments";

export const ORDER_COMPLETE_DAYS = 30;

export type ReviewState = "requested" | "accepted" | "changes" | "declined";
export type FulfillmentState = "" | "ready" | "sent";

export function paymentNeedsConfirm(method: string) {
  return !isCashMethod(method);
}

export function fulfillmentDone(state: string) {
  return state === "ready" || state === "sent";
}

export function shipsToBuyer(fulfillment: string) {
  return fulfillment === "delivery" || fulfillment === "shipping";
}

type StageOrder = {
  status: string;
  reviewState: ReviewState;
  fulfillment: string;
  fulfillmentState: string;
  paymentStatus: string;
  buyerPayment: string;
  buyerReceivedAt: string | null;
  readyAt: string | null;
  fileSentAt: string | null;
};

export function orderCanComplete(order: StageOrder, now = Date.now()) {
  if (order.status === "fulfilled" || order.status === "canceled" || order.reviewState === "declined") return false;
  if (order.reviewState !== "accepted") return false;
  if (!fulfillmentDone(order.fulfillmentState)) return false;
  if (order.buyerReceivedAt) return true;
  if (!order.readyAt) return false;
  const ready = Date.parse(order.readyAt);
  return Number.isFinite(ready) && now - ready >= ORDER_COMPLETE_DAYS * 24 * 60 * 60 * 1000;
}

export function orderStage(order: StageOrder) {
  if (order.status === "canceled" || order.reviewState === "declined") return "Declined";
  if (order.status === "fulfilled") return "Completed";
  if (order.reviewState === "changes") return "Changes proposed";
  if (order.reviewState !== "accepted") return "Awaiting seller";
  if (paymentNeedsConfirm(order.buyerPayment) && order.paymentStatus !== "paid" && order.status !== "paid") return "Awaiting payment";
  if (!fulfillmentDone(order.fulfillmentState)) {
    if (order.fulfillment === "digital") return "Awaiting file";
    if (shipsToBuyer(order.fulfillment)) return "Awaiting delivery";
    return "Awaiting pickup";
  }
  if (!order.buyerReceivedAt) return "Awaiting buyer";
  return "Ready to complete";
}

export function buyerOrderCopy(order: StageOrder & { displayName: string }) {
  const digital = order.fulfillment === "digital";
  if (order.status === "canceled" || order.reviewState === "declined") {
    return {
      title: "Order canceled",
      badge: "Canceled",
      intro: `${order.displayName} declined this order.`,
      next: [] as string[],
    };
  }
  if (order.status === "fulfilled") {
    return {
      title: "Order completed",
      badge: "Completed",
      intro: `This order with ${order.displayName} is complete.`,
      next: [] as string[],
    };
  }
  if (order.reviewState === "changes") {
    return {
      title: "Seller proposed a change",
      badge: "Review the change",
      intro: `${order.displayName} proposed a change before confirming the order.`,
      next: ["Read the change below.", "Accept it if the new amount and delivery work for you."],
    };
  }
  if (order.reviewState !== "accepted") {
    return {
      title: "Order request sent!",
      badge: "Awaiting seller",
      intro: digital
        ? `Your request has been sent to ${order.displayName}. The file is emailed after they confirm your payment.`
        : order.fulfillment === "pickup"
          ? `Your request has been sent to ${order.displayName}. The seller will confirm availability and pickup details.`
          : `Your request has been sent to ${order.displayName}. The seller will confirm availability and delivery details.`,
      next: [
        "Seller reviews and confirms your order.",
        "You'll receive the confirmed pickup and payment instructions, if applicable.",
        "Pay the seller directly using your selected method.",
      ],
    };
  }
  const paid = order.paymentStatus === "paid" || order.status === "paid";
  if (fulfillmentDone(order.fulfillmentState)) {
    if (order.buyerReceivedAt) {
      return {
        title: "Receipt confirmed",
        badge: "Receipt confirmed",
        intro: "You confirmed that you received this order. You can review the seller.",
        next: [] as string[],
      };
    }
    if (order.fulfillmentState === "ready") {
      return {
        title: "Ready for pickup",
        badge: "Ready for pickup",
        intro: `${order.displayName} marked this order ready for pickup.`,
        next: ["Pick it up at the place and time on the order.", "Confirm receipt after you have it, then you can review the seller."],
      };
    }
    if (digital) {
      return {
        title: order.fileSentAt ? "File sent" : "Payment confirmed",
        badge: order.fileSentAt ? "File sent" : "Payment confirmed",
        intro: order.fileSentAt
          ? `The file link and password were emailed to you.`
          : `${order.displayName} confirmed your payment. The file link arrives when they send it.`,
        next: order.fileSentAt ? ["Confirm receipt after you can open the file, then you can review the seller."] : [],
      };
    }
    return {
      title: "Sent out for delivery",
      badge: "Sent",
      intro: `${order.displayName} sent this order out for delivery.`,
      next: ["Confirm receipt after it arrives, then you can review the seller."],
    };
  }
  if (paymentNeedsConfirm(order.buyerPayment) && !paid) {
    return {
      title: "Order confirmed",
      badge: "Pay the seller",
      intro: `${order.displayName} confirmed the order. Pay them directly, then they confirm the payment.`,
      next: [
        "Pay with the method you selected.",
        "The seller confirms the payment.",
        digital ? "They email the file after that." : shipsToBuyer(order.fulfillment) ? "They mark it sent out for delivery." : "They mark it ready for pickup.",
      ],
    };
  }
  if (!paymentNeedsConfirm(order.buyerPayment)) {
    return {
      title: "Order confirmed",
      badge: "Awaiting pickup",
      intro: `${order.displayName} confirmed the order. Pay in cash when you pick it up. They will email you when it is ready.`,
      next: ["Wait for the ready-for-pickup email.", "Pay the seller in cash when you pick it up.", "Confirm receipt after you have it."],
    };
  }
  return {
    title: "Payment confirmed",
    badge: "Payment confirmed",
    intro: digital
      ? `${order.displayName} confirmed your payment. The file link arrives when they send it.`
      : shipsToBuyer(order.fulfillment)
        ? `${order.displayName} confirmed your payment. They will email you when it is sent.`
        : `${order.displayName} confirmed your payment. They will email you when it is ready for pickup.`,
    next: [] as string[],
  };
}
