import { setPaypalOrderId } from "@/lib/db";
import { appUrl } from "@/lib/format";
import type { OrderRecord } from "@/lib/types";

const LIVE = "https://api-m.paypal.com";
const SANDBOX = "https://api-m.sandbox.paypal.com";

export class PaypalCheckoutError extends Error {
  constructor(readonly issue: string) {
    super(issue);
    this.name = "PaypalCheckoutError";
  }
}

export function paypalConfigured() {
  return Boolean(process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_CLIENT_SECRET);
}

function paypalBase() {
  return process.env.PAYPAL_ENV === "live" ? LIVE : SANDBOX;
}

export function paypalMoneyCents(value: string) {
  if (!/^\d+(\.\d{1,2})?$/.test(value)) return null;
  const [whole, frac = ""] = value.split(".");
  return Number(whole) * 100 + Number(frac.padEnd(2, "0").slice(0, 2));
}

async function accessToken() {
  const id = process.env.PAYPAL_CLIENT_ID || "";
  const secret = process.env.PAYPAL_CLIENT_SECRET || "";
  const response = await fetch(`${paypalBase()}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  if (!response.ok) throw new PaypalCheckoutError("PAYPAL_AUTH");
  const body = (await response.json()) as { access_token?: string };
  if (!body.access_token) throw new PaypalCheckoutError("PAYPAL_AUTH");
  return body.access_token;
}

async function paypalFetch(path: string, init: { method: string; body?: unknown }) {
  const token = await accessToken();
  const response = await fetch(`${paypalBase()}${path}`, {
    method: init.method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
  const body = (await response.json().catch(() => null)) as {
    name?: string;
    details?: Array<{ issue?: string }>;
    message?: string;
  } | null;
  if (!response.ok) {
    throw new PaypalCheckoutError(body?.details?.[0]?.issue || body?.name || "PAYPAL_REQUEST");
  }
  return body as Record<string, unknown> | null;
}

export async function beginDigitalPaypalCheckout(order: OrderRecord, payeeEmail: string) {
  const checkout = await createPaypalCheckout({
    orderId: order.id,
    amountCents: order.totalCents || order.amountCents,
    currency: order.currency,
    itemName: order.productTitle,
    payeeEmail,
  });
  setPaypalOrderId(order.id, checkout.id);
  return checkout.approveUrl;
}

export async function createPaypalCheckout(input: {
  orderId: string;
  amountCents: number;
  currency: string;
  itemName: string;
  payeeEmail: string;
}) {
  const currency = input.currency === "USD" ? "USD" : "CAD";
  const body = await paypalFetch("/v2/checkout/orders", {
    method: "POST",
    body: {
      intent: "CAPTURE",
      purchase_units: [
        {
          custom_id: input.orderId,
          invoice_id: `${input.orderId}:${Date.now()}`,
          description: input.itemName.replace(/\s+/g, " ").trim().slice(0, 127) || "Digital file",
          amount: { currency_code: currency, value: (input.amountCents / 100).toFixed(2) },
          payee: { email_address: input.payeeEmail },
        },
      ],
      application_context: {
        brand_name: "Twigigi",
        user_action: "PAY_NOW",
        shipping_preference: "NO_SHIPPING",
        return_url: `${appUrl()}/api/paypal/return?order=${encodeURIComponent(input.orderId)}`,
        cancel_url: `${appUrl()}/order/${input.orderId}?canceled=1`,
      },
    },
  });
  const id = typeof body?.id === "string" ? body.id : "";
  const links = Array.isArray(body?.links) ? body.links : [];
  const approve = links.find((link) => {
    if (!link || typeof link !== "object") return false;
    const rel = "rel" in link ? link.rel : "";
    return rel === "approve" || rel === "payer-action";
  }) as { href?: string } | undefined;
  if (!id || !approve?.href) throw new PaypalCheckoutError("PAYPAL_APPROVE");
  return { id, approveUrl: approve.href };
}

export type PaypalCapture = {
  captureId: string;
  orderId: string;
  amountCents: number;
  currency: string;
  payeeEmail: string;
};

function readPayee(value: unknown) {
  if (!value || typeof value !== "object" || !("email_address" in value)) return "";
  return typeof value.email_address === "string" ? value.email_address : "";
}

function readCaptureRecord(value: unknown, fallbackOrderId = ""): PaypalCapture | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const amount = record.amount && typeof record.amount === "object" ? (record.amount as Record<string, unknown>) : null;
  const cents = paypalMoneyCents(typeof amount?.value === "string" ? amount.value : "");
  const currency = typeof amount?.currency_code === "string" ? amount.currency_code.toUpperCase() : "";
  const captureId = typeof record.id === "string" ? record.id : "";
  const orderId = typeof record.custom_id === "string" && record.custom_id ? record.custom_id : fallbackOrderId;
  if (!captureId || !orderId || cents == null || (currency !== "CAD" && currency !== "USD")) return null;
  if (record.status && record.status !== "COMPLETED") return null;
  return { captureId, orderId, amountCents: cents, currency, payeeEmail: readPayee(record.payee) };
}

export function readPaypalOrderCapture(body: unknown, fallbackOrderId: string): PaypalCapture | null {
  if (!body || typeof body !== "object") return null;
  const record = body as Record<string, unknown>;
  if (record.status && record.status !== "COMPLETED") return null;
  const units = Array.isArray(record.purchase_units) ? record.purchase_units : [];
  for (const unit of units) {
    if (!unit || typeof unit !== "object") continue;
    const purchase = unit as Record<string, unknown>;
    const payments = purchase.payments && typeof purchase.payments === "object" ? (purchase.payments as Record<string, unknown>) : null;
    const captures = Array.isArray(payments?.captures) ? payments.captures : [];
    for (const capture of captures) {
      const read = readCaptureRecord(capture, typeof purchase.custom_id === "string" ? purchase.custom_id : fallbackOrderId);
      if (!read) continue;
      return { ...read, payeeEmail: read.payeeEmail || readPayee(purchase.payee), orderId: read.orderId || fallbackOrderId };
    }
  }
  return null;
}

export async function capturePaypalOrder(paypalOrderId: string, fallbackOrderId: string) {
  const body = await paypalFetch(`/v2/checkout/orders/${encodeURIComponent(paypalOrderId)}/capture`, { method: "POST", body: {} });
  const capture = readPaypalOrderCapture(body, fallbackOrderId);
  if (!capture) throw new PaypalCheckoutError("PAYPAL_CAPTURE");
  return capture;
}

export function readPaypalWebhookCapture(event: unknown): PaypalCapture | null {
  if (!event || typeof event !== "object") return null;
  const record = event as Record<string, unknown>;
  if (record.event_type !== "PAYMENT.CAPTURE.COMPLETED") return null;
  return readCaptureRecord(record.resource);
}

export async function paypalWebhookVerified(requestHeaders: Headers, event: unknown) {
  const webhookId = process.env.PAYPAL_WEBHOOK_ID || "";
  if (!webhookId) return false;
  const token = await accessToken();
  const response = await fetch(`${paypalBase()}/v1/notifications/verify-webhook-signature`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      auth_algo: requestHeaders.get("paypal-auth-algo"),
      cert_url: requestHeaders.get("paypal-cert-url"),
      transmission_id: requestHeaders.get("paypal-transmission-id"),
      transmission_sig: requestHeaders.get("paypal-transmission-sig"),
      transmission_time: requestHeaders.get("paypal-transmission-time"),
      webhook_id: webhookId,
      webhook_event: event,
    }),
  });
  if (!response.ok) return false;
  const body = (await response.json()) as { verification_status?: string };
  return body.verification_status === "SUCCESS";
}

export function paypalCheckoutError(error: unknown) {
  const issue = error instanceof PaypalCheckoutError ? error.issue : "";
  if (issue.includes("PAYEE")) return "PayPal did not accept this seller's PayPal account.";
  return "PayPal could not start this payment.";
}
