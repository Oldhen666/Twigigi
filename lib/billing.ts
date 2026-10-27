import { nextBillingDate, periodStart } from "@/lib/format";
import { splitLocation } from "@/lib/places";

export type BillingMethod = "card" | "paypal" | "stripe";

export const LISTING_CENTS = 100;
export const QUOTE_SUBMISSION_CENTS = 25;

export function billingCurrency(location: string) {
  return splitLocation(location).country === "US" ? "USD" : "CAD";
}

export function listingFeeCents(cta: string) {
  return cta === "buy" || cta === "quote" ? LISTING_CENTS : 0;
}

export function isBillingMethod(value: string): value is BillingMethod {
  return value === "card" || value === "paypal" || value === "stripe";
}

export function billingMethodLabel(method: string) {
  if (method === "card") return "Credit card";
  if (method === "paypal") return "PayPal";
  if (method === "stripe") return "Stripe";
  return "";
}

export function activeWindow(startedAt: string | null, now = new Date()) {
  const end = nextBillingDate(now);
  const monthStart = periodStart(now);
  const started = startedAt ? Date.parse(startedAt) : Number.NaN;
  const start =
    Number.isFinite(started) && started > Date.parse(monthStart) && started < Date.parse(end) ? startedAt || monthStart : monthStart;
  return { start, end };
}
