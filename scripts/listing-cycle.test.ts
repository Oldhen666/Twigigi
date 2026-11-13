import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import {
  afterGraceElapsed,
  afterRenewalFailure,
  firstPaidUntil,
  graceDeadline,
  listingAcceptsOrders,
  listingPeriodKey,
  paidUntilAfterPayment,
  renewPaidUntil,
  shouldRenewListing,
} from "../lib/listing-cycle.ts";

const nov1 = "2026-11-01T00:00:00.000Z";
const nov20 = "2026-11-20T00:00:00.000Z";
const dec1 = "2026-12-01T00:00:00.000Z";
const dec20 = "2026-12-20T00:00:00.000Z";
const dec31 = "2026-12-31T00:00:00.000Z";

test("a listing paid on November 1 is valid through December 1", () => {
  assert.equal(firstPaidUntil(nov1), dec1);
});

test("a listing paid on November 20 is valid through December 20", () => {
  assert.equal(firstPaidUntil(nov20), dec20);
});

test("a renewal on December 1 extends from the old expiry to December 31", () => {
  const renewed = paidUntilAfterPayment({ paidUntil: dec1, billingStatus: "active", autoRenew: true, paidAt: dec1 });
  assert.equal(renewed.paidUntil, dec31);
  assert.equal(renewed.mode, "extend");
  assert.equal(renewPaidUntil(dec1), dec31);
});

test("a payment on December 2 during grace keeps the original cycle", () => {
  const paid = paidUntilAfterPayment({
    paidUntil: dec1,
    billingStatus: "grace",
    graceUntil: "2026-12-04T00:00:00.000Z",
    autoRenew: true,
    paidAt: "2026-12-02T00:00:00.000Z",
  });
  assert.equal(paid.mode, "extend");
  assert.equal(paid.paidUntil, dec31);
});

test("a payment on December 6 after the pause starts a new 30 days", () => {
  const paid = paidUntilAfterPayment({
    paidUntil: dec1,
    billingStatus: "paused",
    graceUntil: "2026-12-04T00:00:00.000Z",
    autoRenew: true,
    paidAt: "2026-12-06T00:00:00.000Z",
  });
  assert.equal(paid.mode, "restart");
  assert.equal(paid.paidUntil, "2027-01-05T00:00:00.000Z");
});

test("a failed renewal stays visible for 72 hours and then pauses", () => {
  const failed = afterRenewalFailure({ billingStatus: "active" }, dec1);
  assert.equal(failed.billingStatus, "grace");
  assert.equal(failed.graceUntil, graceDeadline(dec1));
  assert.equal(failed.graceUntil, "2026-12-04T00:00:00.000Z");
  assert.equal(listingAcceptsOrders({ status: "published", billingStatus: "grace", graceUntil: failed.graceUntil }, Date.parse("2026-12-03T00:00:00.000Z")), true);
  const paused = afterGraceElapsed(failed, Date.parse("2026-12-04T00:00:00.000Z"));
  assert.equal(paused.billingStatus, "paused");
  assert.equal(listingAcceptsOrders({ status: "published", billingStatus: "paused" }, Date.parse("2026-12-04T00:00:00.000Z")), false);
});

test("payment during grace restores the listing and extends the original expiry", () => {
  const failed = afterRenewalFailure({ billingStatus: "active", paidUntil: dec1 }, dec1);
  const restored = paidUntilAfterPayment({
    paidUntil: dec1,
    billingStatus: failed.billingStatus,
    graceUntil: failed.graceUntil,
    autoRenew: true,
    paidAt: dec1,
  });
  assert.equal(restored.mode, "extend");
  assert.equal(restored.paidUntil, dec31);
});

