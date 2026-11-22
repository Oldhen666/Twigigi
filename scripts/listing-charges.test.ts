import assert from "node:assert/strict";
import test from "node:test";
import { billingInstant } from "../lib/billing-calendar.ts";
import { outstandingCents } from "../lib/fee-collection.ts";
import { listingChargeView, type ListingChargeBill, type ListingChargeSource } from "../lib/listing-charges.ts";

function listing(overrides: Partial<ListingChargeSource> = {}): ListingChargeSource {
  return {
    id: "prd_a",
    title: "Planter",
    cta: "buy",
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

test("a Twig with no created fee and no period shows no next fee", () => {
  const [currency] = listingChargeView({ listings: [listing()], bills: [] });
  const row = currency.rows[0];
  assert.equal(currency.balanceCents, 0);
  assert.equal(row.nextFeeCents, 0);
  assert.equal(row.quoteCents, 0);
  assert.equal(row.expiry, "");
  assert.equal(row.status, "Not scheduled");
});

test("a waived listing with no open bill is labeled Waived", () => {
  const [currency] = listingChargeView({ listings: [listing({ feeExempt: true })], bills: [] });
  const row = currency.rows[0];
  assert.equal(row.nextFeeWaived, true);
  assert.equal(row.nextFeeCents, 0);
  assert.equal(row.status, "Waived");
});

test("the next fee is the earliest unpaid listing bill, and quotes stay on that Twig", () => {
  const quotes = [1, 2, 3].map(() => bill({ kind: "quote", amountCents: 25, status: "pending", dueAt: "" }));
  const bills = [
    bill({ dueAt: "2026-12-15", periodKey: "2026-12-15" }),
    bill({ amountCents: 149, status: "paid", dueAt: "2026-11-15", periodKey: "2026-11-15" }),
    ...quotes,
  ];
  const [currency] = listingChargeView({ listings: [listing({ cta: "quote" })], bills });
  const row = currency.rows[0];
  assert.equal(row.nextFeeCents, 149);
  assert.equal(row.expiry, "Dec 15, 2026");
  assert.equal(row.quoteCents, 75);
  assert.equal(row.quoteCount, 3);
  assert.equal(row.status, "Unpaid");
  assert.equal(currency.balanceCents, 224);
  assert.equal(currency.balanceCents, outstandingCents(bills, "CAD"));
});

test("only the earliest unpaid listing fee is the next fee", () => {
  const bills = [
    bill({ dueAt: billingInstant("2026-12-28"), periodKey: "2026-12-28" }),
    bill({ dueAt: billingInstant("2026-12-15"), periodKey: "2026-12-15" }),
  ];
  const [currency] = listingChargeView({ listings: [listing()], bills });
  assert.equal(currency.rows[0].nextFeeCents, 149);
  assert.equal(currency.rows[0].expiry, "Dec 15, 2026");
  assert.equal(currency.balanceCents, 298);
});

test("quote fees stay with their Twig and currencies stay separate", () => {
  const listings = [
    listing({ id: "prd_a", title: "Cedar", cta: "buy", currency: "CAD" }),
    listing({ id: "prd_b", title: "Bench", cta: "quote", currency: "CAD" }),
    listing({ id: "prd_c", title: "File", cta: "file", currency: "USD" }),
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
  const bench = cad?.rows.find((row) => row.productId === "prd_b");
  assert.equal(bench?.nextFeeCents, 149);
  assert.equal(bench?.quoteCents, 25);
  assert.equal(bench?.quoteCount, 1);
  assert.equal(cad?.rows.find((row) => row.productId === "prd_a")?.quoteCount, 0);
  assert.equal(usd?.balanceCents, 149);
  assert.equal(cad?.balanceCents, 149 + 149 + 25);
});

test("a scheduled quote listing uses its locked price", () => {
  const listings = [listing({
    cta: "quote",
    billingStatus: "active",
    anchorDay: 15,
    paidUntil: billingInstant("2026-12-15"),
    listingCents: 499,
  })];
  const [currency] = listingChargeView({ listings, bills: [] });
  assert.equal(currency.rows[0].nextFeeCents, 499);
  assert.equal(currency.rows[0].rateCents, 499);
  assert.equal(currency.rows[0].quoteCents, 0);
});

test("a scheduled period shows the upcoming listing fee before the bill exists", () => {
  const listings = [listing({
    cta: "quote",
    billingStatus: "active",
    anchorDay: 15,
    paidUntil: billingInstant("2026-12-15"),
  })];
  const bills = [bill({ kind: "quote", amountCents: 25, status: "pending" })];
  const [currency] = listingChargeView({ listings, bills });
  const row = currency.rows[0];
  assert.equal(row.nextFeeCents, 149);
  assert.equal(row.expiry, "Dec 15, 2026");
  assert.equal(row.quoteCents, 25);
  assert.equal(row.quoteCount, 1);
  assert.equal(currency.balanceCents, 25);
});

test("a processing fee is the next fee and a paid fee is not", () => {
  const bills = [
    bill({ status: "processing", dueAt: "2026-12-15", periodKey: "2026-12-15" }),
    bill({ status: "paid", amountCents: 149, dueAt: "2026-11-15" }),
  ];
  const [currency] = listingChargeView({ listings: [listing()], bills });
  assert.equal(currency.rows[0].status, "Processing");
  assert.equal(currency.rows[0].nextFeeCents, 149);
  assert.equal(currency.balanceCents, 149);
});
