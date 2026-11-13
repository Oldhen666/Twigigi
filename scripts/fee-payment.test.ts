import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import { listingCycleKey, previewCollections } from "../lib/fee-collection.ts";
import { applyPaymentResult, ensurePaymentLedger, stageFeeCollection } from "../lib/payment-ledger.ts";

const dec1 = "2026-12-01T00:00:00.000Z";
const dec2 = "2026-12-02T00:00:00.000Z";
const dec6 = "2026-12-06T00:00:00.000Z";

function openDb() {
  const db = new DatabaseSync(":memory:");
  db.exec(`
    CREATE TABLE products (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      status TEXT,
      paid_until TEXT DEFAULT '',
      next_renewal_at TEXT DEFAULT '',
      grace_until TEXT DEFAULT '',
      billing_status TEXT DEFAULT '',
      billing_currency TEXT DEFAULT '',
      billing_version INTEGER DEFAULT 0,
      billing_started_at TEXT DEFAULT '',
      auto_renew INTEGER DEFAULT 1,
      deactivates_at TEXT,
      deactivated_at TEXT,
      updated_at TEXT
    );
    CREATE TABLE twig_bills (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      product_id TEXT,
      kind TEXT,
      amount_cents INTEGER,
      currency TEXT,
      status TEXT,
      collection_id TEXT DEFAULT '',
      billing_period_key TEXT DEFAULT '',
      paid_at TEXT DEFAULT '',
      charge_key TEXT DEFAULT '',
      period_start TEXT DEFAULT '',
      period_end TEXT DEFAULT ''
    );
  `);
  return db;
}

test("quote fees are not charged without a listing payment", () => {
  const plans = previewCollections([
    { id: "q1", kind: "quote", currency: "CAD", amountCents: 25, status: "pending" },
    { id: "q2", kind: "quote", currency: "CAD", amountCents: 25, status: "pending" },
  ]);
  assert.equal(plans.length, 0);
});

test("Canadian and US quotes stay with the matching listing currency", () => {
  const plans = previewCollections([
    { id: "ca-listing", kind: "listing", currency: "CAD", amountCents: 149, status: "due", periodKey: "2026-11-20T00:00:00.000Z" },
    { id: "us-listing", kind: "listing", currency: "USD", amountCents: 149, status: "due", periodKey: "2026-12-05T00:00:00.000Z" },
    { id: "ca-quote", kind: "quote", currency: "CAD", amountCents: 25, status: "pending" },
    { id: "us-quote", kind: "quote", currency: "USD", amountCents: 25, status: "pending" },
    { id: "orphan", kind: "quote", currency: "USD", amountCents: 50, status: "pending" },
  ]);
  const cad = plans.find((plan) => plan.currency === "CAD");
  const usd = plans.find((plan) => plan.currency === "USD");
  assert.equal(cad?.totalCents, 174);
  assert.equal(cad?.billIds.includes("us-quote"), false);
  assert.equal(usd?.totalCents, 224);
  assert.equal(usd?.billIds.includes("ca-quote"), false);
  assert.equal(usd?.billIds.includes("orphan"), true);
});

test("one listing renewal collects every unpaid quote once", () => {
  const quotes = Array.from({ length: 7 }, (_, index) => ({
    id: `q${index}`,
    kind: "quote",
    currency: "CAD",
    amountCents: 25,
    status: "pending",
  }));
  const [plan] = previewCollections([
    { id: "listing-a", kind: "listing", currency: "CAD", amountCents: 149, status: "due", periodKey: "2026-11-20T00:00:00.000Z" },
    ...quotes,
  ]);
  assert.equal(plan.totalCents, 324);
  assert.equal(plan.quoteCents, 175);
  assert.equal(plan.billIds.length, 8);
  const key = listingCycleKey("usr", "CAD", plan.periodKeys, "open");
  assert.equal(key.includes("T"), true);
  assert.equal(key.includes(new Date().toISOString().slice(0, 13)), false);
});

