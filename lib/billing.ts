import { nextBillingDate, periodStart } from "@/lib/format";

export type BillingMethod = "card" | "paypal" | "stripe";

export function twigMonthlyCents() {
  const raw = process.env.TWIG_MONTHLY_CENTS?.trim();
  if (!raw) return null;
  const cents = Number(raw);
  if (!Number.isInteger(cents) || cents <= 0) return null;
  return cents;
}

export function isBillingMethod(value: string): value is BillingMethod {
  return value === "card" || value === "paypal" || value === "stripe";
}

export function billingMethodLabel(method: string) {
  if (method === "card") return "Credit card";
  if (method === "paypal") return "PayPal";
  if (method === "stripe") return "Stripe";
  return "";
}

export function activeWindow(startedAt: string | null, now = new Date()) {
  const end = nextBillingDate(now);
  const monthStart = periodStart(now);
  const started = startedAt ? Date.parse(startedAt) : Number.NaN;
  const start =
    Number.isFinite(started) && started > Date.parse(monthStart) && started < Date.parse(end) ? startedAt || monthStart : monthStart;
  return { start, end };
}
