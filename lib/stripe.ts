import Stripe from "stripe";
import { BILLING_CONSENT_VERSION, type IntentStatus, setupAuthorization } from "@/lib/billing-auth";
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
  let id = accountId;
  let chargesEnabled = false;
  let sawAccount = false;
  try {
    const account = await stripe.accounts.retrieve(accountId);
    id = account.id;
    chargesEnabled = Boolean(account.charges_enabled);
    sawAccount = true;
  } catch (error) {
    console.error("Stripe account retrieve failed.", error instanceof Error ? error.message : "");
  }
  if (!chargesEnabled) {
    try {
      const account = await stripe.v2.core.accounts.retrieve(accountId, { include: ["configuration.merchant"] });
      id = account.id;
      chargesEnabled = account.configuration?.merchant?.capabilities?.card_payments?.status === "active";
      sawAccount = true;
    } catch (error) {
      console.error("Stripe v2 account retrieve failed.", error instanceof Error ? error.message : "");
    }
  }
  if (!sawAccount) return null;
  return { id, chargesEnabled };
}

const CONNECT_API_VERSION = "2026-10-28.preview";

function connectFailureMessage(raw: string) {
  const text = raw
    .replace(/\brk_(?:live|test)_[A-Za-z0-9]+/g, "the Stripe key")
    .replace(/\bsk_(?:live|test)_[A-Za-z0-9]+/g, "the Stripe key")
    .replace(/\bacct_[A-Za-z0-9]+/g, "the Stripe account")
    .replace(/\s+/g, " ")
    .trim();
  if (/v2_account_storer_write|required permissions|permission denied/i.test(text)) {
    return "The Stripe key needs permission to create connected accounts.";
  }
  return text.slice(0, 240) || "Stripe could not open the connection page.";
}

export async function createStripeConnectLink(input: { accountId: string; email: string; country: "CA" | "US" }) {
  const stripe = getStripe();
  if (!stripe) return null;
  let accountId = input.accountId;
  try {
    if (!accountId) {
      const account = await stripe.v2.core.accounts.create({
        contact_email: input.email,
        dashboard: "express",
        identity: { country: input.country },
        defaults: {
          responsibilities: {
            fees_collector: "stripe",
            losses_collector: "stripe",
          },
        },
        configuration: {
          merchant: {
            capabilities: { card_payments: { requested: true } },
          },
        },
      }, { apiVersion: CONNECT_API_VERSION });
      accountId = account.id;
    }
    const link = await stripe.v2.core.accountLinks.create({
      account: accountId,
      use_case: {
        type: "account_onboarding",
        account_onboarding: {
          refresh_url: `${appUrl()}/dashboard/payments?stripe=refresh`,
          return_url: `${appUrl()}/dashboard/payments?stripe=return`,
        },
      },
    }, { apiVersion: CONNECT_API_VERSION });
    if (!link.url) return { accountId, url: "", message: "Stripe did not return a connection page." };
    return { accountId, url: link.url, message: "" };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Stripe could not open the connection page.";
    console.error("Stripe Connect link failed.", message);
    return { accountId, url: "", message: connectFailureMessage(message) };
  }
}

export function publicStripeError(raw: string) {
  return raw
    .replace(/\brk_(?:live|test)_[A-Za-z0-9]+/g, "the Stripe key")
    .replace(/\bsk_(?:live|test)_[A-Za-z0-9]+/g, "the Stripe key")
    .replace(/\bwhsec_[A-Za-z0-9]+/g, "the webhook secret")
    .replace(/\bpm_[A-Za-z0-9]+/g, "the saved card")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 180);
}

function intentStatus(status: string | null | undefined): IntentStatus {
  if (status === "succeeded" || status === "processing" || status === "requires_action" || status === "requires_payment_method" || status === "canceled") return status;
  return "unknown";
}

export type SetupVerdict = {
  status: "authorized" | "action_required" | "incomplete";
  customerId: string;
  paymentMethodId: string;
  brand: string;
  last4: string;
  userId: string;
};

function emptySetup(): SetupVerdict {
  return { status: "incomplete", customerId: "", paymentMethodId: "", brand: "", last4: "", userId: "" };
}

export async function createBillingSetupSession(input: { customerId: string; email: string; userId: string; consentVersion: string }) {
  const stripe = getStripe();
  if (!stripe || input.consentVersion !== BILLING_CONSENT_VERSION) return null;
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
    allowed_payment_method_types: ["card"],
    success_url: `${appUrl()}/dashboard/payments?tab=receipts&billing=return&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${appUrl()}/dashboard/payments?tab=receipts&billing=canceled`,
    metadata: { purpose: "billing_setup", userId: input.userId, consentVersion: input.consentVersion },
    setup_intent_data: {
      metadata: { purpose: "billing_setup", userId: input.userId, consentVersion: input.consentVersion },
    },
  });
  if (!session.url) return { customerId, url: "" };
  return { customerId, url: session.url };
}

