import { periodStart } from "@/lib/format";
import { firstPaidUntil, listingCoversNow, type ListingBillingStatus } from "@/lib/listing-cycle";
import { splitLocation } from "@/lib/places";

export type BillingMethod = "card" | "paypal" | "stripe";

export const LISTING_CENTS = 149;
export const QUOTE_SUBMISSION_CENTS = 25;
export const MINIMUM_BILL_CENTS = LISTING_CENTS;
export const QUOTE_CARRY_MONTHS = 3;

export function billingCurrency(location: string) {
  return splitLocation(location).country === "US" ? "USD" : "CAD";
}

export function listingFeeCurrency(cta: string, location: string) {
  if (cta === "file") return "CAD";
  return billingCurrency(location);
}

export function formatListingFee(currency: string) {
  return currency === "USD" ? "USD$1.49" : "C$1.49";
}

export function platformFee(cents: number, currency: string) {
  const amount = (cents / 100).toFixed(2);
  return currency === "USD" ? `USD$${amount}` : `C$${amount}`;
}

export function listingFeeCents(cta: string, feeExempt = false) {
  if (feeExempt) return 0;
  return cta === "buy" || cta === "quote" || cta === "file" ? LISTING_CENTS : 0;
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
  product: {
    cta: string;
    feeExempt?: boolean;
    billingStatus?: ListingBillingStatus | string;
    paidUntil?: string | null;
    graceUntil?: string | null;
  },
  now = new Date(),
) {
  return listingCoversNow(
    {
      ctaFee: listingFeeCents(product.cta),
      feeExempt: product.feeExempt,
      billingStatus: product.billingStatus,
      paidUntil: product.paidUntil,
      graceUntil: product.graceUntil,
    },
    now.getTime(),
  );
}

export function quoteCarryExpired(oldestIso: string | null, now = new Date()) {
  if (!oldestIso) return false;
  const oldest = Date.parse(oldestIso);
  const start = new Date(periodStart(now));
  if (!Number.isFinite(oldest) || Number.isNaN(start.getTime())) return false;
  start.setUTCMonth(start.getUTCMonth() - QUOTE_CARRY_MONTHS);
  return oldest < start.getTime();
}

export function periodCharge(input: { listingCents: number; quoteCents: number; oldestQuoteAt?: string | null; now?: Date }) {
  const chargeQuotes = input.listingCents > 0;
  return {
    dueCents: input.listingCents + (chargeQuotes ? input.quoteCents : 0),
    carriedCents: chargeQuotes ? 0 : input.quoteCents,
  };
}

export function quoteWindow(quotedAt: string) {
  const start = periodStart(new Date(quotedAt));
  const end = new Date(start);
  end.setUTCMonth(end.getUTCMonth() + 1);
  return { start, end: end.toISOString() };
}

export function activeWindow(startedAt: string | null, now = new Date()) {
  const start = startedAt || now.toISOString();
  return { start, end: firstPaidUntil(start) };
}
