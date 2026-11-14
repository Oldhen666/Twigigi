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
  currency: string;
  listingCents: number;
  listingWaived: boolean;
  quoteCents: number;
  quoteCount: number;
  totalCents: number;
  billingDate: string;
  status: "Unpaid" | "Processing" | "Waived" | "Not billed";
};

export type ListingChargeBatch = {
  key: string;
  billingDate: string;
  rows: ListingChargeRow[];
  totalCents: number;
};

export type ListingChargeCurrency = {
  currency: string;
  balanceCents: number;
  next: ListingChargeBatch | null;
  others: ListingChargeBatch[];
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

function rowStatus(charges: ListingChargeBill[], listingCents: number, waived: boolean): ListingChargeRow["status"] {
  if (charges.length === 0 || (listingCents === 0 && charges.every((bill) => bill.kind !== "quote"))) return waived ? "Waived" : "Not billed";
  if (charges.every((bill) => bill.status === "processing")) return "Processing";
  return "Unpaid";
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
  const balanceCents = ownBills.filter(unpaid).reduce((sum, bill) => sum + bill.amountCents, 0);
  const listingBills = ownBills.filter((bill) => bill.kind === "listing" && unpaid(bill));
  const quoteBills = ownBills.filter((bill) => bill.kind === "quote" && unpaid(bill));
  const payableDates = listingBills
    .map((bill) => batchKeyFrom(bill.dueAt) || batchKeyFrom(bill.periodKey))
    .filter(Boolean)
    .sort();
  const quoteBatch = payableDates[0] || "unscheduled";
  const drafts = new Map<string, Map<string, { listing: ListingChargeBill[]; quotes: ListingChargeBill[] }>>();

  const ensure = (batch: string, productId: string) => {
    const rows = drafts.get(batch) || new Map<string, { listing: ListingChargeBill[]; quotes: ListingChargeBill[] }>();
    const current = rows.get(productId) || { listing: [], quotes: [] };
    rows.set(productId, current);
    drafts.set(batch, rows);
    return current;
  };

  for (const bill of listingBills) {
    ensure(batchKeyFrom(bill.dueAt) || batchKeyFrom(bill.periodKey) || "unscheduled", bill.productId).listing.push(bill);
  }
  for (const bill of quoteBills) ensure(quoteBatch, bill.productId).quotes.push(bill);
  for (const listing of ownListings) {
    const date = scheduled(listing);
    if (date) ensure(date, listing.id);
  }
  for (const listing of ownListings) {
    const present = [...drafts.values()].some((rows) => rows.has(listing.id));
    if (!present) ensure("unscheduled", listing.id);
  }

  const batches = [...drafts.entries()]
    .map(([key, rows]) => {
      const built = [...rows.entries()]
        .map(([productId, draft]) => toRow(currency, key, productId, draft, ownListings, ownBills))
        .sort((left, right) => left.title.localeCompare(right.title));
      return {
        key,
        billingDate: key === "unscheduled" ? "" : formatBillingDate(key),
        rows: built,
        totalCents: built.reduce((sum, row) => sum + row.totalCents, 0),
      };
    })
    .filter((batch) => batch.rows.length > 0)
    .sort((left, right) => (left.key === "unscheduled" ? 1 : right.key === "unscheduled" ? -1 : left.key.localeCompare(right.key)));
  const next = batches.find((batch) => batch.key !== "unscheduled") || batches[0] || null;
  return {
    currency,
    balanceCents,
    next,
    others: next ? batches.filter((batch) => batch !== next) : [],
  };
}

function toRow(
  currency: string,
  batch: string,
  productId: string,
  draft: { listing: ListingChargeBill[]; quotes: ListingChargeBill[] },
  listings: ListingChargeSource[],
  bills: ListingChargeBill[],
): ListingChargeRow {
  const listing = listings.find((item) => item.id === productId);
  const listingCents = draft.listing.reduce((sum, bill) => sum + bill.amountCents, 0);
  const quoteCents = draft.quotes.reduce((sum, bill) => sum + bill.amountCents, 0);
  const waived = Boolean(listing?.feeExempt) && listingCents === 0;
  return {
    productId,
    title: listing?.title || bills.find((bill) => bill.productId === productId)?.title || "Removed Twig",
    currency,
    listingCents,
    listingWaived: waived,
    quoteCents,
    quoteCount: draft.quotes.length,
    totalCents: listingCents + quoteCents,
    billingDate: batch === "unscheduled" ? "" : formatBillingDate(batch),
    status: rowStatus([...draft.listing, ...draft.quotes], listingCents, waived),
  };
}
