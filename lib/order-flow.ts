import { isCashMethod } from "@/lib/payments";

export const ORDER_COMPLETE_DAYS = 30;

export type ReviewState = "requested" | "accepted" | "changes" | "declined";
export type FulfillmentState = "" | "ready" | "sent";

export function paymentNeedsConfirm(method: string) {
  return !isCashMethod(method);
}

export function fulfillmentDone(state: string) {
  return state === "ready" || state === "sent" || state === "handed";
}

export function shipsToBuyer(fulfillment: string) {
  return fulfillment === "delivery" || fulfillment === "shipping";
}

export function sellerAttention(order: {
  status: string;
  reviewState: string;
  paymentStatus: string;
  fulfillment: string;
  fulfillmentState: string;
  buyerPayment: string;
  pickupConfirmedAt?: string | null;
  pickupProposedBy?: "" | "buyer" | "seller";
  fileSentAt?: string | null;
}) {
  if (order.status === "canceled" || order.reviewState === "declined" || order.reviewState === "changes") return "";
  if (order.status === "fulfilled" || order.fulfillmentState === "handed") return "";
  if (isCashMethod(order.buyerPayment) && order.fulfillment === "pickup") {
    if (order.fulfillmentState === "ready") {
      return order.paymentStatus === "paid" || order.status === "paid" ? "Confirm handover" : "Confirm payment and handover";
    }
    if (order.pickupProposedBy === "seller" && !order.pickupConfirmedAt) return "";
    if (!order.pickupConfirmedAt) return "Confirm pickup time";
    return "Mark ready for pickup";
  }
  const paid = order.paymentStatus === "paid" || order.status === "paid";
  if (order.fulfillment === "digital") return paid && !order.fileSentAt ? "Send the file" : "";
  if (order.reviewState === "requested") return "Review this order";
  if (!paid && paymentNeedsConfirm(order.buyerPayment)) return "Confirm payment";
  if (!fulfillmentDone(order.fulfillmentState)) return shipsToBuyer(order.fulfillment) ? "Ship this order" : "Mark ready for pickup";
  return "";
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
  const paid = order.paymentStatus === "paid" || order.status === "paid";
  if (!paid) return false;
  if (!fulfillmentDone(order.fulfillmentState)) return false;
  if (order.buyerReceivedAt) return true;
  if (!order.readyAt) return false;
  const ready = Date.parse(order.readyAt);
  return Number.isFinite(ready) && now - ready >= ORDER_COMPLETE_DAYS * 24 * 60 * 60 * 1000;
}

export type TrackState = "done" | "current" | "upcoming" | "stopped";
export type TrackStep = { label: string; state: TrackState };

export function orderTrack(order: StageOrder & { pickupConfirmedAt?: string | null; pickupProposedBy?: "" | "buyer" | "seller" }): TrackStep[] {
  const declined = order.status === "canceled" || order.reviewState === "declined";
  const cashPickup = isCashMethod(order.buyerPayment) && order.fulfillment === "pickup";
  if (cashPickup && !declined) return cashPickupTrack(order);
  const completed = order.status === "fulfilled";
  const accepted = order.reviewState === "accepted";
  const changes = order.reviewState === "changes";
  const paid = order.paymentStatus === "paid" || order.status === "paid" || completed;
  const prepaid = paymentNeedsConfirm(order.buyerPayment);
  const digital = order.fulfillment === "digital";
  const ships = shipsToBuyer(order.fulfillment);
  const fulfilled = fulfillmentDone(order.fulfillmentState) || (digital && Boolean(order.fileSentAt));
  const received = Boolean(order.buyerReceivedAt);
  const finishOpen = completed || orderCanComplete(order);
  const fulfillLabel = digital ? "File sent" : ships ? "Sent" : "Ready for pickup";
  const steps: { label: string; reached: boolean }[] = [
    { label: "Requested", reached: true },
    { label: changes && !declined ? "Change proposed" : "Confirmed", reached: accepted || completed || paid || fulfilled || received },
  ];
  if (prepaid) steps.push({ label: "Payment received", reached: paid || completed });
  steps.push({ label: fulfillLabel, reached: fulfilled || completed });
  steps.push({ label: "Receipt confirmed", reached: received || completed || finishOpen });
  steps.push({ label: declined ? "Declined" : "Completed", reached: completed });
  if (declined) {
    const kept = steps.filter((step) => step.reached && step.label !== "Declined");
    return [
      ...(kept.length > 0 ? kept : [steps[0]]).map((step) => ({ label: step.label, state: "done" as const })),
      { label: "Declined", state: "stopped" as const },
    ];
  }
  const current = steps.findIndex((step) => !step.reached);
  return steps.map((step, index) => ({
    label: step.label,
    state: step.reached ? "done" : index === current ? "current" : "upcoming",
  }));
}

