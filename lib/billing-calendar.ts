export const BILLING_TIME_ZONE = "America/Edmonton";

export type AnchorDay = 15 | 28;

export type BusinessDate = { year: number; month: number; day: number };

const dateFormat = new Intl.DateTimeFormat("en-US", {
  timeZone: BILLING_TIME_ZONE,
  hourCycle: "h23",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

function partsOf(instant: Date) {
  const parts = Object.fromEntries(dateFormat.formatToParts(instant).map((part) => [part.type, part.value]));
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    second: Number(parts.second),
  };
}

function offsetMs(instant: Date) {
  const parts = partsOf(instant);
  const zoned = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
  return zoned - instant.getTime();
}

export function businessDate(iso: string): BusinessDate | null {
  const time = Date.parse(iso);
  if (!Number.isFinite(time)) return null;
  const parts = partsOf(new Date(time));
  return { year: parts.year, month: parts.month, day: parts.day };
}

export function dateKey(date: BusinessDate) {
  return `${date.year}-${String(date.month).padStart(2, "0")}-${String(date.day).padStart(2, "0")}`;
}

export function anchorDay(day: number): AnchorDay {
  return day <= 15 ? 15 : 28;
}

export function billingInstant(key: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key);
  if (!match) return "";
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  let utc = Date.UTC(year, month - 1, day, 7, 0, 0);
  for (let pass = 0; pass < 3; pass += 1) {
    utc = Date.UTC(year, month - 1, day, 0, 0, 0) - offsetMs(new Date(utc));
  }
  return new Date(utc).toISOString();
}

export function shiftMonth(date: BusinessDate, months: number): BusinessDate {
  const index = date.year * 12 + (date.month - 1) + months;
  return { year: Math.floor(index / 12), month: (index % 12) + 1, day: date.day };
}

export function secondBillingKey(publishedAt: string) {
  const date = businessDate(publishedAt);
  if (!date) return "";
  const next = shiftMonth({ ...date, day: anchorDay(date.day) }, 1);
  return dateKey(next);
}

export function nextBillingKey(dueKey: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dueKey);
  if (!match) return "";
  const next = shiftMonth({ year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) }, 1);
  return dateKey(next);
}

export function firstCoverage(paidAt: string) {
  const date = businessDate(paidAt);
  if (!date) return null;
  const anchor = anchorDay(date.day);
  const periodEndKey = secondBillingKey(paidAt);
  return {
    anchor,
    periodKey: "",
    periodStart: paidAt,
    periodEnd: billingInstant(periodEndKey),
    dueAt: paidAt,
  };
}

export function formatBillingDate(value: string) {
  const key = /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : dateKey(businessDate(value) || { year: 0, month: 0, day: 0 });
  const instant = /^\d{4}-\d{2}-\d{2}$/.test(value) ? billingInstant(value) : value;
  const time = Date.parse(instant);
  if (!Number.isFinite(time) || key.startsWith("0-")) return "";
  return new Intl.DateTimeFormat("en-US", {
    timeZone: BILLING_TIME_ZONE,
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(time));
}

export function shouldAccrueNextPeriod(input: {
  status: string;
  billingStatus?: string;
  anchorDay?: number;
  paidUntil?: string | null;
  now: string;
}) {
  if (input.status !== "published") return false;
  if (input.anchorDay !== 15 && input.anchorDay !== 28) return false;
  if (input.billingStatus === "paused" || input.billingStatus === "canceled" || input.billingStatus === "legacy_review") return false;
  const due = Date.parse(input.paidUntil || "");
  const now = Date.parse(input.now);
  return Number.isFinite(due) && Number.isFinite(now) && due <= now;
}

const OPEN_FEE = new Set(["pending", "accrued", "due", "recorded", "processing"]);

export function settlementView(input: {
  products: Array<{ currency: string; anchorDay: number; paidUntil: string; status: string; billingStatus: string }>;
  bills: Array<{ currency: string; amountCents: number; status: string; dueAt: string }>;
}) {
  const currencies = new Set<string>();
  for (const product of input.products) if (product.currency) currencies.add(product.currency);
  for (const bill of input.bills) if (bill.currency) currencies.add(bill.currency);
  const rows = [...currencies].map((currency) => {
    const bills = input.bills.filter((bill) => bill.currency === currency);
    const balanceCents = bills
      .filter((bill) => bill.status !== "paid" && bill.status !== "void" && OPEN_FEE.has(bill.status))
      .reduce((sum, bill) => sum + bill.amountCents, 0);
    const dates = new Set<string>();
    for (const product of input.products) {
      if (product.currency !== currency || product.status !== "published") continue;
      if (product.anchorDay !== 15 && product.anchorDay !== 28) continue;
      if (product.billingStatus === "canceled" || product.billingStatus === "legacy_review") continue;
      const date = businessDate(product.paidUntil);
      if (date) dates.add(dateKey(date));
    }
    for (const bill of bills) {
      if (bill.status === "paid" || bill.status === "void" || !OPEN_FEE.has(bill.status)) continue;
      const date = /^\d{4}-\d{2}-\d{2}/.test(bill.dueAt) ? businessDate(bill.dueAt) : null;
      if (date) dates.add(dateKey(date));
    }
    const batches = [...dates].sort().map((date) => ({
      date,
      label: formatBillingDate(date),
      unpaidCents: bills
        .filter((bill) => {
          const due = businessDate(bill.dueAt);
          return due && dateKey(due) === date && bill.status !== "paid" && bill.status !== "void" && OPEN_FEE.has(bill.status);
        })
        .reduce((sum, bill) => sum + bill.amountCents, 0),
    }));
    return { currency, balanceCents, batches };
  });
  return rows;
}

export function nextPeriodBill(input: { paidUntil: string }) {
  const date = businessDate(input.paidUntil);
  if (!date) return null;
  const dueKey = dateKey(date);
  const endKey = nextBillingKey(dueKey);
  return {
    periodKey: dueKey,
    periodStart: input.paidUntil,
    periodEnd: billingInstant(endKey),
    dueAt: input.paidUntil,
  };
}
