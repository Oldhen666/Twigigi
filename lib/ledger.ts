export const STRIPE_FEE_BPS = 290;
export const STRIPE_FEE_FIXED_CENTS = 30;
export const TWIGIGI_FEE_CENTS = 100;

export type LedgerAccount = "cardholder" | "processor" | "stripe" | "operating" | "safeguarded" | "transit" | "external";
export type LedgerEntryType = "PAYMENT" | "STRIPE_FEE" | "TWIGIGI_FEE" | "SELLER_PAYABLE" | "PAYOUT" | "PAYOUT_COMPLETED" | "DISPUTE_OPENED" | "DISPUTE_CLOSED";
export type MoneyBucket = "protected" | "available" | "transit" | "paid";
export type OwnerKind = "buyer" | "processor" | "platform" | "seller";

export type PaymentSplit = {
  buyerPaidCents: number;
  stripeFeeCents: number;
  twigigiFeeCents: number;
  sellerNetCents: number;
};

export type LedgerDraft = {
  account: LedgerAccount;
  entryType: LedgerEntryType;
  amountCents: number;
  ownerKind: OwnerKind;
  availableAt: string | null;
  memo: string;
};

export function splitPayment(buyerPaidCents: number): PaymentSplit {
  const paid = Math.max(0, Math.round(buyerPaidCents));
  const stripeFeeCents = Math.min(paid, Math.round((paid * STRIPE_FEE_BPS) / 10000) + STRIPE_FEE_FIXED_CENTS);
  const afterStripe = paid - stripeFeeCents;
  const twigigiFeeCents = Math.min(TWIGIGI_FEE_CENTS, afterStripe);
  return {
    buyerPaidCents: paid,
    stripeFeeCents,
    twigigiFeeCents,
    sellerNetCents: afterStripe - twigigiFeeCents,
  };
}

export function paymentJournal(split: PaymentSplit, releaseAt: string | null): LedgerDraft[] {
  const lines: LedgerDraft[] = [
    { account: "cardholder", entryType: "PAYMENT", amountCents: -split.buyerPaidCents, ownerKind: "buyer", availableAt: null, memo: "Buyer paid" },
    { account: "processor", entryType: "PAYMENT", amountCents: split.buyerPaidCents, ownerKind: "processor", availableAt: null, memo: "Buyer payment received by the processor" },
    { account: "processor", entryType: "STRIPE_FEE", amountCents: -split.stripeFeeCents, ownerKind: "processor", availableAt: null, memo: "Processing fee leaves the processor" },
    { account: "stripe", entryType: "STRIPE_FEE", amountCents: split.stripeFeeCents, ownerKind: "processor", availableAt: null, memo: "Processing fee kept by Stripe" },
    { account: "processor", entryType: "TWIGIGI_FEE", amountCents: -split.twigigiFeeCents, ownerKind: "platform", availableAt: null, memo: "Twigigi fee leaves the processor" },
    { account: "operating", entryType: "TWIGIGI_FEE", amountCents: split.twigigiFeeCents, ownerKind: "platform", availableAt: null, memo: "Twigigi fee in the operating account" },
    { account: "processor", entryType: "SELLER_PAYABLE", amountCents: -split.sellerNetCents, ownerKind: "seller", availableAt: releaseAt, memo: "Seller funds leave the processor" },
    { account: "safeguarded", entryType: "SELLER_PAYABLE", amountCents: split.sellerNetCents, ownerKind: "seller", availableAt: releaseAt, memo: "Seller funds held in the safeguarded account" },
  ];
  return lines;
}

export function payoutJournal(sellerNetCents: number): LedgerDraft[] {
  return [
    { account: "safeguarded", entryType: "PAYOUT", amountCents: -sellerNetCents, ownerKind: "seller", availableAt: null, memo: "Seller payout leaves safeguarded funds" },
    { account: "transit", entryType: "PAYOUT", amountCents: sellerNetCents, ownerKind: "seller", availableAt: null, memo: "Seller payout is on the way" },
  ];
}

export function payoutCompletedJournal(sellerNetCents: number): LedgerDraft[] {
  return [
    { account: "transit", entryType: "PAYOUT_COMPLETED", amountCents: -sellerNetCents, ownerKind: "seller", availableAt: null, memo: "Payout left transit" },
    { account: "external", entryType: "PAYOUT_COMPLETED", amountCents: sellerNetCents, ownerKind: "seller", availableAt: null, memo: "Paid out to the seller" },
  ];
}

export function journalBalances(lines: Array<{ amountCents: number }>) {
  return lines.reduce((sum, line) => sum + line.amountCents, 0);
}

export function moneyBucket(input: {
  paid: boolean;
  disputeOpen: boolean;
  payoutCreatedAt: string | null;
  payoutCompletedAt: string | null;
  payoutEligibleAt: string | null;
  now: number;
}): MoneyBucket | null {
  if (!input.paid) return null;
  if (input.payoutCompletedAt) return "paid";
  if (input.payoutCreatedAt) return "transit";
  if (input.disputeOpen) return "protected";
  if (input.payoutEligibleAt && Date.parse(input.payoutEligibleAt) <= input.now) return "available";
  return "protected";
}

export const BUCKET_LABEL: Record<MoneyBucket, string> = {
  protected: "Protected",
  available: "Available",
  transit: "On the way",
  paid: "Paid out",
};

export const ACCOUNT_LABEL: Record<LedgerAccount, string> = {
  cardholder: "Buyer",
  processor: "Processor",
  stripe: "Stripe",
  operating: "Twigigi operating account",
  safeguarded: "Safeguarded funds",
  transit: "On the way",
  external: "Paid out",
};
