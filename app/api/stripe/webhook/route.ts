import { markOrderPaid } from "@/lib/db";
import { deliverPaidFile, fulfillStripeDigitalOrder } from "@/lib/file-delivery";
import { getStripe } from "@/lib/stripe";

export async function POST(request: Request) {
  const stripe = getStripe();
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripe || !secret) return new Response("Stripe is not configured", { status: 501 });
  const signature = request.headers.get("stripe-signature");
  if (!signature) return new Response("Missing signature", { status: 400 });
  const body = await request.text();
  try {
    const event = stripe.webhooks.constructEvent(body, signature, secret);
    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      const orderId = session.metadata?.orderId;
      if (orderId && session.payment_status === "paid" && session.metadata?.purpose === "digital_file") {
        const intent = session.payment_intent;
        await fulfillStripeDigitalOrder(orderId, {
          amountCents: session.amount_total ?? 0,
          currency: (session.currency || "").toUpperCase(),
          paymentId: typeof intent === "string" ? intent : session.id,
        });
      } else if (orderId && session.payment_status === "paid") {
        const intent = session.payment_intent;
        if (markOrderPaid(orderId, session.id, typeof intent === "string" ? intent : session.id)) {
          await deliverPaidFile(orderId);
        }
      }
    }
  } catch {
    return new Response("Invalid signature", { status: 400 });
  }
  return new Response("ok");
}
