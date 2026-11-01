import { methodLabel, safeEmail } from "@/lib/payments";

export type PaymentFlow = "seller_direct" | "twigigi_checkout";

export function paymentFlowOf(value: string | null | undefined): PaymentFlow {
  return value === "twigigi_checkout" ? "twigigi_checkout" : "seller_direct";
}

const AMOUNT_SQL = "CASE WHEN total > 0 THEN total ELSE amount_cents END";

export const MARKETPLACE_GMV_SQL = `
  SELECT COALESCE(NULLIF(currency, ''), 'CAD') AS currency,
    COALESCE(SUM(CASE WHEN status != 'canceled' THEN ${AMOUNT_SQL} ELSE 0 END), 0) AS gmv,
    COALESCE(SUM(CASE WHEN status != 'canceled' AND (payment_status = 'paid' OR status IN ('paid', 'fulfilled')) THEN ${AMOUNT_SQL} ELSE 0 END), 0) AS paid_gmv,
    COALESCE(SUM(CASE WHEN status NOT IN ('canceled', 'paid', 'fulfilled') AND payment_status != 'paid' THEN ${AMOUNT_SQL} ELSE 0 END), 0) AS unpaid_gmv
  FROM orders
  GROUP BY COALESCE(NULLIF(currency, ''), 'CAD')
`;

export const PLATFORM_REVENUE_SQL = `
  SELECT COALESCE(NULLIF(currency, ''), 'CAD') AS currency,
    COALESCE(SUM(amount_cents), 0) AS revenue
  FROM twig_bills
  WHERE status = 'paid'
  GROUP BY COALESCE(NULLIF(currency, ''), 'CAD')
`;

export const SELLER_SALES_SQL = `
  SELECT COALESCE(NULLIF(currency, ''), 'CAD') AS currency,
    COALESCE(SUM(CASE WHEN status != 'canceled' THEN ${AMOUNT_SQL} ELSE 0 END), 0) AS sales,
    COALESCE(SUM(CASE WHEN status != 'canceled' AND (payment_status = 'paid' OR status IN ('paid', 'fulfilled')) THEN ${AMOUNT_SQL} ELSE 0 END), 0) AS paid,
    COALESCE(SUM(CASE WHEN status NOT IN ('canceled', 'paid', 'fulfilled') AND payment_status != 'paid' THEN ${AMOUNT_SQL} ELSE 0 END), 0) AS awaiting
  FROM orders
  WHERE seller_id = ?
  GROUP BY COALESCE(NULLIF(currency, ''), 'CAD')
`;

export function cardLinkProvider(url: string) {
  const trimmed = url.trim();
  if (!trimmed) return "";
  if (safeEmail(trimmed)) return "PayPal";
  try {
    const host = new URL(trimmed).hostname.toLowerCase().replace(/^www\./, "");
    if (host === "stripe.com" || host.endsWith(".stripe.com")) return "Stripe";
    if (host === "paypal.com" || host.endsWith(".paypal.com") || host === "paypal.me") return "PayPal";
    if (host === "square.link" || host.endsWith(".square.link") || host === "squareup.com" || host.endsWith(".squareup.com") || host === "square.site" || host.endsWith(".square.site")) return "Square";
    return "";
  } catch {
    return "";
  }
}

export function orderPaymentMethodLabel(methodId: string) {
  if (methodId === "card") return "Seller payment link";
  return methodLabel(methodId) || "Not chosen";
}

export function paymentConfirmationLabel(flow: PaymentFlow, paid: boolean) {
  if (!paid) return "Awaiting seller confirmation";
  if (flow === "seller_direct") return "Manually confirmed by seller";
  return "Confirmed by Twigigi Checkout";
}

export function orderIsPaid(status: string, paymentStatus: string) {
  return paymentStatus === "paid" || status === "paid" || status === "fulfilled";
}