test("the same quotes cannot be attached to two collections", () => {
  const db = openDb();
  db.prepare(`INSERT INTO twig_bills (id, user_id, product_id, kind, amount_cents, currency, status, billing_period_key) VALUES ('bill_a', 'usr', 'prd_a', 'listing', 149, 'CAD', 'due', '2026-11-20T00:00:00.000Z')`).run();
  for (let index = 0; index < 7; index += 1) {
    db.prepare(`INSERT INTO twig_bills (id, user_id, product_id, kind, amount_cents, currency, status) VALUES (?, 'usr', 'prd_q', 'quote', 25, 'CAD', 'pending')`).run(`q${index}`);
  }
  const first = stageFeeCollection(db, { id: "col_one", userId: "usr", currency: "CAD", now: "2026-11-20T00:00:00.000Z" });
  const second = stageFeeCollection(db, { id: "col_two", userId: "usr", currency: "CAD", now: "2026-11-20T00:00:00.000Z" });
  assert.equal(first?.amountCents, 324);
  assert.equal(second?.collectionId, first?.collectionId);
  const collections = db.prepare(`SELECT COUNT(DISTINCT collection_id) AS n FROM twig_bills WHERE kind = 'quote'`).get() as { n: number };
  assert.equal(Number(collections.n), 1);
  db.close();
});

test("a confirmed payment extends once, and a second callback does not", () => {
  const db = openDb();
  db.prepare(`INSERT INTO products (id, user_id, status, paid_until, next_renewal_at, billing_status, auto_renew) VALUES ('prd_a', 'usr', 'published', ?, ?, 'active', 1)`).run(dec1, dec1);
  db.prepare(`INSERT INTO products (id, user_id, status, paid_until, next_renewal_at, billing_status, auto_renew) VALUES ('prd_b', 'usr', 'published', '2026-12-20T00:00:00.000Z', '2026-12-20T00:00:00.000Z', 'active', 1)`).run();
  db.prepare(`INSERT INTO twig_bills (id, user_id, product_id, kind, amount_cents, currency, status, billing_period_key) VALUES ('bill_a', 'usr', 'prd_a', 'listing', 149, 'CAD', 'due', ?)`).run(dec1);
  const staged = stageFeeCollection(db, { id: "col_dec", userId: "usr", currency: "CAD", now: dec1 });
  assert.ok(staged);
  const paid = applyPaymentResult(db, {
    provider: "stripe",
    transactionId: "pi_dec1",
    eventId: "evt_1",
    userId: "usr",
    collectionId: staged.collectionId,
    paidAt: dec1,
    succeeded: true,
  });
  const again = applyPaymentResult(db, {
    provider: "stripe",
    transactionId: "pi_dec1",
    eventId: "evt_2",
    userId: "usr",
    collectionId: staged.collectionId,
    paidAt: dec2,
    succeeded: true,
  });
  const product = db.prepare(`SELECT paid_until, billing_status FROM products WHERE id = 'prd_a'`).get() as { paid_until: string; billing_status: string };
  const other = db.prepare(`SELECT paid_until, billing_status FROM products WHERE id = 'prd_b'`).get() as { paid_until: string; billing_status: string };
  assert.equal(paid.applied, true);
  assert.equal(again.alreadyApplied, true);
  assert.equal(product.paid_until, "2026-12-31T00:00:00.000Z");
  assert.equal(product.billing_status, "active");
  assert.equal(other.paid_until, "2026-12-20T00:00:00.000Z");
  assert.equal(other.billing_status, "active");
  db.close();
});

