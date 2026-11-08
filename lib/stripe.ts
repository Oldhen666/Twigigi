import Stripe from "stripe";
import { getOrder, markOrderPaid } from "@/lib/db";
import { deliverPaidFile, fulfillStripeDigitalOrder } from "@/lib/file-delivery";
import { appUrl } from "@/lib/format";

export function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  return new Stripe(key);
}

export function paymentsReady() {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

export async function refreshStripeConnect(accountId: string) {
  const stripe = getStripe();
  if (!stripe || !accountId) return null;
  const account = await stripe.accounts.retrieve(accountId);
  return { id: account.id, chargesEnabled: Boolean(account.charges_enabled) };
}

export async function createStripeConnectLink(input: { accountId: string; email: string; country: "CA" | "US" }) {
  const stripe = getStripe();
  if (!stripe) return null;
  let accountId = input.accountId;
  try {
    if (!accountId) {
      const account = await stripe.accounts.create({
        type: "express",
        country: input.country,
        email: input.email,
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
      });
      accountId = account.id;
    }
    const link = await stripe.accountLinks.create({
      account: accountId,
      type: "account_onboarding",
      refresh_url: `${appUrl()}/dashboard/payments?stripe=refresh`,
      return_url: `${appUrl()}/dashboard/payments?stripe=return`,
    });
    if (!link.url) return { accountId, url: "", message: "Stripe did not return a connection page." };
    return { accountId, url: link.url, message: "" };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Stripe could not open the connection page.";
    console.error("Stripe Connect link failed.", message);
    return { accountId, url: "", message: message.slice(0, 180) };
  }
}

export async function createBillingSetupSession(input: { customerId: string; email: string; userId: string }) {
  const stripe = getStripe();
  if (!stripe) return null;
  let customerId = input.customerId;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: input.email,
      metadata: { userId: input.userId, purpose: "twigigi_billing" },
    });
    customerId = customer.id;
  }
  const session = await stripe.checkout.sessions.create({
    mode: "setup",
    customer: customerId,
    currency: "cad",
    success_url: `${appUrl()}/dashboard/payments?tab=receipts&billing=return&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${appUrl()}/dashboard/payments?tab=receipts&billing=canceled`,
    metadata: { purpose: "billing_setup", userId: input.userId },
  });
  if (!session.url) return { customerId, url: "" };
  return { customerId, url: session.url };
}

export async function billingSetupCustomer(sessionId: string, userId: string) {
  const stripe = getStripe();
  if (!stripe || !sessionId) return "";
  const session = await stripe.checkout.sessions.retrieve(sessionId);
  if (session.metadata?.purpose !== "billing_setup" || session.metadata.userId !== userId || session.status !== "complete") return "";
  return typeof session.customer === "string" ? session.customer : "";
}

export async function createDigitalStripeCheckout(input: {
  orderId: string;
  amountCents: number;
  currency: string;
  itemName: string;
  buyerEmail: string;
  accountId: string;
}) {
  const stripe = getStripe();
  if (!stripe) throw new Error("Stripe is not configured");
  const session = await stripe.checkout.sessions.create(
    {
      mode: "payment",
      customer_email: input.buyerEmail,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: input.currency === "USD" ? "usd" : "cad",
            unit_amount: input.amountCents,
            product_data: { name: input.itemName.replace(/\s+/g, " ").trim().slice(0, 120) || "Digital file" },
          },
        },
      ],
      metadata: { orderId: input.orderId, purpose: "digital_file" },
      payment_intent_data: { metadata: { orderId: input.orderId, purpose: "digital_file" } },
      success_url: `${appUrl()}/order/${input.orderId}?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl()}/order/${input.orderId}?canceled=1`,
    },
    { stripeAccount: input.accountId },
  );
  if (!session.url) throw new Error("Stripe did not return a payment page");
  return { id: session.id, url: session.url };
}

export async function confirmStripeSession(orderId: string, sessionId: string) {
  const stripe = getStripe();
  if (!stripe) return;
  try {
    const order = getOrder(orderId);
    const session = order?.stripeAccountId
      ? await stripe.checkout.sessions.retrieve(sessionId, {}, { stripeAccount: order.stripeAccountId })
      : await stripe.checkout.sessions.retrieve(sessionId);
    if (session.metadata?.orderId !== orderId || session.payment_status !== "paid") return;
    const intent = session.payment_intent;
    const paymentId = typeof intent === "string" ? intent : session.id;
    if (session.metadata?.purpose === "digital_file") {
      await fulfillStripeDigitalOrder(orderId, {
        amountCents: session.amount_total ?? 0,
        currency: (session.currency || "").toUpperCase(),
        paymentId,
      });
      return;
    }
    if (markOrderPaid(orderId, session.id, paymentId)) await deliverPaidFile(orderId);
  } catch {
    return;
  }
}
