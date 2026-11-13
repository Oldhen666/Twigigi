export const LISTING_PERIOD_MS = 30 * 24 * 60 * 60 * 1000;
export const GRACE_MS = 72 * 60 * 60 * 1000;

export type ListingBillingStatus = "active" | "grace" | "paused" | "canceled" | "legacy_review" | "";

export function addUtc(iso: string, ms: number) {
  const time = Date.parse(iso);
  if (!Number.isFinite(time)) return "";
  return new Date(time + ms).toISOString();
}

export function firstPaidUntil(paidAt: string) {
  return addUtc(paidAt, LISTING_PERIOD_MS);
}

export function renewPaidUntil(paidUntil: string) {
  return addUtc(paidUntil, LISTING_PERIOD_MS);
}

export function graceDeadline(failedAt: string) {
  return addUtc(failedAt, GRACE_MS);
}

export function listingPeriodKey(cycleStart: string) {
  return cycleStart;
}

export function listingAcceptsOrders(
  product: {
    status: string;
    billingStatus?: string;
    graceUntil?: string | null;
    paidUntil?: string | null;
    autoRenew?: boolean;
    moderationStatus?: string;
    deactivatesAt?: string | null;
  },
  now = Date.now(),
) {
  if (product.moderationStatus === "restricted") return false;
  if (product.status !== "published") return false;
  if (product.billingStatus === "paused" || product.billingStatus === "canceled") return false;
  if (product.billingStatus === "grace") {
    const ends = Date.parse(product.graceUntil || "");
    if (!Number.isFinite(ends) || ends <= now) return false;
  }
  if (product.billingStatus === "active" && product.autoRenew === false) {
    const until = Date.parse(product.paidUntil || "");
    if (Number.isFinite(until) && until <= now) return false;
  }
  if (!product.deactivatesAt) return true;
  const ends = Date.parse(product.deactivatesAt);
  return Number.isFinite(ends) && ends > now;
}

export function listingCoversNow(
  product: {
    ctaFee: number;
    feeExempt?: boolean;
    billingStatus?: string;
    paidUntil?: string | null;
    graceUntil?: string | null;
  },
  now = Date.now(),
) {
  if (product.feeExempt || product.ctaFee < 1) return true;
  if (product.billingStatus === "legacy_review") return true;
  if (product.billingStatus === "paused" || product.billingStatus === "canceled") return false;
  if (product.billingStatus === "grace") {
    const ends = Date.parse(product.graceUntil || "");
    return Number.isFinite(ends) && ends > now;
  }
  const until = Date.parse(product.paidUntil || "");
  return Number.isFinite(until) && until > now;
}

export function shouldRenewListing(
  product: {
    feeExempt?: boolean;
    billingStatus?: string;
    autoRenew?: boolean;
    paidUntil?: string | null;
  },
  now = Date.now(),
) {
  if (product.feeExempt) return false;
  if (product.billingStatus === "legacy_review" || product.billingStatus === "canceled" || product.billingStatus === "paused") return false;
  if (!product.autoRenew && product.billingStatus !== "grace") return false;
  const until = Date.parse(product.paidUntil || "");
  return Number.isFinite(until) && until <= now;
}

export function afterRenewalFailure<T extends { billingStatus?: string; graceUntil?: string | null }>(product: T, failedAt: string) {
  if (product.billingStatus === "grace" || product.billingStatus === "paused") return product;
  return { ...product, billingStatus: "grace" as const, graceUntil: graceDeadline(failedAt) };
}

export function afterGraceElapsed<T extends { billingStatus?: string; graceUntil?: string | null }>(product: T, now = Date.now()) {
  if (product.billingStatus !== "grace") return product;
  const ends = Date.parse(product.graceUntil || "");
  if (!Number.isFinite(ends) || ends > now) return product;
  return { ...product, billingStatus: "paused" as const };
}

export function paidUntilAfterPayment(input: {
  paidUntil?: string | null;
  billingStatus?: string;
  graceUntil?: string | null;
  autoRenew?: boolean;
  paidAt: string;
}) {
  const current = input.paidUntil || "";
  const status = input.billingStatus || "";
  const paidAtMs = Date.parse(input.paidAt);
  const untilMs = Date.parse(current);
  const graceMs = Date.parse(input.graceUntil || "");
  const hasCycle = Boolean(current) && Number.isFinite(untilMs) && status !== "legacy_review";
  const expired = hasCycle && untilMs <= paidAtMs;
  const graceOpen = status === "grace" && Number.isFinite(graceMs) && graceMs > paidAtMs;
  const graceOver = status === "grace" && (!Number.isFinite(graceMs) || graceMs <= paidAtMs);
  const restart =
    !hasCycle ||
    status === "paused" ||
    status === "canceled" ||
    graceOver ||
    (status === "active" && expired && input.autoRenew === false);
  if (restart) {
    return {
      mode: hasCycle ? ("restart" as const) : ("first" as const),
      paidUntil: firstPaidUntil(input.paidAt),
      periodKey: input.paidAt,
    };
  }
  if (graceOpen || status === "active" || status === "") {
    return {
      mode: "extend" as const,
      paidUntil: renewPaidUntil(current),
      periodKey: current,
    };
  }
  return {
    mode: "first" as const,
    paidUntil: firstPaidUntil(input.paidAt),
    periodKey: input.paidAt,
  };
}

export function chargePeriodKey(
  product: { id: string; paidUntil?: string | null; billingStatus?: string; graceUntil?: string | null; autoRenew?: boolean },
  nowIso: string,
) {
  const next = paidUntilAfterPayment({ ...product, paidAt: nowIso });
  if (next.mode === "extend") return product.paidUntil || "";
  if (next.mode === "restart") return `restart:${product.id}`;
  return `first:${product.id}`;
}

export function afterRenewalPaid<T extends { paidUntil?: string | null; billingStatus?: string; graceUntil?: string | null }>(
  product: T,
  paidAt?: string,
) {
  const next = paidUntilAfterPayment({ ...product, paidAt: paidAt || product.paidUntil || "" });
  return { ...product, paidUntil: next.paidUntil, nextRenewalAt: next.paidUntil, graceUntil: "", billingStatus: "active" as const, mode: next.mode };
}
