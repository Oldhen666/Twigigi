import { platformFee } from "@/lib/billing";
import { anchorDay, businessDate } from "@/lib/billing-calendar";

export const QUOTE_LISTING_CENTS = 499;
export const QUOTE_LEGACY_LISTING_CENTS = 149;
export const QUOTE_FOLLOWUP_CENTS = 50;
export const QUOTE_FEE_CURRENCY = "CAD";

const followupAmount = platformFee(QUOTE_FOLLOWUP_CENTS, QUOTE_FEE_CURRENCY);

export const FOLLOWUP_DRAFT_LINE =
  `${followupAmount} per inquiry when you first send a follow-up. Added to your next bill.`;
export const FOLLOWUP_SEND_NOTICE =
  `A one-time ${followupAmount} follow-up fee will be added to your next bill when this is sent. Further follow-ups for this inquiry are included.`;
export const FOLLOWUP_COVERED_NOTICE = "Follow-up fee already covered for this inquiry.";
export const QUOTE_LISTING_PUBLIC_LINE = `${platformFee(QUOTE_LISTING_CENTS, QUOTE_FEE_CURRENCY)} per published listing per month`;
export const QUOTE_FOLLOWUP_PUBLIC_LINE = `${followupAmount} per inquiry when you first send a follow-up through Twigigi`;
export const QUOTE_FOLLOWUP_INCLUDED_LINE = "Further follow-ups for that inquiry are included.";

export function quoteFollowupRules() {
  return [
    "Receiving quote requests is included in your listing subscription.",
    `A one-time ${followupAmount} fee applies when you first send a site visit invitation, quote, or invoice through Twigigi for an inquiry.`,
    "Further follow-ups for the same inquiry are included.",
    "Follow-up fees are added to your next billing statement.",
  ];
}

export function quoteListingRateLine(cents: number, currency: string) {
  return `${platformFee(cents, currency)} per published listing per month.`;
}

export function quoteBillingAnchor(now: string, existing = 0): 15 | 28 {
  if (existing === 15 || existing === 28) return existing;
  const date = businessDate(now);
  return date ? anchorDay(date.day) : 15;
}

export function quoteRenewalLine(cents: number, currency: string, anchor: 15 | 28) {
  return `Renews at ${platformFee(cents, currency)} on the ${anchor === 15 ? "15th" : "28th"} of each month.`;
}

export function quotePublishOffer(input: {
  now: string;
  anchorDay?: number;
  settings?: { listingRateCents: number; listingCurrency: string } | null;
}) {
  const charge = previewQuoteListingCharge(input.settings ?? null);
  return { cents: charge.cents, currency: charge.currency, anchor: quoteBillingAnchor(input.now, input.anchorDay ?? 0) };
}

export function quoteFeeExample() {
  const listing = platformFee(QUOTE_LISTING_CENTS, QUOTE_FEE_CURRENCY);
  const followups = platformFee(QUOTE_FOLLOWUP_CENTS * 5, QUOTE_FEE_CURRENCY);
  const total = platformFee(QUOTE_LISTING_CENTS + QUOTE_FOLLOWUP_CENTS * 5, QUOTE_FEE_CURRENCY);
  return `Example: 1 listing (${listing}) + first follow-ups on 5 inquiries (${followups}) = ${total} before tax. This assumes the next bill includes that listing renewal and these follow-up fees.`;
}

export type QuoteTool = "visit" | "offer" | "invoice";

export function followupEventKey(quoteId: string) {
  return `followup|${quoteId}`;
}

export function previewQuoteListingCharge(settings: { listingRateCents: number; listingCurrency: string } | null) {
  if (settings && settings.listingRateCents > 0) return quoteListingCharge(settings.listingRateCents, settings.listingCurrency);
  return quoteListingCharge(QUOTE_LISTING_CENTS, QUOTE_FEE_CURRENCY);
}

export function quoteListingCharge(rateCents: number, currency: string) {
  const cents = rateCents > 0 ? rateCents : QUOTE_LISTING_CENTS;
  const code = currency === "USD" || currency === "CAD" ? currency : QUOTE_FEE_CURRENCY;
  return {
    cents,
    currency: cents === QUOTE_LISTING_CENTS ? QUOTE_FEE_CURRENCY : code,
    legacy: cents !== QUOTE_LISTING_CENTS,
  };
}

export function publicBusinessName(input: { skipped: boolean; businessName: string; displayName: string }) {
  if (input.skipped || !input.businessName.trim()) return input.displayName;
  return input.businessName.trim();
}