test("the same listing period has one key and a second insert is rejected", () => {
  const key = listingPeriodKey(dec1);
  const db = new DatabaseSync(":memory:");
  db.exec(`
    CREATE TABLE twig_bills (
      id TEXT PRIMARY KEY,
      product_id TEXT,
      kind TEXT,
      billing_period_key TEXT NOT NULL DEFAULT '',
      status TEXT
    );
    CREATE UNIQUE INDEX twig_bills_listing_period
      ON twig_bills(product_id, billing_period_key)
      WHERE kind = 'listing' AND billing_period_key != '';
  `);
  db.prepare("INSERT INTO twig_bills (id, product_id, kind, billing_period_key, status) VALUES ('a', 'prd_one', 'listing', ?, 'due')").run(key);
  assert.throws(() => {
    db.prepare("INSERT INTO twig_bills (id, product_id, kind, billing_period_key, status) VALUES ('b', 'prd_one', 'listing', ?, 'due')").run(key);
  });
  db.close();
});

test("a listing with no verified payment is not back-charged", () => {
  const db = new DatabaseSync(":memory:");
  db.exec(`
    CREATE TABLE products (
      id TEXT PRIMARY KEY,
      status TEXT,
      fee_exempt INTEGER NOT NULL DEFAULT 0,
      paid_until TEXT NOT NULL DEFAULT '',
      next_renewal_at TEXT NOT NULL DEFAULT '',
      auto_renew INTEGER NOT NULL DEFAULT 1,
      billing_status TEXT NOT NULL DEFAULT '',
      billing_currency TEXT NOT NULL DEFAULT '',
      billing_version INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE twig_bills (
      id TEXT PRIMARY KEY,
      product_id TEXT,
      kind TEXT,
      status TEXT,
      period_end TEXT,
      currency TEXT,
      billing_period_key TEXT NOT NULL DEFAULT ''
    );
  `);
  db.prepare("INSERT INTO products (id, status) VALUES ('prd_old', 'published')").run();
  db.prepare("INSERT INTO twig_bills (id, product_id, kind, status, period_end, currency) VALUES ('bill_bug', 'prd_old', 'listing', 'due', '2026-12-01T00:00:00.000Z', 'CAD')").run();
  const now = "2026-11-11T00:00:00.000Z";
  db.prepare(
    `UPDATE products SET billing_status = 'legacy_review', auto_renew = 0, billing_version = 1
     WHERE billing_status = '' AND status = 'published' AND fee_exempt = 0`,
  ).run();
  db.prepare(
    `UPDATE twig_bills SET status = 'void'
     WHERE kind = 'listing' AND status = 'due' AND billing_period_key = ''
       AND product_id IN (SELECT id FROM products WHERE billing_status = 'legacy_review')`,
  ).run();
  const product = db.prepare("SELECT billing_status, auto_renew, paid_until FROM products WHERE id = 'prd_old'").get() as {
    billing_status: string;
    auto_renew: number;
    paid_until: string;
  };
  const bill = db.prepare("SELECT status FROM twig_bills WHERE id = 'bill_bug'").get() as { status: string };
  assert.equal(product.billing_status, "legacy_review");
  assert.equal(product.auto_renew, 0);
  assert.equal(product.paid_until, "");
  assert.equal(bill.status, "void");
  assert.equal(shouldRenewListing({ billingStatus: "legacy_review", autoRenew: false, paidUntil: "" }, Date.parse(now)), false);
  db.close();
});

test("turning off auto-renew keeps the paid days, then the listing stops", () => {
  assert.equal(
    listingAcceptsOrders(
      { status: "published", billingStatus: "active", autoRenew: false, paidUntil: dec1 },
      Date.parse("2026-11-20T00:00:00.000Z"),
    ),
    true,
  );
  assert.equal(
    listingAcceptsOrders(
      { status: "published", billingStatus: "active", autoRenew: false, paidUntil: dec1 },
      Date.parse(dec1),
    ),
    false,
  );
});

test("two listings expire on their own dates", () => {
  const cedar = firstPaidUntil(nov1);
  const bench = firstPaidUntil(nov20);
  assert.equal(cedar, dec1);
  assert.equal(bench, dec20);
  assert.notEqual(cedar, bench);
  assert.equal(shouldRenewListing({ billingStatus: "active", autoRenew: true, paidUntil: cedar }, Date.parse(dec1)), true);
  assert.equal(shouldRenewListing({ billingStatus: "active", autoRenew: true, paidUntil: bench }, Date.parse(dec1)), false);
});
