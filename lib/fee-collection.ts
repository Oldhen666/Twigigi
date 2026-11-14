export type FeeBill = {
  id: string;
  kind: string;
  currency: string;
  amountCents: number;
  status: string;
  collectionId?: string;
  periodKey?: string;
  dueAt?: string;
};

const OPEN_STATUSES = new Set(["pending", "accrued", "due", "recorded"]);

export function isOpenFee(status: string) {
  return OPEN_STATUSES.has(status);
}

export function listingCycleKey(userId: string, currency: string, periodKeys: string[], attemptId: string) {
  const periods = [...periodKeys].filter(Boolean).sort().join("_");
  return `listing-cycle-${userId}-${currency}-${periods}-${attemptId}`;
}

function dueSortKey(bill: FeeBill) {
  return bill.dueAt || bill.periodKey || "9999-99-99";
}

export function previewCollections(bills: FeeBill[]) {
  const open = bills.filter((bill) => isOpenFee(bill.status) && !bill.collectionId);
  const listings = open.filter((bill) => bill.kind === "listing");
  const groups = new Map<string, FeeBill[]>();
  for (const bill of listings) {
    const key = `${bill.currency}|${dueSortKey(bill)}`;
    groups.set(key, [...(groups.get(key) || []), bill]);
  }
  const byCurrency = new Map<string, string[]>();
  for (const key of groups.keys()) {
    const currency = key.split("|")[0] || "";
    byCurrency.set(currency, [...(byCurrency.get(currency) || []), key].sort());
  }
  return [...byCurrency.entries()].flatMap(([currency, keys]) => {
    const quotes = open.filter((bill) => bill.kind === "quote" && bill.currency === currency);
    return keys.map((key, index) => {
      const rows = groups.get(key) || [];
      const attached = index === 0 ? quotes : [];
      const combined = [...rows, ...attached];
      return {
        currency,
        billIds: combined.map((bill) => bill.id),
        listingCents: rows.reduce((sum, bill) => sum + bill.amountCents, 0),
        quoteCents: attached.reduce((sum, bill) => sum + bill.amountCents, 0),
        totalCents: combined.reduce((sum, bill) => sum + bill.amountCents, 0),
        periodKeys: rows.map((bill) => bill.periodKey || bill.dueAt || "").filter(Boolean),
      };
    });
  }).filter((plan) => plan.listingCents > 0);
}

export function outstandingCents(bills: FeeBill[], currency: string) {
  return bills
    .filter((bill) => bill.currency === currency && bill.status !== "paid" && bill.status !== "void" && (isOpenFee(bill.status) || bill.status === "processing"))
    .reduce((sum, bill) => sum + bill.amountCents, 0);
}
