import { BILLING_CONSENT_VERSION } from "@/lib/billing-auth";
import { deliverBillingNotices } from "@/lib/billing-mail";
import { confirmProviderPayment, holdSellerCollection, markCardActionRequired, markOrderPaid, saveCardAuthorization } from "@/lib/db";
import { deliverPaidFile, fulfillStripeDigitalOrder } from "@/lib/file-delivery";
import { billingSetupCustomer, billingSetupFromIntent, getStripe, type SetupVerdict } from "@/lib/stripe";

function rememberSetup(verdict: SetupVerdict) {
  if (!verdict.userId) return;
  if (verdict.status === "authorized") {
    saveCardAuthorization(verdict.userId, {
      customerId: verdict.customerId,
      paymentMethodId: verdict.paymentMethodId,
      brand: verdict.brand,
      last4: verdict.last4,
      consentVersion: BILLING_CONSENT_VERSION,
    });
    return;
  }
  if (verdict.status === "action_required") markCardActionRequired(verdict.userId, verdict.customerId);
}

export async function POST(request: Request) {
  const stripe = getStripe();
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripe || !secret) return new Response("Stripe is not configured", { status: 501 });
  const signature = request.headers.get("stripe-signature");
  if (!signature) return new Response("Missing signature", { status: 400 });
  const body = await request.text();
  let event: ReturnType<typeof stripe.webhooks.constructEvent>;
  try {
    event = stripe.webhooks.constructEvent(body, signature, secret);
  } catch {
    return new Response("Invalid signature", { status: 400 });
  }
  try {
    if (event.type === "setup_intent.succeeded" || event.type === "setup_intent.requires_action") {
      rememberSetup(await billingSetupFromIntent(event.data.object.id));
    }
    if (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded" || event.type === "checkout.session.async_payment_failed") {
      const session = event.data.object;
      const purpose = session.metadata?.purpose || "";
      const collectionId = session.metadata?.collectionId || "";
      const userId = session.metadata?.userId || "";
      const intent = session.payment_intent;
      const transactionId = typeof intent === "string" ? intent : session.id;
      if (purpose === "billing_setup" && userId) {
        rememberSetup(await billingSetupCustomer(session.id, userId));
      }
      if ((purpose === "twigigi_fees" || purpose === "twig") && collectionId && userId) {
        const succeeded = event.type !== "checkout.session.async_payment_failed" && session.payment_status === "paid";
        if (event.type === "checkout.session.async_payment_failed" || session.payment_status === "paid") {
          confirmProviderPayment({
            provider: "stripe",
            transactionId,
            eventId: event.id,
            userId,
            collectionId,
            paidAt: new Date().toISOString(),
            succeeded,
          });
        }
      }
      const orderId = session.metadata?.orderId;
      if (orderId && session.payment_status === "paid" && session.metadata?.purpose === "digital_file") {
        await fulfillStripeDigitalOrder(orderId, {
          amountCents: session.amount_total ?? 0,
          currency: (session.currency || "").toUpperCase(),
          paymentId: transactionId,
        });
      } else if (orderId && session.payment_status === "paid" && purpose !== "twigigi_fees" && purpose !== "twig" && purpose !== "billing_setup") {
        if (markOrderPaid(orderId, session.id, transactionId)) await deliverPaidFile(orderId);
      }
    }
    if (event.type === "payment_intent.succeeded" || event.type === "payment_intent.payment_failed" || event.type === "payment_intent.processing" || event.type === "payment_intent.requires_action") {
      const intent = event.data.object;
      const purpose = intent.metadata?.purpose || "";
      const collectionId = intent.metadata?.collectionId || "";
      const userId = intent.metadata?.userId || "";
      if (purpose === "twigigi_fees" && collectionId && userId) {
        if (intent.status === "succeeded") {
          confirmProviderPayment({
            provider: "stripe",
            transactionId: intent.id,
            eventId: event.id,
            userId,
            collectionId,
            paidAt: new Date().toISOString(),
            succeeded: true,
          });
        } else if (intent.status === "processing") {
          holdSellerCollection({ collectionId, userId, paymentId: intent.id, status: "unknown" });
        } else if (intent.status === "requires_action") {
          holdSellerCollection({ collectionId, userId, paymentId: intent.id, status: "action_required" });
        } else if (intent.status === "requires_payment_method" || intent.status === "canceled") {
          confirmProviderPayment({
            provider: "stripe",
            transactionId: intent.id,
            eventId: event.id,
            userId,
            collectionId,
            paidAt: new Date().toISOString(),
            succeeded: false,
          });
        } else {
          holdSellerCollection({ collectionId, userId, paymentId: intent.id, status: "unknown" });
        }
      }
    }
    await deliverBillingNotices();
  } catch {
    return new Response("Retry", { status: 500 });
  }
  return new Response("ok");
}
