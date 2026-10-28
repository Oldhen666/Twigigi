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
  if (method === "card" || method === "stripe") return "Credit or debit card";
  if (method === "paypal") return "PayPal";
  return "";
}

export function listingStillPaid(
  product: { cta: string; deactivatedAt: string | null; billingStartedAt: string | null; createdAt: string },
  now = new Date(),
) {
  if (listingFeeCents(product.cta) === 0) return true;
  const anchor = product.deactivatedAt || product.billingStartedAt || product.createdAt;
  const until = Date.parse(nextBillingDate(new Date(anchor)));
  return Number.isFinite(until) && until > now.getTime();
}

export function activeWindow(startedAt: string | null, now = new Date()) {
  const end = nextBillingDate(now);
  const monthStart = periodStart(now);
  const started = startedAt ? Date.parse(startedAt) : Number.NaN;
  const start =
    Number.isFinite(started) && started > Date.parse(monthStart) && started < Date.parse(end) ? startedAt || monthStart : monthStart;
  return { start, end };
}