export function orderRollbackTarget(order: StageOrder & { paymentFlow?: string; pickupConfirmedAt?: string | null }) {
  if (order.status === "canceled" || order.reviewState === "declined") return null;
  if (isCashMethod(order.buyerPayment) && order.fulfillment === "pickup") {
    if (order.status === "fulfilled" || order.fulfillmentState === "handed") return "Ready for pickup";
    if (order.fulfillmentState === "ready") return "Pickup scheduled";
    if (order.pickupConfirmedAt) return "New order";
    return null;
  }
  const prepaid = paymentNeedsConfirm(order.buyerPayment);
  const digital = order.fulfillment === "digital";
  const fulfilled = fulfillmentDone(order.fulfillmentState) || (digital && Boolean(order.fileSentAt));
  const received = Boolean(order.buyerReceivedAt);
  const paid = order.paymentStatus === "paid" || order.status === "paid";
  const fulfillLabel = digital ? "File sent" : shipsToBuyer(order.fulfillment) ? "Sent" : "Ready for pickup";
  if (order.status === "fulfilled") return received || fulfilled ? "Receipt confirmed" : "Confirmed";
  if (received) return fulfilled ? fulfillLabel : prepaid && paid ? "Payment received" : "Confirmed";
  if (fulfilled) return prepaid && paid ? "Payment received" : "Confirmed";
  if (paid && prepaid) return order.paymentFlow === "twigigi_checkout" ? null : "Confirmed";
  return null;
}

function cashPickupTrack(order: StageOrder & { pickupConfirmedAt?: string | null; pickupProposedBy?: "" | "buyer" | "seller" }): TrackStep[] {
  const completed = order.status === "fulfilled" || order.fulfillmentState === "handed";
  const ready = completed || order.fulfillmentState === "ready";
  const scheduled = ready || Boolean(order.pickupConfirmedAt);
  const awaitingBuyer = !scheduled && order.pickupProposedBy === "seller";
  const steps = [
    { label: "Order placed", done: true },
    { label: scheduled ? "Pickup scheduled" : awaitingBuyer ? "Buyer confirmation" : "Pickup confirmation", done: ready },
    { label: "Ready for pickup", done: completed },
    { label: "Completed", done: completed },
  ];
  const current = steps.findIndex((step) => !step.done);
  return steps.map((step, index) => ({
    label: step.label,
    state: step.done ? "done" : index === current ? "current" : "upcoming",
  }));
}

