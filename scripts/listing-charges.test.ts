import assert from "node:assert/strict";
import test from "node:test";
import { billingInstant } from "../lib/billing-calendar.ts";
import { outstandingCents } from "../lib/fee-collection.ts";
import { listingChargeView, type ListingChargeBill, type ListingChargeSource } from "../lib/listing-charges.ts";

function listing(overrides: Partial<ListingChargeSource> = {}): ListingChargeSource {
  return {
    id: "prd_a",
    title: "Planter",
    currency: "CAD",
    feeExempt: false,
    paidUntil: "",
    anchorDay: 0,
    status: "published",
    billingStatus: "legacy_review",
    ...overrides,
  };
}

function bill(overrides: Partial<ListingChargeBill> = {}): ListingChargeBill {
  return {
    productId: "prd_a",
    title: "Planter",
    kind: "listing",
    currency: "CAD",
    amountCents: 149,
    status: "due",
    dueAt: "",
    periodKey: "",
    ...overrides,
  };
}

test("a Twig with no created fee shows 0 instead of the catalog price", () => {
  const [currency] = listingChargeView({ listings: [listing()], bills: [] });
  assert.equal(currency.balanceCents, 0);
  assert.equal(currency.next?.key, "unscheduled");
  assert.equal(currency.next?.rows[0].listingCents, 0);
  assert.equal(currency.next?.rows[0].quoteCents, 0);
  assert.equal(currency.next?.rows[0].totalCents, 0);
  assert.equal(currency.next?.rows[0].status, "Not billed");
});

test("a waived listing is labeled Waived and adds nothing to the total", () => {
  const [currency] = listingChargeView({ listings: [listing({ feeExempt: true })], bills: [] });
  const row = currency.next?.rows[0];
  assert.equal(row?.listingWaived, true);
  assert.equal(row?.listingCents, 0);
  assert.equal(row?.totalCents, 0);
  assert.equal(row?.status, "Waived");
});

test("one batch adds unpaid listing and quote fees and leaves paid fees out", () => {
  const quotes = [1, 2, 3].map((index) => bill({
    productId: "prd_a",
    kind: "quote",
    amountCents: 25,
    status: "pending",
    dueAt: "",
  }));
  const bills = [
    bill({ dueAt: "2026-12-15", periodKey: "2026-12-15" }),
    bill({ amountCents: 149, status: "paid", dueAt: "2026-11-15", periodKey: "2026-11-15" }),
    ...quotes,
  ];
  const [currency] = listingChargeView({ listings: [listing()], bills });
  const row = currency.next?.rows[0];
  assert.equal(currency.next?.key, "2026-12-15");
  assert.equal(row?.listingCents, 149);
  assert.equal(row?.quoteCents, 75);
  assert.equal(row?.quoteCount, 3);
  assert.equal(row?.totalCents, 224);
  assert.equal(row?.status, "Unpaid");
  assert.equal(currency.balanceCents, 224);
  assert.equal(currency.balanceCents, outstandingCents(bills, "CAD"));
});

test("different due dates stay in separate batches", () => {
  const bills = [
    bill({ dueAt: billingInstant("2026-12-28"), periodKey: "2026-12-28" }),
    bill({ dueAt: billingInstant("2026-12-15"), periodKey: "2026-12-15" }),
  ];
  const [currency] = listingChargeView({ listings: [listing()], bills });
  assert.equal(currency.next?.key, "2026-12-15");
  assert.equal(currency.next?.totalCents, 149);
  assert.equal(currency.others[0]?.key, "2026-12-28");
  assert.equal(currency.others[0]?.totalCents, 149);
  assert.equal(currency.balanceCents, 298);
});

test("quote fees follow the earliest unpaid listing batch and currencies stay separate", () => {
  const listings = [
    listing({ id: "prd_a", title: "Cedar", currency: "CAD" }),
    listing({ id: "prd_b", title: "Bench", currency: "CAD" }),
    listing({ id: "prd_c", title: "File", currency: "USD" }),
  ];
  const bills = [
    bill({ productId: "prd_a", dueAt: "2026-12-15", periodKey: "2026-12-15" }),
    bill({ productId: "prd_b", dueAt: "2026-12-28", periodKey: "2026-12-28" }),
    bill({ productId: "prd_b", kind: "quote", amountCents: 25, status: "pending", dueAt: "" }),
    bill({ productId: "prd_c", currency: "USD", amountCents: 149, dueAt: "2026-12-28", periodKey: "2026-12-28" }),
  ];
  const view = listingChargeView({ listings, bills });
  const cad = view.find((row) => row.currency === "CAD");
  const usd = view.find((row) => row.currency === "USD");
  const nextQuotes = cad?.next?.rows.find((row) => row.productId === "prd_b");
  const later = cad?.others.find((batch) => batch.key === "2026-12-28")?.rows.find((row) => row.productId === "prd_b");
  assert.equal(nextQuotes?.quoteCents, 25);
  assert.equal(nextQuotes?.quoteCount, 1);
  assert.equal(nextQuotes?.listingCents, 0);
  assert.equal(nextQuotes?.totalCents, 25);
  assert.equal(later?.listingCents, 149);
  assert.equal(later?.quoteCents, 0);
  assert.equal(usd?.balanceCents, 149);
  assert.equal(cad?.balanceCents, 149 + 149 + 25);
});

test("a future billing date with no bill stays at 0 while an unscheduled quote remains in the balance", () => {
  const listings = [listing({
    billingStatus: "active",
    anchorDay: 15,
    paidUntil: billingInstant("2026-12-15"),
  })];
  const bills = [bill({ kind: "quote", amountCents: 25, status: "pending" })];
  const [currency] = listingChargeView({ listings, bills });
  assert.equal(currency.next?.key, "2026-12-15");
  assert.equal(currency.next?.totalCents, 0);
  assert.equal(currency.next?.rows[0].listingCents, 0);
  assert.equal(currency.others[0]?.key, "unscheduled");
  assert.equal(currency.others[0]?.totalCents, 25);
  assert.equal(currency.balanceCents, 25);
});

test("a processing fee stays due and a paid fee does not", () => {
  const bills = [
    bill({ status: "processing", dueAt: "2026-12-15", periodKey: "2026-12-15" }),
    bill({ status: "paid", amountCents: 149, dueAt: "2026-11-15" }),
  ];
  const [currency] = listingChargeView({ listings: [listing()], bills });
  assert.equal(currency.next?.rows[0].status, "Processing");
  assert.equal(currency.next?.totalCents, 149);
  assert.equal(currency.balanceCents, 149);
});
