import Stripe from "stripe";
import { markOrderPaid } from "@/lib/db";
import { deliverPaidFile } from "@/lib/file-delivery";

export function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  return new Stripe(key);
}

export function paymentsReady() {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

export async function confirmStripeSession(orderId: string, sessionId: string) {
  const stripe = getStripe();
  if (!stripe) return;
  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    if (session.metadata?.orderId !== orderId) return;
    if (session.payment_status === "paid") {
      const intent = session.payment_intent;
      if (markOrderPaid(orderId, session.id, typeof intent === "string" ? intent : session.id)) {
        await deliverPaidFile(orderId);
      }
    }
  } catch {
    return;
  }
}
