import { listingFeeCents, listingFeeCurrency } from "@/lib/billing";
import {
  enqueueBillingNotice,
  findUserById,
  hasListingBillForPeriod,
  listFeeListings,
  listGraceEndingSoon,
  listOpenFeeBills,
  listUserIdsWithFees,
  pauseExpiredGrace,
  recordTwigBill,
} from "@/lib/db";
import { previewCollections } from "@/lib/fee-collection";
import { renewPaidUntil, shouldRenewListing } from "@/lib/listing-cycle";
import type { User } from "@/lib/types";

export type FeePlan = {
  currency: string;
  dueCents: number;
  billIds: string[];
};

function feeId() {
  const bytes = crypto.getRandomValues(new Uint8Array(9));
  return `bill_${Buffer.from(bytes).toString("base64url")}`;
}

export function prepareRenewalBills(userId: string, now = new Date()) {
  const paused = pauseExpiredGrace(now.toISOString());
  for (const product of paused) {
    const title = product.title.replace(/\s+/g, " ").trim().slice(0, 80) || "A listing";
    enqueueBillingNotice({
      userId: product.userId,
      kind: "paused",
      dedupeKey: `paused:${product.id}`,
      subject: "A Twigigi listing is paused",
      body: `${title} stopped taking new paid orders because the 72-hour grace period ended. Other paid listings were not paused.`,
    });
  }
  const soonUntil = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();
  for (const product of listGraceEndingSoon(now.toISOString(), soonUntil)) {
    const title = product.title.replace(/\s+/g, " ").trim().slice(0, 80) || "A listing";
    enqueueBillingNotice({
      userId: product.userId,
      kind: "pause_soon",
      dedupeKey: `pause-soon:${product.id}:${product.graceUntil}`,
      subject: "A Twigigi listing will pause soon",
      body: `${title} is inside its 72-hour grace period. Pay before it ends to keep the current cycle.`,
    });
  }
  for (const product of listFeeListings(userId)) {
    if (listingFeeCents(product.cta, product.feeExempt) < 1 || !shouldRenewListing(product, now.getTime())) continue;
    const periodKey = product.paidUntil || "";
    if (!periodKey || hasListingBillForPeriod(product.id, periodKey)) continue;
    recordTwigBill({
      id: feeId(),
      userId,
      productId: product.id,
      amountCents: listingFeeCents(product.cta),
      currency: product.billingCurrency || listingFeeCurrency(product.cta, product.location),
      method: "",
      kind: "listing",
      periodStart: periodKey,
      periodEnd: renewPaidUntil(periodKey),
      status: "due",
      billingPeriodKey: periodKey,
      dueAt: periodKey,
    });
  }
}

export function plansFor(userId: string): FeePlan[] {
  const open = listOpenFeeBills(userId);
  return previewCollections(open.map((bill) => ({
    id: bill.id,
    kind: bill.kind,
    currency: bill.currency,
    amountCents: bill.amountCents,
    status: bill.status,
    periodKey: "",
  }))).map((plan) => ({ currency: plan.currency, dueCents: plan.totalCents, billIds: plan.billIds }));
}

export async function collectSellerFees(user: User) {
  prepareRenewalBills(user.id);
  return { charged: 0, open: plansFor(user.id) };
}

export async function collectDueSellerFees() {
  let users = 0;
  for (const id of listUserIdsWithFees()) {
    const user = findUserById(id);
    if (!user) continue;
    await collectSellerFees(user);
    users += 1;
  }
  return { users };
}