async function verdictFromIntent(intent: Stripe.SetupIntent, expectedUserId: string, sessionComplete: boolean): Promise<SetupVerdict> {
  const stripe = getStripe();
  const paymentMethodId = typeof intent.payment_method === "string" ? intent.payment_method : "";
  const customerId = typeof intent.customer === "string" ? intent.customer : "";
  const status = setupAuthorization({
    purpose: intent.metadata?.purpose,
    userId: intent.metadata?.userId,
    expectedUserId,
    sessionComplete,
    intentStatus: intent.status,
    usage: intent.usage ?? "",
    paymentMethodId,
    customerId,
    consentVersion: intent.metadata?.consentVersion,
  });
  if (!stripe || (status !== "authorized" && status !== "action_required")) return { ...emptySetup(), customerId, userId: intent.metadata?.userId || "" };
  let brand = "";
  let last4 = "";
  if (paymentMethodId) {
    const method = await stripe.paymentMethods.retrieve(paymentMethodId);
    brand = method.card?.brand || "";
    last4 = method.card?.last4 || "";
  }
  if (status === "authorized" && customerId && paymentMethodId) {
    await stripe.customers.update(customerId, { invoice_settings: { default_payment_method: paymentMethodId } });
  }
  return { status, customerId, paymentMethodId, brand, last4, userId: intent.metadata?.userId || "" };
}

export async function billingSetupCustomer(sessionId: string, userId: string): Promise<SetupVerdict> {
  const stripe = getStripe();
  if (!stripe || !sessionId) return emptySetup();
  const session = await stripe.checkout.sessions.retrieve(sessionId);
  if (session.metadata?.purpose !== "billing_setup" || session.metadata.userId !== userId) return emptySetup();
  const intentId = typeof session.setup_intent === "string" ? session.setup_intent : "";
  if (!intentId) return emptySetup();
  const intent = await stripe.setupIntents.retrieve(intentId);
  return verdictFromIntent(intent, userId, session.status === "complete");
}

export async function billingSetupFromIntent(intentId: string): Promise<SetupVerdict> {
  const stripe = getStripe();
  if (!stripe || !intentId) return emptySetup();
  const intent = await stripe.setupIntents.retrieve(intentId);
  const userId = intent.metadata?.userId || "";
  return verdictFromIntent(intent, userId, intent.status === "succeeded" || intent.status === "requires_action");
}

export async function retrieveFeeIntent(id: string) {
  const stripe = getStripe();
  if (!stripe || !id.startsWith("pi_")) return null;
  try {
    const intent = await stripe.paymentIntents.retrieve(id);
    return { id: intent.id, status: intentStatus(intent.status) };
  } catch {
    return { id, status: "unknown" as const };
  }
}

export async function findCollectionIntent(customerId: string, collectionId: string) {
  const stripe = getStripe();
  if (!stripe || !customerId || !collectionId) return null;
  const list = await stripe.paymentIntents.list({ customer: customerId, limit: 20 });
  const match = list.data.find((intent) => intent.metadata?.collectionId === collectionId && intent.metadata?.purpose === "twigigi_fees");
  if (!match) return null;
  return { id: match.id, status: intentStatus(match.status) };
}

export async function createOffSessionFeePayment(input: {
  customerId: string;
  paymentMethodId: string;
  amountCents: number;
  currency: string;
  collectionId: string;
  userId: string;
  idempotencyKey: string;
}) {
  const stripe = getStripe();
  if (!stripe || !input.customerId || !input.paymentMethodId.startsWith("pm_") || input.amountCents < 1 || !input.idempotencyKey) {
    return { id: "", status: "unknown" as const };
  }
  try {
    const intent = await stripe.paymentIntents.create({
      amount: input.amountCents,
      currency: input.currency === "USD" ? "usd" : "cad",
      customer: input.customerId,
      payment_method: input.paymentMethodId,
      off_session: true,
      confirm: true,
      description: "Twigigi listing and quote fees",
      metadata: { purpose: "twigigi_fees", userId: input.userId, collectionId: input.collectionId },
    }, { idempotencyKey: input.idempotencyKey });
    return { id: intent.id, status: intentStatus(intent.status) };
  } catch (error) {
    const intent = (error as { payment_intent?: { id?: string; status?: string } }).payment_intent;
    console.error("Off-session fee charge did not finish.", input.collectionId);
    if (intent?.id) return { id: intent.id, status: intentStatus(intent.status) };
    return { id: "", status: "unknown" as const };
  }
}

export async function cancelFeeIntent(id: string) {
  const stripe = getStripe();
  if (!stripe || !id.startsWith("pi_")) return false;
  try {
    const intent = await stripe.paymentIntents.cancel(id);
    return intent.status === "canceled";
  } catch {
    return false;
  }
}

export async function settleFeeCheckout(sessionId: string, userId: string) {
  const stripe = getStripe();
  if (!stripe || !sessionId) return [];
  const session = await stripe.checkout.sessions.retrieve(sessionId);
  if (session.metadata?.purpose !== "twigigi_fees" || session.metadata.userId !== userId || session.payment_status !== "paid") return [];
  return session.metadata.chargeKey ? [session.metadata.chargeKey] : [];
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
