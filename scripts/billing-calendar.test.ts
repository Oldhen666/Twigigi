import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import {
  anchorDay,
  billingInstant,
  businessDate,
  dateKey,
  firstCoverage,
  nextBillingKey,
  nextPeriodBill,
  secondBillingKey,
  settlementView,
  shouldAccrueNextPeriod,
} from "../lib/billing-calendar.ts";
import { previewCollections } from "../lib/fee-collection.ts";
import { applyPaymentResult, stageFeeCollection } from "../lib/payment-ledger.ts";

function keyFor(iso: string) {
  const date = businessDate(iso);
  assert.ok(date);
  return dateKey(date);
}

test("publish days 1, 15, 16, 28, and month-end pick the next month settlement", () => {
  assert.equal(anchorDay(1), 15);
  assert.equal(anchorDay(15), 15);
  assert.equal(anchorDay(16), 28);
  assert.equal(anchorDay(28), 28);
  assert.equal(anchorDay(30), 28);
  assert.equal(secondBillingKey(billingInstant("2026-11-03")), "2026-12-15");
  assert.equal(secondBillingKey(billingInstant("2026-11-01")), "2026-12-15");
  assert.equal(secondBillingKey(billingInstant("2026-11-15")), "2026-12-15");
  assert.equal(secondBillingKey(billingInstant("2026-11-16")), "2026-12-28");
  assert.equal(secondBillingKey(billingInstant("2026-11-28")), "2026-12-28");
  assert.equal(secondBillingKey(billingInstant("2026-11-30")), "2026-12-28");
});

test("December, February, and a leap day stay on the 15th or 28th", () => {
  assert.equal(secondBillingKey(billingInstant("2026-12-15")), "2027-01-15");
  assert.equal(secondBillingKey(billingInstant("2026-12-28")), "2027-01-28");
  assert.equal(secondBillingKey(billingInstant("2026-12-31")), "2027-01-28");
  assert.equal(nextBillingKey("2027-01-28"), "2027-02-28");
  assert.equal(nextBillingKey("2027-02-28"), "2027-03-28");
  assert.equal(secondBillingKey(billingInstant("2024-02-15")), "2024-03-15");
  assert.equal(secondBillingKey(billingInstant("2024-02-29")), "2024-03-28");
  assert.equal(keyFor(billingInstant("2026-12-15")), "2026-12-15");
  assert.equal(keyFor(billingInstant("2026-07-15")), "2026-07-15");
});

test("the first payment ends where the second payment starts", () => {
  const paidAt = billingInstant("2026-11-03");
  const coverage = firstCoverage(paidAt);
  assert.ok(coverage);
  assert.equal(coverage.anchor, 15);
  assert.equal(keyFor(coverage.periodEnd), "2026-12-15");
  const second = nextPeriodBill({ paidUntil: coverage.periodEnd });
  assert.equal(second?.periodKey, "2026-12-15");
  assert.equal(keyFor(second?.periodEnd || ""), "2027-01-15");
  assert.notEqual(coverage.periodStart, second?.periodStart);
});

test("cancel and pause stop the next fee, and a published listing accrues on the due date", () => {
  const due = billingInstant("2026-12-15");
  assert.equal(shouldAccrueNextPeriod({ status: "published", billingStatus: "active", anchorDay: 15, paidUntil: due, now: due }), true);
  assert.equal(shouldAccrueNextPeriod({ status: "deactivated", billingStatus: "active", anchorDay: 15, paidUntil: due, now: due }), false);
  assert.equal(shouldAccrueNextPeriod({ status: "published", billingStatus: "paused", anchorDay: 15, paidUntil: due, now: due }), false);
  assert.equal(shouldAccrueNextPeriod({ status: "published", billingStatus: "active", anchorDay: 15, paidUntil: due, now: billingInstant("2026-12-14") }), false);
});

test("two batches and two currencies stay apart, and quotes join only the next listing fee", () => {
  const plans = previewCollections([
    { id: "ca15", kind: "listing", currency: "CAD", amountCents: 149, status: "due", dueAt: "2026-12-15", periodKey: "2026-12-15" },
    { id: "ca28", kind: "listing", currency: "CAD", amountCents: 149, status: "due", dueAt: "2026-12-28", periodKey: "2026-12-28" },
    { id: "us15", kind: "listing", currency: "USD", amountCents: 149, status: "due", dueAt: "2026-12-15", periodKey: "2026-12-15" },
    { id: "quote", kind: "quote", currency: "CAD", amountCents: 25, status: "pending" },
    { id: "usd-quote", kind: "quote", currency: "USD", amountCents: 25, status: "pending" },
  ]);
  const cad = plans.filter((plan) => plan.currency === "CAD");
  assert.equal(cad.length, 2);
  assert.equal(cad[0].totalCents, 174);
  assert.equal(cad[0].billIds.includes("quote"), true);
  assert.equal(cad[1].totalCents, 149);
  assert.equal(cad[1].billIds.includes("quote"), false);
  assert.equal(plans.find((plan) => plan.currency === "USD")?.totalCents, 174);
});

