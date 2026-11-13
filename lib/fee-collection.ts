export type FeeBill = {
  id: string;
  kind: string;
  currency: string;
  amountCents: number;
  status: string;
  collectionId?: string;
  periodKey?: string;
};

const OPEN_STATUSES = new Set(["pending", "accrued", "due", "recorded"]);

export function isOpenFee(status: string) {
  return OPEN_STATUSES.has(status);
}

export function listingCycleKey(userId: string, currency: string, periodKeys: string[], attemptId: string) {
  const periods = [...periodKeys].filter(Boolean).sort().join("_");
  return `listing-cycle-${userId}-${currency}-${periods}-${attemptId}`;
}

export function previewCollections(bills: FeeBill[]) {
  const open = bills.filter((bill) => isOpenFee(bill.status) && !bill.collectionId);
  const currencies = [...new Set(open.filter((bill) => bill.kind === "listing").map((bill) => bill.currency))];
  return currencies
    .map((currency) => {
      const listings = open.filter((bill) => bill.kind === "listing" && bill.currency === currency);
      const quotes = open.filter((bill) => bill.kind === "quote" && bill.currency === currency);
      const rows = [...listings, ...quotes];
      return {
        currency,
        billIds: rows.map((bill) => bill.id),
        listingCents: listings.reduce((sum, bill) => sum + bill.amountCents, 0),
        quoteCents: quotes.reduce((sum, bill) => sum + bill.amountCents, 0),
        totalCents: rows.reduce((sum, bill) => sum + bill.amountCents, 0),
        periodKeys: listings.map((bill) => bill.periodKey || "").filter(Boolean),
      };
    })
    .filter((plan) => plan.listingCents > 0);
}

export function outstandingCents(bills: FeeBill[], currency: string) {
  return bills
    .filter((bill) => bill.currency === currency && bill.status !== "paid" && bill.status !== "void" && (isOpenFee(bill.status) || bill.status === "processing"))
    .reduce((sum, bill) => sum + bill.amountCents, 0);
}
