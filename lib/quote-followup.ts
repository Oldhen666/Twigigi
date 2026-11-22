export const QUOTE_LISTING_CENTS = 499;
export const QUOTE_LEGACY_LISTING_CENTS = 149;
export const QUOTE_FOLLOWUP_CENTS = 50;
export const QUOTE_FEE_CURRENCY = "CAD";

export const FOLLOWUP_FEE_NOTICE =
  "A one-time C$0.50 CAD follow-up fee will be added to your next bill. Additional follow-ups for this inquiry are included.";
export const FOLLOWUP_COVERED_NOTICE = "Follow-up fee already covered";

export type QuoteTool = "visit" | "offer" | "invoice";

export function followupEventKey(quoteId: string) {
  return `followup|${quoteId}`;
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
