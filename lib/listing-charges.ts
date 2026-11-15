import { listingFeeCents } from "./billing";
import { businessDate, dateKey, formatBillingDate } from "./billing-calendar";

const UNPAID = new Set(["pending", "accrued", "due", "recorded", "processing"]);

export type ListingChargeBill = {
  productId: string;
  title: string;
  kind: string;
  currency: string;
  amountCents: number;
  status: string;
  dueAt: string;
  periodKey: string;
};

export type ListingChargeSource = {
  id: string;
  title: string;
  cta: string;
  currency: string;
  feeExempt: boolean;
  paidUntil: string;
  anchorDay: number;
  status: string;
  billingStatus: string;
};

export type ListingChargeRow = {
  productId: string;
  title: string;
  cta: string;
  currency: string;
  nextFeeCents: number;
  nextFeeWaived: boolean;
  expiry: string;
  quoteCents: number;
  quoteCount: number;
  status: "Unpaid" | "Processing" | "Waived" | "Not scheduled";
};

export type ListingChargeCurrency = {
  currency: string;
  balanceCents: number;
  rows: ListingChargeRow[];
};

function batchKeyFrom(value: string) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const date = businessDate(value);
  return date ? dateKey(date) : "";
}

function unpaid(bill: ListingChargeBill) {
  return bill.status !== "paid" && bill.status !== "void" && UNPAID.has(bill.status);
}

function scheduled(listing: ListingChargeSource) {
  if (listing.status !== "published") return "";
  if (listing.anchorDay !== 15 && listing.anchorDay !== 28) return "";
  if (listing.billingStatus === "canceled" || listing.billingStatus === "legacy_review") return "";
  return batchKeyFrom(listing.paidUntil);
}

function dueKey(bill: ListingChargeBill) {
  return batchKeyFrom(bill.dueAt) || batchKeyFrom(bill.periodKey);
}

export function listingChargeView(input: { listings: ListingChargeSource[]; bills: ListingChargeBill[] }): ListingChargeCurrency[] {
  const currencies = new Set<string>();
  for (const listing of input.listings) if (listing.currency) currencies.add(listing.currency);
  for (const bill of input.bills) if (bill.currency) currencies.add(bill.currency);
  return [...currencies].sort().map((currency) => buildCurrency(currency, input.listings, input.bills));
}

function buildCurrency(currency: string, listings: ListingChargeSource[], bills: ListingChargeBill[]): ListingChargeCurrency {
  const ownListings = listings.filter((listing) => listing.currency === currency);
  const ownBills = bills.filter((bill) => bill.currency === currency);
  const ids = new Set(ownListings.map((listing) => listing.id));
  for (const bill of ownBills) ids.add(bill.productId);
  const rows = [...ids]
    .map((id) => toRow(currency, id, ownListings, ownBills))
    .sort((left, right) => left.title.localeCompare(right.title));
  return {
    currency,
    balanceCents: ownBills.filter(unpaid).reduce((sum, bill) => sum + bill.amountCents, 0),
    rows,
  };
}

function toRow(currency: string, productId: string, listings: ListingChargeSource[], bills: ListingChargeBill[]): ListingChargeRow {
  const listing = listings.find((item) => item.id === productId);
  const title = listing?.title || bills.find((bill) => bill.productId === productId)?.title || "Removed Twig";
  const cta = listing?.cta || "";
  const listingBills = bills
    .filter((bill) => bill.productId === productId && bill.kind === "listing" && unpaid(bill))
    .sort((left, right) => dueKey(left).localeCompare(dueKey(right)));
  const quotes = bills.filter((bill) => bill.productId === productId && bill.kind === "quote" && unpaid(bill));
  const nextBill = listingBills[0];
  const upcoming = listing ? scheduled(listing) : "";
  const waived = Boolean(listing?.feeExempt) && !nextBill;
  const nextFeeCents = nextBill
    ? nextBill.amountCents
    : waived || !listing
      ? 0
      : upcoming
        ? listingFeeCents(listing.cta, false)
        : 0;
  const expiryKey = nextBill ? dueKey(nextBill) : upcoming;
  const processing = Boolean(nextBill && listingBills.filter((bill) => dueKey(bill) === dueKey(nextBill)).every((bill) => bill.status === "processing"));
  const status: ListingChargeRow["status"] = waived
    ? "Waived"
    : processing
      ? "Processing"
      : nextFeeCents > 0
        ? "Unpaid"
        : "Not scheduled";
  return {
    productId,
    title,
    cta,
    currency,
    nextFeeCents,
    nextFeeWaived: waived,
    expiry: expiryKey ? formatBillingDate(expiryKey) : "",
    quoteCents: quotes.reduce((sum, bill) => sum + bill.amountCents, 0),
    quoteCount: quotes.length,
    status,
  };
}