test("a zero balance still has its settlement date, and unpaid lines are the balance", () => {
  const view = settlementView({
    products: [
      { currency: "CAD", anchorDay: 15, paidUntil: billingInstant("2026-12-15"), status: "published", billingStatus: "active" },
      { currency: "CAD", anchorDay: 28, paidUntil: billingInstant("2026-12-28"), status: "published", billingStatus: "active" },
    ],
    bills: [],
  });
  assert.equal(view[0].balanceCents, 0);
  assert.equal(view[0].batches[0].date, "2026-12-15");
  assert.equal(view[0].batches[1].date, "2026-12-28");
  const owed = settlementView({
    products: [],
    bills: [{ currency: "CAD", amountCents: 149, status: "due", dueAt: billingInstant("2026-12-15") }],
  });
  assert.equal(owed[0].balanceCents, 149);
  assert.equal(owed[0].batches[0].unpaidCents, 149);
});

function openDb() {
  const db = new DatabaseSync(":memory:");
  db.exec(`
    CREATE TABLE products (
      id TEXT PRIMARY KEY, user_id TEXT, status TEXT, paid_until TEXT DEFAULT '', next_renewal_at TEXT DEFAULT '',
      grace_until TEXT DEFAULT '', billing_status TEXT DEFAULT '', billing_currency TEXT DEFAULT '',
      billing_version INTEGER DEFAULT 0, billing_started_at TEXT DEFAULT '', billing_anchor_day INTEGER DEFAULT 0,
      auto_renew INTEGER DEFAULT 1, deactivates_at TEXT, deactivated_at TEXT, updated_at TEXT
    );
    CREATE TABLE twig_bills (
      id TEXT PRIMARY KEY, user_id TEXT, product_id TEXT, kind TEXT, amount_cents INTEGER, currency TEXT,
      status TEXT, collection_id TEXT DEFAULT '', billing_period_key TEXT DEFAULT '', paid_at TEXT DEFAULT '',
      charge_key TEXT DEFAULT '', period_start TEXT DEFAULT '', period_end TEXT DEFAULT '', due_at TEXT DEFAULT ''
    );
    CREATE UNIQUE INDEX twig_bills_listing_period ON twig_bills(product_id, billing_period_key)
      WHERE kind = 'listing' AND billing_period_key != '';
  `);
  return db;
}

test("repeating a run does not create a second bill, and a failed retry keeps the same bill", () => {
  const db = openDb();
  db.prepare(`INSERT INTO products (id, user_id, status, billing_status, billing_anchor_day) VALUES ('prd_a', 'usr', 'draft', '', 0)`).run();
  db.prepare(`INSERT INTO twig_bills (id, user_id, product_id, kind, amount_cents, currency, status, billing_period_key, due_at, period_end) VALUES ('bill_first', 'usr', 'prd_a', 'listing', 149, 'CAD', 'due', 'first:prd_a', ?, ?)`).run(billingInstant("2026-11-03"), billingInstant("2026-12-15"));
  const staged = stageFeeCollection(db, { id: "col_first", userId: "usr", currency: "CAD", now: billingInstant("2026-11-03") });
  assert.ok(staged);
  applyPaymentResult(db, {
    provider: "stripe",
    transactionId: "pi_first",
    eventId: "evt_first",
    userId: "usr",
    collectionId: staged.collectionId,
    paidAt: billingInstant("2026-11-03"),
    succeeded: true,
  });
  const again = applyPaymentResult(db, {
    provider: "stripe",
    transactionId: "pi_first",
    eventId: "evt_first_2",
    userId: "usr",
    collectionId: staged.collectionId,
    paidAt: billingInstant("2026-11-04"),
    succeeded: true,
  });
  const product = db.prepare(`SELECT billing_anchor_day, paid_until, status FROM products WHERE id = 'prd_a'`).get() as { billing_anchor_day: number; paid_until: string; status: string };
  assert.equal(again.alreadyApplied, true);
  assert.equal(Number(product.billing_anchor_day), 15);
  assert.equal(keyFor(product.paid_until), "2026-12-15");
  assert.equal(product.status, "published");
  db.prepare(`INSERT INTO twig_bills (id, user_id, product_id, kind, amount_cents, currency, status, billing_period_key, due_at) VALUES ('bill_dec', 'usr', 'prd_a', 'listing', 149, 'CAD', 'due', '2026-12-15', ?)`).run(billingInstant("2026-12-15"));
  assert.throws(() => {
    db.prepare(`INSERT INTO twig_bills (id, user_id, product_id, kind, amount_cents, currency, status, billing_period_key) VALUES ('bill_dup', 'usr', 'prd_a', 'listing', 149, 'CAD', 'due', '2026-12-15')`).run();
  });
  const due = stageFeeCollection(db, { id: "col_dec", userId: "usr", currency: "CAD", now: billingInstant("2026-12-15") });
  assert.ok(due);
  applyPaymentResult(db, {
    provider: "stripe",
    transactionId: "pi_fail",
    eventId: "evt_fail",
    userId: "usr",
    collectionId: due.collectionId,
    paidAt: billingInstant("2026-12-15"),
    succeeded: false,
  });
  const retry = stageFeeCollection(db, { id: "col_retry", userId: "usr", currency: "CAD", now: billingInstant("2026-12-16") });
  const billCount = db.prepare(`SELECT COUNT(*) AS n FROM twig_bills WHERE product_id = 'prd_a' AND billing_period_key = '2026-12-15'`).get() as { n: number };
  assert.equal(retry?.collectionId, due.collectionId);
  assert.equal(Number(billCount.n), 1);
  const paidBill = db.prepare(`SELECT status FROM twig_bills WHERE id = 'bill_first'`).get() as { status: string };
  assert.equal(paidBill.status, "paid");
  db.close();
});