export function orderStage(order: StageOrder & { pickupConfirmedAt?: string | null; pickupProposedBy?: "" | "buyer" | "seller" }) {
  if (order.status === "canceled" || order.reviewState === "declined") return "Canceled";
  if (order.status === "fulfilled") return "Completed";
  const paid = order.paymentStatus === "paid" || order.status === "paid";
  const handed = fulfillmentDone(order.fulfillmentState) || Boolean(order.fulfillment === "digital" && order.fileSentAt);
  if (paid && handed && order.fulfillment !== "digital" && !isCashMethod(order.buyerPayment)) return "Completed";
  if (isCashMethod(order.buyerPayment) && order.fulfillmentState === "handed") return "Completed";
  if (order.reviewState === "changes") return "Changes proposed";
  if (order.fulfillment !== "digital" && order.buyerPayment) {
    if (isCashMethod(order.buyerPayment)) {
      if (order.fulfillmentState === "ready") return "Ready for pickup";
      if (order.pickupConfirmedAt) return "Pickup scheduled";
      if (order.pickupProposedBy === "seller") return "Awaiting buyer";
      return "Awaiting Pickup";
    }
    if (paid) return "Payment Confirmed";
    if (order.paymentStatus === "verifying") return "Verifying Payment";
    return "Awaiting Payment";
  }
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

export type PlacementStep = { title: string; detail: string; state: "done" | "current" | "upcoming" };

export function buyerPlacement(order: StageOrder & { displayName: string; pickupConfirmedAt?: string | null; pickupProposedBy?: "" | "buyer" | "seller" }) {
  const cash = isCashMethod(order.buyerPayment);
  const paid = order.paymentStatus === "paid" || order.status === "paid" || order.status === "fulfilled";
  const verifying = order.paymentStatus === "verifying";
  const handed = fulfillmentDone(order.fulfillmentState) || order.status === "fulfilled";
  const step = (title: string, detail: string, state: PlacementStep["state"]): PlacementStep => ({ title, detail, state });
  if (order.fulfillment === "digital") {
    const emailed = Boolean(order.fileSentAt) || handed;
    if (paid && emailed) {
      return {
        title: "Order completed",
        badge: "Completed",
        intro: "The payment is confirmed and the file was emailed.",
        steps: [
          step("Order placed", "Twigigi created this order right away.", "done"),
          step("Payment confirmed", "The payment is confirmed.", "done"),
          step("File emailed", "The file link was emailed.", "done"),
        ],
      };
    }
    if (paid) {
      return {
        title: "Payment confirmed",
        badge: "Payment Confirmed",
        intro: "The payment is confirmed. Twigigi emails the file link.",
        steps: [
          step("Order placed", "Twigigi created this order right away.", "done"),
          step("Payment confirmed", "The payment is confirmed.", "done"),
          step("File emailed", "Twigigi emails the file link.", "current"),
        ],
      };
    }
    return {
      title: "Awaiting payment",
      badge: "Awaiting payment",
      intro: "Pay the seller directly. The file is emailed when the payment is confirmed.",
      steps: [
        step("Order placed", "Twigigi created this order right away.", "done"),
        step("Pay the seller", "Finish the payment. The file is emailed when it is confirmed.", "current"),
        step("File emailed", "The file link arrives by email.", "upcoming"),
      ],
    };
  }
  if (cash && order.fulfillment === "pickup") {
    const delivered = order.fulfillmentState === "handed" || order.status === "fulfilled";
    const ready = delivered || order.fulfillmentState === "ready";
    const confirmed = Boolean(order.pickupConfirmedAt) || ready;
    const doneNote = "The order is complete when the seller confirms the cash and hands over the item.";
    if (delivered) {
      return {
        title: "Order completed",
        badge: "Completed",
        intro: "The seller confirmed the cash and handed over the item.",
        steps: [
          step("Order placed", "Twigigi created this order right away.", "done"),
          step("Pickup", "The item was handed over.", "done"),
          step("Complete", "The seller confirmed the cash and the handover.", "done"),
        ],
      };
    }
    if (order.pickupProposedBy === "seller" && !order.pickupConfirmedAt && !ready) {
      return {
        title: "Confirm pickup time",
        badge: "Confirm pickup",
        intro: `${order.displayName} suggested a new pickup time.`,
        steps: [
          step("Order placed", "Twigigi created this order right away.", "done"),
          step("Confirm pickup", "Confirm the new time so the seller can prepare it.", "current"),
          step("Complete", doneNote, "upcoming"),
        ],
      };
    }
    if (!confirmed) {
      return {
        title: "Awaiting pickup",
        badge: "Awaiting Pickup",
        intro: "The seller still needs to confirm the pickup time.",
        steps: [
          step("Order placed", "Twigigi created this order right away.", "done"),
          step("Pickup requested", "Waiting for the seller to confirm your pickup time.", "current"),
          step("Complete", doneNote, "upcoming"),
        ],
      };
    }
    if (!ready) {
      return {
        title: "Pickup scheduled",
        badge: "Pickup scheduled",
        intro: "The seller confirmed the pickup time.",
        steps: [
          step("Order placed", "Twigigi created this order right away.", "done"),
          step("Pickup scheduled", "The seller confirmed the pickup time.", "current"),
          step("Complete", doneNote, "upcoming"),
        ],
      };
    }
    return {
      title: "Ready for pickup",
      badge: "Ready for pickup",
      intro: paid
        ? "The seller confirmed the cash. Pick up the item when they hand it over."
        : "The seller is ready. Pay in cash when you pick it up.",
      steps: [
        step("Order placed", "Twigigi created this order right away.", "done"),
        step("Ready for pickup", paid ? "The seller confirmed the cash." : "Pay in cash when you pick it up.", "current"),
        step("Complete", doneNote, "upcoming"),
      ],
    };
  }
  if (order.status === "fulfilled" || (paid && handed)) {
    return {
      title: "Order completed",
      badge: "Completed",
      intro: "The payment is confirmed and the item was handed over or delivered.",
      steps: [
        step("Order placed", "Twigigi created this order right away.", "done"),
        step(cash ? "Cash received" : "Payment confirmed", "The seller confirmed the payment.", "done"),
        step("Delivered", "The item was handed over or sent.", "done"),
      ],
    };
  }
  if (paid) {
    return {
      title: "Payment confirmed",
      badge: "Payment Confirmed",
      intro: cash
        ? `${order.displayName} confirmed the cash. Pick it up at the arranged time.`
        : shipsToBuyer(order.fulfillment)
          ? `${order.displayName} confirmed the payment and will arrange delivery.`
          : `${order.displayName} confirmed the payment and will prepare pickup.`,
      steps: [
        step("Order placed", "Twigigi created this order right away.", "done"),
        step("Payment confirmed", "The seller confirmed the money.", "done"),
        step("Fulfillment", "The seller prepares pickup or shipping.", "current"),
      ],
    };
  }
  if (verifying) {
    return {
      title: "Payment verification pending",
      badge: "Verifying Payment",
      intro: "You marked the payment as sent. It is not paid until the seller confirms the money arrived.",
      steps: [
        step("Order placed", "Twigigi created this order right away.", "done"),
        step("Payment sent", "You told the seller you sent the payment.", "done"),
        step("Seller verification", "The seller checks their account, then confirms it.", "current"),
      ],
    };
  }
  return {
    title: "Awaiting payment",
      badge: "Awaiting payment",
      intro: "Pay the seller directly with the details below. Twigigi does not hold or guarantee this payment.",
      steps: [
        step("Order placed", "Twigigi created this order right away.", "done"),
        step("Pay the seller", "Send payment directly to the seller.", "current"),
        step("Seller verification", "The seller confirms the money before it counts as paid.", "upcoming"),
      ],
  };
}

export function buyerOrderCopy(order: StageOrder & { displayName: string; shipCarrier?: string; shipTracking?: string }) {
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
    if (digital) {
      return {
        title: "Pay for the file",
        badge: "Pay the seller",
        intro: `Pay ${order.displayName} with PayPal or a card. The file is emailed as soon as the payment is confirmed.`,
        next: ["Finish the payment.", "The file link arrives by email after the payment is confirmed."],
      };
    }
    return {
      title: "Order request submitted",
      badge: "Awaiting confirmation",
      intro: "Your request has been sent to the seller. No payment is required yet.",
      next: [] as string[],
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
      next: [
        order.shipTracking ? `Track it with ${order.shipCarrier || "the carrier"}: ${order.shipTracking}.` : "The seller included the shipping details on this order.",
        "Confirm receipt after it arrives, then you can review the seller.",
      ],
    };
  }
  if (paymentNeedsConfirm(order.buyerPayment) && !paid) {
    return {
      title: "Order confirmed",
      badge: "Pay the seller",
      intro: `${order.displayName} confirmed the order. Choose a way to pay on this page, then mark it paid.`,
      next: [
        digital ? "PayPal or Stripe confirms the payment, then Twigigi emails the file." : "Pay the seller with one of the methods below.",
        "Mark it paid so they can prepare the order.",
        digital ? "They email the file after that." : shipsToBuyer(order.fulfillment) ? "They add a carrier and tracking number when it ships." : "They mark it ready for pickup.",
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