test("a failed renewal pauses only that listing after grace, and does not mark quotes paid", () => {
  const db = openDb();
  db.prepare(`INSERT INTO products (id, user_id, status, paid_until, billing_status, auto_renew) VALUES ('prd_a', 'usr', 'published', ?, 'active', 1)`).run(dec1);
  db.prepare(`INSERT INTO products (id, user_id, status, paid_until, billing_status, auto_renew) VALUES ('prd_b', 'usr', 'published', '2026-12-20T00:00:00.000Z', 'active', 1)`).run();
  db.prepare(`INSERT INTO twig_bills (id, user_id, product_id, kind, amount_cents, currency, status, billing_period_key) VALUES ('bill_a', 'usr', 'prd_a', 'listing', 149, 'CAD', 'due', ?)`).run(dec1);
  db.prepare(`INSERT INTO twig_bills (id, user_id, product_id, kind, amount_cents, currency, status) VALUES ('q1', 'usr', 'prd_a', 'quote', 25, 'CAD', 'pending')`).run();
  const staged = stageFeeCollection(db, { id: "col_fail", userId: "usr", currency: "CAD", now: dec1 });
  assert.ok(staged);
  applyPaymentResult(db, {
    provider: "stripe",
    transactionId: "pi_fail",
    eventId: "evt_fail",
    userId: "usr",
    collectionId: staged.collectionId,
    paidAt: dec1,
    succeeded: false,
  });
  const failed = db.prepare(`SELECT billing_status, grace_until FROM products WHERE id = 'prd_a'`).get() as { billing_status: string; grace_until: string };
  const other = db.prepare(`SELECT billing_status FROM products WHERE id = 'prd_b'`).get() as { billing_status: string };
  const quote = db.prepare(`SELECT status FROM twig_bills WHERE id = 'q1'`).get() as { status: string };
  assert.equal(failed.billing_status, "grace");
  assert.equal(failed.grace_until, "2026-12-04T00:00:00.000Z");
  assert.equal(other.billing_status, "active");
  assert.equal(quote.status, "pending");
  db.close();
});

test("payment during grace extends, and payment after pause starts over", () => {
  const db = openDb();
  ensurePaymentLedger(db);
  db.prepare(`INSERT INTO products (id, user_id, status, paid_until, billing_status, grace_until, auto_renew) VALUES ('prd_grace', 'usr', 'published', ?, 'grace', '2026-12-04T00:00:00.000Z', 1)`).run(dec1);
  db.prepare(`INSERT INTO twig_bills (id, user_id, product_id, kind, amount_cents, currency, status, billing_period_key, collection_id) VALUES ('bill_g', 'usr', 'prd_grace', 'listing', 149, 'CAD', 'processing', ?, 'col_grace')`).run(dec1);
  db.prepare(`INSERT INTO fee_collections (id, user_id, currency, amount_cents, status, idempotency_key, created_at) VALUES ('col_grace', 'usr', 'CAD', 149, 'processing', 'key-grace', ?)`).run(dec2);
  applyPaymentResult(db, {
    provider: "stripe",
    transactionId: "pi_grace",
    userId: "usr",
    collectionId: "col_grace",
    paidAt: dec2,
    succeeded: true,
  });
  const grace = db.prepare(`SELECT paid_until, billing_status FROM products WHERE id = 'prd_grace'`).get() as { paid_until: string; billing_status: string };
  assert.equal(grace.paid_until, "2026-12-31T00:00:00.000Z");
  assert.equal(grace.billing_status, "active");

  db.prepare(`INSERT INTO products (id, user_id, status, paid_until, billing_status, grace_until, auto_renew) VALUES ('prd_late', 'usr', 'published', ?, 'paused', '2026-12-04T00:00:00.000Z', 1)`).run(dec1);
  db.prepare(`INSERT INTO twig_bills (id, user_id, product_id, kind, amount_cents, currency, status, billing_period_key, collection_id) VALUES ('bill_late', 'usr', 'prd_late', 'listing', 149, 'CAD', 'processing', 'restart:prd_late', 'col_late')`).run();
  db.prepare(`INSERT INTO fee_collections (id, user_id, currency, amount_cents, status, idempotency_key, created_at) VALUES ('col_late', 'usr', 'CAD', 149, 'processing', 'key-late', ?)`).run(dec6);
  applyPaymentResult(db, {
    provider: "paypal",
    transactionId: "cap_late",
    userId: "usr",
    collectionId: "col_late",
    paidAt: dec6,
    succeeded: true,
  });
  const late = db.prepare(`SELECT paid_until FROM products WHERE id = 'prd_late'`).get() as { paid_until: string };
  assert.equal(late.paid_until, "2027-01-05T00:00:00.000Z");
  db.close();
});
